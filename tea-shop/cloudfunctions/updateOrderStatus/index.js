// cloudfunctions/updateOrderStatus/index.js
// SECURITY: Order status updates with strict identity verification
// - Seller must be verified via OPENID whitelist
// - Buyer can only cancel their own pending orders
// - Status transitions are validated (no skipping states)
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// Valid status transitions map
// New lifecycle: pending → paid → shipped → completed (no "accepted" step)
// Cancel flow: pending → cancel_pending → cancelled (seller approves) / pending (seller rejects)
// Refund flow: paid → refund_pending → cancelled (seller approves) / paid (seller rejects)
const VALID_TRANSITIONS = {
  pending: ['paid', 'cancel_pending'],      // Buyer: pay or request cancel
  cancel_pending: ['cancelled', 'pending'], // Seller: approve cancel (→cancelled) or reject (→pending)
  paid: ['shipped', 'refund_pending'],      // Seller: ship; Buyer: request refund
  refund_pending: ['cancelled', 'paid'],    // Seller: approve refund (→cancelled) or reject (→paid)
  shipped: ['completed'],                   // Buyer: confirm receipt (no refund after shipped)
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
    // - Buyer can: pay (pending→paid), request cancel (pending→cancel_pending), request refund (paid→refund_pending), confirm receipt (shipped→completed)
    // - Seller can: ship (paid→shipped), approve cancel (cancel_pending→cancelled), reject cancel (cancel_pending→pending), approve refund (refund_pending→cancelled), reject refund (refund_pending→paid), complete order
    if (status === 'paid') {
      if (order.status === 'refund_pending') {
        // Seller rejecting refund (refund_pending → paid)
        if (!isSeller) {
          return { code: -1, data: null, message: 'Permission denied: only seller can reject refund' };
        }
      } else {
        // Only the buyer of this order can pay (pending → paid)
        if (!isBuyer) {
          return { code: -1, data: null, message: 'Permission denied: only buyer can pay' };
        }
      }
    } else if (status === 'cancel_pending') {
      // Only buyer can request cancel (pending → cancel_pending)
      if (!isBuyer) {
        return { code: -1, data: null, message: 'Permission denied: only buyer can request cancel' };
      }
    } else if (status === 'refund_pending') {
      // Only buyer can request refund (paid → refund_pending)
      if (!isBuyer) {
        return { code: -1, data: null, message: 'Permission denied: only buyer can request refund' };
      }
    } else if (status === 'cancelled') {
      // Only seller can approve cancellation (cancel_pending → cancelled) or refund (refund_pending → cancelled)
      if (order.status === 'cancel_pending') {
        if (!isSeller) {
          return { code: -1, data: null, message: 'Permission denied: only seller can approve cancel' };
        }
      } else if (order.status === 'refund_pending') {
        if (!isSeller) {
          return { code: -1, data: null, message: 'Permission denied: only seller can approve refund' };
        }
      }
      // Note: pending → cancelled is no longer allowed (must go through cancel_pending)
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

    if (status === 'pending') {
      // Seller rejected cancel (cancel_pending → pending)
      if (order.status === 'cancel_pending') {
        updateData.cancelRejectedAt = db.serverDate();
        updateData.cancelRejectedReason = cancelReason || '商家拒绝取消';
        updateData.cancelRequestedAt = db.command.remove();
        updateData.cancelRequestReason = db.command.remove();
      }
    }

    if (status === 'paid') {
      if (order.status === 'refund_pending') {
        // Seller rejected refund — revert to paid, clear refund request
        updateData.refundRejectedAt = db.serverDate();
        updateData.refundRejectedReason = cancelReason || '商家拒绝退款';
        updateData.refundRequestedAt = db.command.remove();
        updateData.refundRequestReason = db.command.remove();
      } else {
        // Buyer paid (pending → paid)
        updateData.paidAt = db.serverDate();
        // TODO: When WeChat Pay is integrated, store payment info here
        // updateData.payment = { method: 'wechat', transactionId: event.transactionId, paidAt: db.serverDate() };
        
        // Mock: Store mock payment info
        updateData.payment = _.set({
          method: 'mock',
          transactionId: 'MOCK_' + Date.now(),
          paidAt: db.serverDate(),
          amount: order.totalPrice
        });
      }
    }

    if (status === 'cancel_pending') {
      // Buyer requested cancel — store request info
      updateData.cancelRequestedAt = db.serverDate();
      updateData.cancelRequestReason = cancelReason || '买家申请取消';
    }

    if (status === 'refund_pending') {
      // Buyer requested refund — store request info
      updateData.refundRequestedAt = db.serverDate();
      updateData.refundRequestReason = cancelReason || '买家申请退款';
    }

    if (status === 'shipped') {
      // Require express company and tracking number when shipping
      const { expressCompany, trackingNo } = event;
      if (!expressCompany || !trackingNo) {
        return { code: -1, data: null, message: 'Express company and tracking number are required for shipping' };
      }
      updateData.shippedAt = db.serverDate();
      updateData.express = _.set({
        company: expressCompany,
        trackingNo: trackingNo,
        shippedAt: db.serverDate()
      });
    }

    if (status === 'cancelled') {
      updateData.cancelReason = cancelReason || '';
      updateData.cancelledBy = isBuyer ? 'buyer' : 'seller';

      // Refund logic: if order was paid or refund_pending, process refund
      if (order.status === 'paid' || order.status === 'refund_pending') {
        // Mock refund: auto-process refund immediately
        updateData.refund = _.set({
          status: 'success',  // success | processing | failed
          amount: order.totalPrice,
          refundId: 'REFUND_MOCK_' + Date.now(),
          refundAt: db.serverDate(),
          reason: cancelReason || (isSeller ? '商家同意退款' : '买家取消订单')
        });
        console.log(`[Refund] Mock refund processed for order ${order.orderNo}:`, updateData.refund);
      }

      // Restore product stock if order was cancelled before completion
      if (order.status === 'pending' || order.status === 'cancel_pending' || order.status === 'paid' || order.status === 'refund_pending' || order.status === 'shipped') {
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
      // Record who confirmed the receipt (buyer / seller / auto)
      updateData.confirmedBy = isSeller ? 'seller' : 'buyer';
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
