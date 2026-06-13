// cloudfunctions/updateOrderStatus/index.js
// SECURITY: Order status updates with strict identity verification
// - Seller must be verified via OPENID whitelist
// - Buyer can only cancel their own pending orders
// - Status transitions are validated (no skipping states)
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// Valid status transitions map
// New lifecycle: pending → paid → shipped → completed (no "accepted" step)
const VALID_TRANSITIONS = {
  pending: ['paid', 'cancelled'],           // Buyer: pay or cancel
  paid: ['shipped', 'cancelled'],           // Seller: ship or reject
  shipped: ['completed'],                   // Buyer: confirm receipt
  completed: [],                            // Terminal state
  cancelled: []                             // Terminal state
};

exports.main = async (event, context) => {
  // SECURITY RULE 2: Mandatory identity verification
  const wxContext = cloud.getWXContext();
  // 跨账号环境共享时，使用 FROM_OPENID 而不是 OPENID
  const OPENID = wxContext.FROM_OPENID || wxContext.OPENID;
  if (!OPENID) {
    return { code: -1, data: null, message: 'User identity verification failed' };
  }

  const { orderId, status, cancelReason } = event;

  if (!orderId || !status) {
    return { code: -1, data: null, message: 'Missing required parameters' };
  }

  try {
    // Fetch order and verify it exists
    let orderDoc;
    try {
      orderDoc = await db.collection('orders').doc(orderId).get();
    } catch (e) {
      return { code: -1, data: null, message: 'Order not found' };
    }

    const order = orderDoc.data;

    // Validate status transition
    const allowedNextStatuses = VALID_TRANSITIONS[order.status];
    if (!allowedNextStatuses || !allowedNextStatuses.includes(status)) {
      return {
        code: -1,
        data: null,
        message: `Invalid status transition: ${order.status} -> ${status}`
      };
    }

    // Determine who is making the request and verify authorization
    const isBuyer = order.buyerId === OPENID;

    // Check if this OPENID is an authorized seller
    let isSeller = false;
    try {
      const settingsDoc = await db.collection('shop-settings').doc('shop').get();
      if (settingsDoc.data && settingsDoc.data.sellerOpenIds &&
          settingsDoc.data.sellerOpenIds.includes(OPENID)) {
        isSeller = true;
      }
    } catch (e) {
      console.log('Shop settings not found, skipping seller check');
    }

    // Authorization rules:
    // - Buyer can: pay (pending→paid), confirm receipt (shipped→completed), cancel own pending order
    // - Seller can: ship (paid→shipped), cancel/reject paid orders
    if (status === 'paid') {
      // Only the buyer of this order can pay
      if (!isBuyer) {
        return { code: -1, data: null, message: 'Permission denied: only buyer can pay' };
      }
    } else if (status === 'cancelled') {
      // Both buyer (own order) and seller can cancel/reject
      if (order.status === 'pending') {
        if (!isBuyer && !isSeller) {
          return { code: -1, data: null, message: 'Permission denied: not authorized to cancel' };
        }
      } else if (order.status === 'paid') {
        // Only seller can cancel a paid order (rejection)
        if (!isSeller) {
          return { code: -1, data: null, message: 'Permission denied: only seller can reject' };
        }
      }
    } else if (status === 'completed') {
      // Buyer confirms receipt of shipped order, or seller can also complete
      if (!isBuyer && !isSeller) {
        return { code: -1, data: null, message: 'Permission denied: not authorized to complete' };
      }
    } else {
      // All other status changes (ship) require seller authorization
      if (!isSeller) {
        return {
          code: -1,
          data: null,
          message: 'Permission denied: only authorized seller can update order status'
        };
      }
    }

    // All checks passed - update the order
    const updateData = {
      status,
      updatedAt: db.serverDate()
    };

    if (status === 'paid') {
      updateData.paidAt = db.serverDate();
      // TODO: When WeChat Pay is integrated, store payment info here
      // updateData.payment = { method: 'wechat', transactionId: event.transactionId, paidAt: db.serverDate() };
    }

    if (status === 'cancelled') {
      updateData.cancelReason = cancelReason || '';
      updateData.cancelledBy = isBuyer ? 'buyer' : 'seller';

      // Restore product stock if order was cancelled before completion
      if (order.status === 'pending' || order.status === 'paid' || order.status === 'shipped') {
        for (const item of order.items) {
          try {
            await db.collection('products').doc(String(item.productId)).update({
              data: {
                stock: db.command.inc(item.quantity),
                sales: db.command.inc(-item.quantity),
                updatedAt: db.serverDate()
              }
            });
          } catch (e) {
            console.error('Failed to restore stock:', e);
          }
        }
      }
    }

    if (status === 'completed') {
      updateData.completedAt = db.serverDate();
    }

    await db.collection('orders').doc(orderId).update({ data: updateData });

    return {
      code: 0,
      data: { orderId, status },
      message: 'success'
    };
  } catch (err) {
    console.error('Update order status error:', err);
    return {
      code: -1,
      data: null,
      message: err.message || 'Failed to update order status'
    };
  }
};
