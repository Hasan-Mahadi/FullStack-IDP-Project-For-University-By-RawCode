/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * EMAIL NOTIFICATION SERVICE (Nodemailer — Production-Ready)
 * ====================================================================
 *
 * Provides transactional email delivery for order lifecycle events.
 *
 * Architecture:
 *  - SMTP transport via Nodemailer (Gmail or Outlook)
 *  - Credentials loaded exclusively from environment variables
 *  - Retry logic: up to 3 attempts with exponential backoff
 *  - Console fallback: logs full email content when SMTP unavailable
 *  - Non-throwing: all errors are caught and logged internally;
 *    the order workflow is NEVER affected by email failures.
 *
 * Environment Variables Required (in .env):
 *  EMAIL_PROVIDER   = gmail | outlook
 *  EMAIL_USER       = sender email address
 *  EMAIL_PASSWORD   = app password / account password
 *  EMAIL_FROM_NAME  = display name (default: EduShop Support)
 *
 * Future-Ready: To switch to SendGrid/SES/Postmark, only replace
 *  the createTransport() section — the rest of the API stays identical.
 */

const nodemailer = require('nodemailer');

// ─── SMTP Provider Configurations ────────────────────────────────────
const SMTP_CONFIGS = {
    gmail: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // STARTTLS
        requireTLS: true
    },
    outlook: {
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        requireTLS: true
    }
};

// ─── Internal Logger ─────────────────────────────────────────────────
function emailLog(level, ...args) {
    const prefix = {
        info:  '\x1b[36m[EMAIL SERVICE]\x1b[0m',
        warn:  '\x1b[33m[EMAIL SERVICE]\x1b[0m',
        error: '\x1b[31m[EMAIL SERVICE]\x1b[0m',
        ok:    '\x1b[32m[EMAIL SERVICE]\x1b[0m'
    }[level] || '[EMAIL SERVICE]';
    console.log(prefix, ...args);
}

// ─── Build Transporter ────────────────────────────────────────────────
/**
 * Creates a Nodemailer transport from environment variables.
 * Returns null if credentials are not configured.
 */
function buildTransporter() {
    const provider  = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();
    const user      = process.env.EMAIL_USER;
    const password  = process.env.EMAIL_PASSWORD;

    if (!user || !password || user === 'your_email@gmail.com') {
        return null; // Not configured — will fallback to console log
    }

    const smtpConfig = SMTP_CONFIGS[provider] || SMTP_CONFIGS.gmail;

    return nodemailer.createTransport({
        ...smtpConfig,
        auth: {
            user,
            pass: password
        },
        pool: true,
        maxConnections: 3,
        maxMessages: 50
    });
}

// ─── HTML Email Template ──────────────────────────────────────────────
/**
 * Generates a professional HTML order confirmation email.
 * @param {Object} orderData
 * @returns {string} HTML string
 */
function buildOrderConfirmationHTML(orderData) {
    const {
        customerName,
        orderId,
        orderDate,
        items,
        shippingName,
        shippingPhone,
        shippingAddress,
        paymentMethod,
        paymentStatus,
        totalAmount
    } = orderData;

    const formattedDate = new Date(orderDate || Date.now()).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    const paymentLabel = paymentMethod === 'MOCK_CARD' ? 'Card Payment' : 'Cash on Delivery (COD)';
    const statusLabel  = paymentStatus === 'PAID' ? 'PAID' : 'Pending (Pay on Delivery)';
    const statusColor  = paymentStatus === 'PAID' ? '#10b981' : '#f59e0b';

    // Build items rows
    const itemRows = (items || []).map(item => `
        <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1e2a3a; color: #f3f4f6; font-size: 14px;">${item.product_name || item.name || 'Product'}</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1e2a3a; color: #9ca3af; text-align: center; font-size: 14px;">${item.quantity}</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1e2a3a; color: #9ca3af; text-align: right; font-size: 14px;">$${Number(item.price).toFixed(2)}</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1e2a3a; color: #6366f1; text-align: right; font-weight: 600; font-size: 14px;">$${(Number(item.price) * Number(item.quantity)).toFixed(2)}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation #${orderId} — EduShop</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070a13; font-family: 'Segoe UI', Arial, sans-serif;">

    <!-- Outer wrapper -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #070a13; padding: 40px 20px;">
        <tr>
            <td align="center">
                <!-- Email Card -->
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; background: linear-gradient(135deg, #0d121f 0%, #121826 100%); border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">

                    <!-- Header with gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 40px 30px; text-align: center;">
                            <!-- Logo mark -->
                            <div style="display: inline-block; background: rgba(255,255,255,0.15); border-radius: 16px; padding: 12px 24px; margin-bottom: 20px;">
                                <span style="font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -1px;">🎓 EduShop</span>
                            </div>
                            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Order Confirmed!</h1>
                            <p style="margin: 10px 0 0; color: rgba(255,255,255,0.8); font-size: 15px;">Your order has been received and is being processed.</p>
                        </td>
                    </tr>

                    <!-- Greeting -->
                    <tr>
                        <td style="padding: 32px 40px 0;">
                            <p style="margin: 0; font-size: 16px; color: #f3f4f6; line-height: 1.6;">
                                Hi <strong style="color: #a78bfa;">${customerName}</strong>, 👋<br><br>
                                Thank you for shopping with EduShop! We're excited to let you know that your order has been 
                                <strong style="color: #10b981;">successfully placed</strong> and is now awaiting review by our Service Team.
                            </p>
                        </td>
                    </tr>

                    <!-- Order Meta Cards -->
                    <tr>
                        <td style="padding: 24px 40px 0;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); border-radius: 12px; padding: 16px 20px; width: 48%;">
                                        <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">ORDER ID</div>
                                        <div style="color: #6366f1; font-size: 20px; font-weight: 800;">#${orderId}</div>
                                    </td>
                                    <td style="width: 4%;"></td>
                                    <td style="background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); border-radius: 12px; padding: 16px 20px; width: 48%;">
                                        <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">ORDER DATE</div>
                                        <div style="color: #10b981; font-size: 13px; font-weight: 700;">${formattedDate}</div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Status Badge -->
                    <tr>
                        <td style="padding: 16px 40px 0; text-align: center;">
                            <span style="display: inline-block; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 100px; padding: 8px 20px; color: #f59e0b; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;">
                                ⏳ Status: PENDING — Awaiting Service Team Review
                            </span>
                        </td>
                    </tr>

                    <!-- Divider -->
                    <tr>
                        <td style="padding: 28px 40px 0;">
                            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 0;">
                        </td>
                    </tr>

                    <!-- Order Summary Table -->
                    <tr>
                        <td style="padding: 24px 40px 0;">
                            <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #f3f4f6; letter-spacing: -0.3px;">📦 Order Summary</h2>
                            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.07);">
                                <thead>
                                    <tr style="background: rgba(255,255,255,0.04);">
                                        <th style="padding: 12px 16px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Product</th>
                                        <th style="padding: 12px 16px; text-align: center; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Qty</th>
                                        <th style="padding: 12px 16px; text-align: right; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Unit</th>
                                        <th style="padding: 12px 16px; text-align: right; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemRows}
                                </tbody>
                                <tfoot>
                                    <tr style="background: rgba(99,102,241,0.08);">
                                        <td colspan="3" style="padding: 16px 16px; color: #f3f4f6; font-weight: 700; font-size: 15px;">Order Total</td>
                                        <td style="padding: 16px 16px; text-align: right; color: #6366f1; font-weight: 800; font-size: 18px;">$${Number(totalAmount).toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </td>
                    </tr>

                    <!-- Shipping & Payment Info -->
                    <tr>
                        <td style="padding: 24px 40px 0;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <!-- Shipping Info -->
                                    <td style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 20px; vertical-align: top; width: 48%;">
                                        <h3 style="margin: 0 0 14px; font-size: 13px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">🚚 Shipping To</h3>
                                        <div style="color: #f3f4f6; font-size: 14px; font-weight: 600; margin-bottom: 4px;">${shippingName}</div>
                                        <div style="color: #9ca3af; font-size: 13px; margin-bottom: 4px;">📞 ${shippingPhone}</div>
                                        <div style="color: #9ca3af; font-size: 13px; line-height: 1.5;">📍 ${shippingAddress}</div>
                                    </td>
                                    <td style="width: 4%;"></td>
                                    <!-- Payment Info -->
                                    <td style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 20px; vertical-align: top; width: 48%;">
                                        <h3 style="margin: 0 0 14px; font-size: 13px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">💳 Payment</h3>
                                        <div style="color: #f3f4f6; font-size: 14px; font-weight: 600; margin-bottom: 8px;">${paymentLabel}</div>
                                        <span style="display: inline-block; background: ${statusColor}20; border: 1px solid ${statusColor}40; border-radius: 100px; padding: 4px 12px; color: ${statusColor}; font-size: 12px; font-weight: 700;">${statusLabel}</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- What Happens Next -->
                    <tr>
                        <td style="padding: 24px 40px 0;">
                            <div style="background: rgba(99,102,241,0.06); border: 1px solid rgba(99,102,241,0.15); border-radius: 12px; padding: 20px;">
                                <h3 style="margin: 0 0 14px; font-size: 14px; font-weight: 700; color: #a78bfa;">🔄 What Happens Next?</h3>
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                    <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                                        <strong style="color: #f3f4f6;">1. Review</strong> — Our Service Team will review and approve your order.<br>
                                        <strong style="color: #f3f4f6;">2. Packaging</strong> — Sellers will prepare and ship items to our central warehouse.<br>
                                        <strong style="color: #f3f4f6;">3. Verification</strong> — Quality audit at the warehouse ensures everything is correct.<br>
                                        <strong style="color: #f3f4f6;">4. Dispatch</strong> — Your package will be dispatched to your campus/dorm location.<br>
                                        <strong style="color: #f3f4f6;">5. Delivered</strong> — Confirm receipt in your customer dashboard.
                                    </p>
                                </div>
                            </div>
                        </td>
                    </tr>

                    <!-- Divider -->
                    <tr>
                        <td style="padding: 28px 40px 0;">
                            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 0;">
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 40px 40px; text-align: center;">
                            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">Need help? Contact our support team:</p>
                            <p style="margin: 0 0 16px; color: #6366f1; font-size: 13px; font-weight: 600;">support@edushop.edu</p>
                            <p style="margin: 0; color: #4b5563; font-size: 12px; line-height: 1.6;">
                                &copy; ${new Date().getFullYear()} EduShop — Campus E-Commerce Platform<br>
                                This is an automated message. Please do not reply directly to this email.
                            </p>
                        </td>
                    </tr>

                </table>
                <!-- /Email Card -->
            </td>
        </tr>
    </table>

</body>
</html>`;
}

// ─── Console Fallback Logger ──────────────────────────────────────────
/**
 * Logs email content to console when SMTP is unavailable.
 * Preserves production-ready architecture without silently discarding emails.
 */
function logEmailToConsole(to, subject, orderData) {
    console.log('\n' + '='.repeat(70));
    emailLog('warn', 'SMTP not configured — logging email to console instead.');
    emailLog('warn', `TO:      ${to}`);
    emailLog('warn', `SUBJECT: ${subject}`);
    emailLog('warn', `ORDER:   #${orderData.orderId} | Customer: ${orderData.customerName}`);
    emailLog('warn', `ITEMS:   ${(orderData.items || []).map(i => `${i.product_name || i.name} x${i.quantity}`).join(', ')}`);
    emailLog('warn', `TOTAL:   $${Number(orderData.totalAmount).toFixed(2)}`);
    emailLog('warn', `SHIP TO: ${orderData.shippingAddress}`);
    emailLog('warn', `PAYMENT: ${orderData.paymentMethod} — ${orderData.paymentStatus}`);
    emailLog('warn', '>>> To enable real email delivery, configure .env with SMTP credentials.');
    console.log('='.repeat(70) + '\n');
}

// ─── Retry Helper ─────────────────────────────────────────────────────
/**
 * Retries an async operation with exponential backoff.
 * @param {Function} fn       - Async function to retry
 * @param {number}   retries  - Max retry count
 * @param {number}   baseDelay - Base delay in ms (doubles each attempt)
 */
async function withRetry(fn, retries = 3, baseDelay = 1000) {
    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < retries) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                emailLog('warn', `Attempt ${attempt}/${retries} failed. Retrying in ${delay}ms... Error: ${err.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Sends an order confirmation email to the customer.
 *
 * CRITICAL CONTRACT:
 *   This function NEVER throws. All errors are caught internally.
 *   The order workflow must never be blocked or rolled back due to
 *   email delivery failures.
 *
 * @param {string} customerEmail - Recipient email address
 * @param {Object} orderData     - Order details for the template
 * @param {string} orderData.customerName
 * @param {number} orderData.orderId
 * @param {Date}   orderData.orderDate
 * @param {Array}  orderData.items          - [{product_name, quantity, price}]
 * @param {string} orderData.shippingName
 * @param {string} orderData.shippingPhone
 * @param {string} orderData.shippingAddress
 * @param {string} orderData.paymentMethod
 * @param {string} orderData.paymentStatus
 * @param {number} orderData.totalAmount
 */
async function sendOrderConfirmationEmail(customerEmail, orderData) {
    const subject = `Order Confirmation - Your Order Has Been Received (#${orderData.orderId})`;

    try {
        const transporter = buildTransporter();

        // No SMTP configured — fallback to console log
        if (!transporter) {
            logEmailToConsole(customerEmail, subject, orderData);
            return;
        }

        const fromName  = process.env.EMAIL_FROM_NAME || 'EduShop Support';
        const fromEmail = process.env.EMAIL_USER;

        const mailOptions = {
            from:    `"${fromName}" <${fromEmail}>`,
            to:      customerEmail,
            subject: subject,
            html:    buildOrderConfirmationHTML(orderData),
            text:    `Hi ${orderData.customerName},\n\nYour order #${orderData.orderId} has been successfully placed!\n\nTotal: $${Number(orderData.totalAmount).toFixed(2)}\nShipping to: ${orderData.shippingAddress}\nPayment: ${orderData.paymentMethod}\n\nThank you for shopping with EduShop!`
        };

        await withRetry(async () => {
            await transporter.sendMail(mailOptions);
        }, 3, 1000);

        emailLog('ok', `✅ Order confirmation email sent successfully → ${customerEmail} (Order #${orderData.orderId})`);

    } catch (error) {
        // CRITICAL: Log error but NEVER propagate — order is already saved.
        emailLog('error', `❌ Failed to send order confirmation email after all retries.`);
        emailLog('error', `   Recipient: ${customerEmail} | Order: #${orderData.orderId}`);
        emailLog('error', `   Reason: ${error.message}`);
        emailLog('warn',  '   ⚠️  Order was created successfully. Email failure does not affect the order.');
    }
}

module.exports = {
    sendOrderConfirmationEmail
};
