// API integration test script for EduShop Portal v2 upgrades
const BASE_URL = 'http://localhost:3001';

async function runTests() {
    console.log('=== STARTING EDUSHOP API INTEGRATION TESTS ===');
    
    // Helper to log test stages
    const testStage = (name) => console.log(`\n---------------- [TEST: ${name}] ----------------`);
    
    // 1. LOGIN CUSTOMER
    testStage('Login Customer');
    let loginToken = '';
    try {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'customer', password: 'customer123' })
        });
        const data = await res.json();
        if (res.status === 200 && data.success) {
            loginToken = data.token;
            console.log('✅ Customer Login Success! Token:', loginToken ? 'Present' : 'Missing');
        } else {
            console.error('❌ Customer Login Failed:', data);
            process.exit(1);
        }
    } catch (e) {
        console.error('❌ Connection/Execution Error during Login:', e.message);
        process.exit(1);
    }
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginToken}`
    };

    // 2. GET PROFILE
    testStage('Get Profile Details');
    try {
        const res = await fetch(`${BASE_URL}/api/profile`, { headers });
        const data = await res.json();
        if (res.status === 200 && data.success) {
            console.log('✅ Get Profile Success! Details:', {
                username: data.profile.username,
                email: data.profile.email,
                full_name: data.profile.full_name,
                phone: data.profile.phone_number,
                address: data.profile.address
            });
        } else {
            console.error('❌ Get Profile Failed:', data);
        }
    } catch (e) {
        console.error('❌ Error getting profile:', e.message);
    }

    // 3. UPDATE PROFILE
    testStage('Update Profile Details');
    try {
        const updatePayload = {
            fullName: 'John Doe Student v2',
            email: 'customer@idpshop.edu',
            phoneNumber: '+880 1812-345678',
            address: 'Lalon Shah Hall, Room 304, RUET Campus'
        };
        const res = await fetch(`${BASE_URL}/api/profile`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updatePayload)
        });
        const data = await res.json();
        if (res.status === 200 && data.success) {
            console.log('✅ Update Profile Success! Message:', data.message);
        } else {
            console.error('❌ Update Profile Failed:', data);
        }
    } catch (e) {
        console.error('❌ Error updating profile:', e.message);
    }

    // 4. CHECK WISHLIST (Expect empty or checks product status)
    testStage('Check Product Wishlist Status');
    const targetProductId = 1; // Engineering Toolkit v3
    try {
        const res = await fetch(`${BASE_URL}/api/wishlist/check?productId=${targetProductId}`, { headers });
        const data = await res.json();
        if (res.status === 200 && data.success) {
            console.log(`✅ Wishlist Check Success! Product ID ${targetProductId} in Wishlist:`, data.inWishlist);
        } else {
            console.error('❌ Wishlist Check Failed:', data);
        }
    } catch (e) {
        console.error('❌ Error checking wishlist:', e.message);
    }

    // 5. ADD TO WISHLIST
    testStage('Add Product to Wishlist');
    try {
        const res = await fetch(`${BASE_URL}/api/wishlist`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ productId: targetProductId })
        });
        const data = await res.json();
        if (res.status === 200 || res.status === 201) {
            console.log('✅ Add Wishlist Success! Response:', data);
        } else {
            console.error('❌ Add Wishlist Failed:', data);
        }
    } catch (e) {
        console.error('❌ Error adding to wishlist:', e.message);
    }

    // 6. CHECK WISHLIST AGAIN (Expect inWishlist to be true)
    testStage('Check Product Wishlist Status Again');
    try {
        const res = await fetch(`${BASE_URL}/api/wishlist/check?productId=${targetProductId}`, { headers });
        const data = await res.json();
        if (res.status === 200 && data.success) {
            console.log(`✅ Wishlist Check 2 Success! Product ID ${targetProductId} in Wishlist:`, data.inWishlist);
        } else {
            console.error('❌ Wishlist Check 2 Failed:', data);
        }
    } catch (e) {
        console.error('❌ Error checking wishlist again:', e.message);
    }

    // 7. GET WISHLIST LIST
    testStage('Get Wishlist Items List');
    try {
        const res = await fetch(`${BASE_URL}/api/wishlist`, { headers });
        const data = await res.json();
        if (res.status === 200 && data.success) {
            console.log('✅ Get Wishlist Success! Items count:', data.wishlist.length);
            data.wishlist.forEach(item => {
                console.log(` - Item ID: ${item.product_id}, Name: ${item.name}, Price: $${item.price}`);
            });
        } else {
            console.error('❌ Get Wishlist Failed:', data);
        }
    } catch (e) {
        console.error('❌ Error fetching wishlist items:', e.message);
    }

    // 8. REMOVE FROM WISHLIST
    testStage('Remove Product from Wishlist');
    try {
        const res = await fetch(`${BASE_URL}/api/wishlist`, {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ productId: targetProductId })
        });
        const data = await res.json();
        if (res.status === 200 && data.success) {
            console.log('✅ Remove Wishlist Success! Message:', data.message);
        } else {
            console.error('❌ Remove Wishlist Failed:', data);
        }
    } catch (e) {
        console.error('❌ Error removing from wishlist:', e.message);
    }

    // 9. TRACK RECENTLY VIEWED PRODUCT
    testStage('Track Recently Viewed Product');
    try {
        const res = await fetch(`${BASE_URL}/api/products/viewed`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ productId: targetProductId })
        });
        const data = await res.json();
        if (res.status === 200 && data.success) {
            console.log(`✅ Track Recently Viewed Success for Product ID ${targetProductId}!`);
        } else {
            console.error('❌ Track Recently Viewed Failed:', data);
        }
    } catch (e) {
        console.error('❌ Error tracking recently viewed:', e.message);
    }

    // 10. GET RECENTLY VIEWED PRODUCTS
    testStage('Get Recently Viewed Products List');
    try {
        const res = await fetch(`${BASE_URL}/api/products/recently-viewed`, { headers });
        const data = await res.json();
        if (res.status === 200 && data.success) {
            console.log('✅ Get Recently Viewed Success! Products count:', data.products.length);
            data.products.forEach(p => {
                console.log(` - Product ID: ${p.id}, Name: ${p.name}, Price: $${p.price}`);
            });
        } else {
            console.error('❌ Get Recently Viewed Failed:', data);
        }
    } catch (e) {
        console.error('❌ Error fetching recently viewed:', e.message);
    }

    // 11. CHECKOUT ORDER FLOW
    testStage('Checkout Order Creation');
    let createdOrderId = null;
    try {
        const orderPayload = {
            items: [{ productId: 2, quantity: 1 }], // Mechanical Drafting Instrument
            shippingInfo: {
                name: 'John Doe Recipient',
                phone: '+880 1812-345678',
                address: 'Lalon Shah Hall, Room 304, RUET Campus'
            },
            paymentMethod: 'MOCK_CARD'
        };
        const res = await fetch(`${BASE_URL}/api/orders`, {
            method: 'POST',
            headers,
            body: JSON.stringify(orderPayload)
        });
        const data = await res.json();
        if (res.status === 201 && data.success) {
            createdOrderId = data.orderId;
            console.log('✅ Order Created Successfully! Order ID:', createdOrderId);
        } else {
            console.error('❌ Order Creation Failed:', data);
        }
    } catch (e) {
        console.error('❌ Error creating checkout order:', e.message);
    }

    // 12. INITIATE PAYMENT FOR ORDER
    if (createdOrderId) {
        testStage('Initiate Order Payment');
        try {
            const paymentPayload = {
                orderId: createdOrderId,
                paymentMethod: 'MOCK_CARD'
            };
            const res = await fetch(`${BASE_URL}/api/payments/initiate`, {
                method: 'POST',
                headers,
                body: JSON.stringify(paymentPayload)
            });
            const data = await res.json();
            if (res.status === 200 && data.success) {
                console.log('✅ Order Payment Initiated! Details:', {
                    method: data.paymentMethod,
                    status: data.paymentStatus,
                    transactionId: data.transactionId,
                    message: data.message
                });
            } else {
                console.error('❌ Order Payment Failed:', data);
            }
        } catch (e) {
            console.error('❌ Error initiating payment:', e.message);
        }
    }

    // 13. FORGOT PASSWORD WORKFLOW
    testStage('Forgot Password Recovery');
    let resetToken = '';
    try {
        const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'customer@idpshop.edu' })
        });
        const data = await res.json();
        if (res.status === 200 && data.success) {
            resetToken = data.resetToken;
            console.log('✅ Forgot Password Token Created! Token:', resetToken ? 'Present' : 'Null (Skipped)');
        } else {
            console.error('❌ Forgot Password Failed:', data);
        }
    } catch (e) {
        console.error('❌ Error in forgot password:', e.message);
    }

    // 14. RESET PASSWORD WORKFLOW
    if (resetToken) {
        testStage('Reset Password with Token');
        try {
            const resetPayload = {
                token: resetToken,
                newPassword: 'customer123new',
                confirmPassword: 'customer123new'
            };
            const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(resetPayload)
            });
            const data = await res.json();
            if (res.status === 200 && data.success) {
                console.log('✅ Password Reset Success! Message:', data.message);
                
                // Let's restore the original password so other tests aren't broken!
                console.log('Restoring password back to customer123...');
                const restoreRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: resetToken,
                        newPassword: 'customer123',
                        confirmPassword: 'customer123'
                    })
                });
                const restoreData = await restoreRes.json();
                console.log('Password Restore status:', restoreData.success ? 'Success' : 'Failed');
            } else {
                console.error('❌ Password Reset Failed:', data);
            }
        } catch (e) {
            console.error('❌ Error resetting password:', e.message);
        }
    }

    console.log('\n=== ALL API TESTS COMPLETED ===');
    process.exit(0);
}

runTests();
