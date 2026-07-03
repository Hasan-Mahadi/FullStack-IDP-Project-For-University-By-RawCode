/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * PAYMENT SYSTEM CONTROLLER (DEMO + COD + MOCK CARD + SHURJOPAY READY)
 * ====================================================================
 *
 * Phase 1: Demo Gateway (COD + Mock Card) 
 * Phase 2: ShurjoPay integration architecture prepared (config stubs).
 *
 * Payment flow:
 *   Customer selects method → POST /api/payments/initiate → 
 *   Mock processing → POST /api/payments/verify → order updated
 */

const db          = require('../database/connection');
const responseUtils = require('../utils/responseUtils');
const crypto      = require('crypto');

// ===== ShurjoPay Config Stub (Phase 2 — Ready for integration) =====
// const SHURJOPAY_CONFIG = {
//     storeId:    process.env.SHURJOPAY_STORE_ID    || '',
//     secretKey:  process.env.SHURJOPAY_SECRET_KEY  || '',
//     returnUrl:  process.env.SHURJOPAY_RETURN_URL  || 'http://localhost:3001/pages/checkout.html',
//     cancelUrl:  process.env.SHURJOPAY_CANCEL_URL  || 'http://localhost:3001/pages/checkout.html',
//     apiUrl:     process.env.SHURJOPAY_API_URL     || 'https://sandbox.shurjopayment.com'
// };

const PAYMENT_METHODS = [
    {
        id:          'COD',
        label:       'Cash On Delivery',
        description: 'Pay when your order arrives at your door.',
        icon:        '💵',
        available:   true
    },
    {
        id:          'MOCK_CARD',
        label:       'Credit / Debit Card',
        description: 'Demo card payment (any test card accepted).',
        icon:        '💳',
        available:   true
    },
    {
        id:          'SHURJOPAY',
        label:       'ShurjoPay',
        description: 'Coming soon — Bangladesh\'s leading payment gateway.',
        icon:        '🌐',
        available:   false
    }
];

/**
 * Generate a mock transaction ID
 */
function generateTransactionId(method) {
    const prefix = method === 'COD' ? 'COD' : 'TXN';
    const ts     = Date.now().toString(36).toUpperCase();
    const rand   = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}-${ts}-${rand}`;
}

module.exports = {
    /**
     * GET /api/payments/methods
     * Returns available payment methods.
     */
    async getPaymentMethods(req, res) {
        return responseUtils.sendJSON(res, 200, {
            success: true,
            methods: PAYMENT_METHODS
        });
    },

    /**
     * POST /api/payments/initiate
     * Protected (Customer): Initiates payment for an existing PENDING order.
     * Body: { orderId, paymentMethod: 'COD' | 'MOCK_CARD', cardDetails? }
     */
    async initiatePayment(req, res) {
        const customerId = req.user.userId;
        const { orderId, paymentMethod, cardDetails } = req.body || {};

        if (!orderId || !paymentMethod) {
            return responseUtils.sendError(res, 400, 'Missing Fields', 'orderId and paymentMethod are required.');
        }

        if (!['COD', 'MOCK_CARD'].includes(paymentMethod)) {
            return responseUtils.sendError(res, 400, 'Invalid Method', 'Payment method must be COD or MOCK_CARD.');
        }

        const oId = Number(orderId);

        try {
            let order = null;

            if (db.isMockMode()) {
                const mock = db.getMock();
                order = mock.selectOne('orders', o => o.id === oId && o.customer_id === customerId);
            } else {
                const rows = await db.query(
                    'SELECT id, customer_id, status, total_amount FROM orders WHERE id = :1 AND customer_id = :2',
                    [oId, customerId]
                );
                if (rows.length > 0) {
                    order = {
                        id:           Number(rows[0].ID),
                        customer_id:  Number(rows[0].CUSTOMER_ID),
                        status:       rows[0].STATUS,
                        total_amount: Number(rows[0].TOTAL_AMOUNT)
                    };
                }
            }

            if (!order) {
                return responseUtils.sendError(res, 404, 'Order Not Found', 'Order does not exist or does not belong to you.');
            }

            if (!['PENDING', 'PENDING_PAYMENT'].includes(order.status)) {
                return responseUtils.sendError(res, 400, 'Payment Not Required',
                    'Payment can only be initiated for pending orders.');
            }

            const transactionId = generateTransactionId(paymentMethod);

            if (paymentMethod === 'COD') {
                // COD: Mark immediately as COD confirmed
                const updateFields = {
                    payment_method:  'COD',
                    payment_status:  'COD_PENDING',
                    transaction_id:  transactionId
                };

                if (db.isMockMode()) {
                    const mock = db.getMock();
                    mock.update('orders', o => o.id === oId, updateFields);
                } else {
                    await db.execute(
                        'UPDATE orders SET payment_method = :1, payment_status = :2, transaction_id = :3 WHERE id = :4',
                        ['COD', 'COD_PENDING', transactionId, oId]
                    );
                }

                return responseUtils.sendJSON(res, 200, {
                    success:       true,
                    paymentMethod: 'COD',
                    paymentStatus: 'COD_PENDING',
                    transactionId,
                    message:       'Cash On Delivery confirmed. Pay upon delivery.'
                });
            }

            if (paymentMethod === 'MOCK_CARD') {
                // Mock card — simulate processing with demo logic
                // In real mode: redirect to payment gateway, await webhook
                const isApproved = true; // Always approve in demo

                const paymentStatus = isApproved ? 'PAID' : 'FAILED';

                const updateFields = {
                    payment_method:  'MOCK_CARD',
                    payment_status:  paymentStatus,
                    transaction_id:  transactionId
                };

                if (db.isMockMode()) {
                    const mock = db.getMock();
                    mock.update('orders', o => o.id === oId, updateFields);
                } else {
                    await db.execute(
                        'UPDATE orders SET payment_method = :1, payment_status = :2, transaction_id = :3 WHERE id = :4',
                        ['MOCK_CARD', paymentStatus, transactionId, oId]
                    );
                }

                return responseUtils.sendJSON(res, 200, {
                    success:       true,
                    paymentMethod: 'MOCK_CARD',
                    paymentStatus,
                    transactionId,
                    message:       isApproved
                        ? 'Card payment processed successfully (Demo Mode).'
                        : 'Card payment failed. Please try another method.'
                });
            }

        } catch (error) {
            console.error('[PAYMENT ERROR]', error);
            return responseUtils.sendError(res, 500, 'Payment Processing Failed', error.message);
        }
    },

    /**
     * GET /api/payments/status
     * Protected (Customer): Get payment status for an order.
     */
    async getPaymentStatus(req, res) {
        const customerId = req.user.userId;
        const orderId    = parseInt(req.query.orderId);

        if (!orderId) {
            return responseUtils.sendError(res, 400, 'Missing orderId', 'Provide orderId as query parameter.');
        }

        try {
            let order = null;

            if (db.isMockMode()) {
                const mock = db.getMock();
                order = mock.selectOne('orders', o => o.id === orderId && o.customer_id === customerId);
            } else {
                const rows = await db.query(
                    'SELECT payment_method, payment_status, transaction_id FROM orders WHERE id = :1 AND customer_id = :2',
                    [orderId, customerId]
                );
                if (rows.length > 0) {
                    order = {
                        payment_method: rows[0].PAYMENT_METHOD,
                        payment_status: rows[0].PAYMENT_STATUS,
                        transaction_id: rows[0].TRANSACTION_ID
                    };
                }
            }

            if (!order) {
                return responseUtils.sendError(res, 404, 'Order Not Found', 'Order not found.');
            }

            return responseUtils.sendJSON(res, 200, {
                success:       true,
                paymentMethod: order.payment_method,
                paymentStatus: order.payment_status,
                transactionId: order.transaction_id
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Payment Status Error', error.message);
        }
    }
};
