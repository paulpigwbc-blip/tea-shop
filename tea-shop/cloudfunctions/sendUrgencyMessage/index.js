// cloudfunctions/sendUrgencyMessage/index.js
// Send urgency reminder message to seller when buyer requests faster shipping
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { orderId, buyerId, autoTrigger = false } = event;

  if (!orderId) {
    return { code: -1, message: '订单ID不能为空' };
  }

  try {
    // 1. Fetch order details
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.data) {
      return { code: -1, message: '订单不存在' };
    }

    const order = orderDoc.data;

    // 2. Check if order is in correct status (paid = 待发货)
    if (order.status !== 'paid') {
      return { code: -1, message: `当前订单状态为${order.status}，无需催单` };
    }

    // 3. Check if buyer is the order owner
    if (buyerId && order.buyerId !== buyerId) {
      return { code: -1, message: '无权催促此订单' };
    }

    // 4. Get seller's OPENIDs (could be multiple)
    const settingsDoc = await db.collection('shop-settings').doc('shop').get();
    if (!settingsDoc.data || !settingsDoc.data.sellerOpenIds) {
      return { code: -1, message: '店铺配置错误' };
    }

    const sellerOpenIds = settingsDoc.data.sellerOpenIds;
    if (sellerOpenIds.length === 0) {
      return { code: -1, message: '没有找到商家账号' };
    }

    // 5. Prepare message template data
    const items = order.items || [];
    const itemNames = items.map(item => item.name).join('、');
    const totalAmount = order.totalPrice;
    const orderNo = order.orderNo;
    
    // Format address
    const addr = order.address || {};
    const addressStr = (addr.province || '') + (addr.city || '') + 
                       (addr.district || '') + (addr.detail || '');
    const recipientStr = addr.name ? `${addr.name} ${addr.phone || ''}` : '未填写';

    // Format time
    const orderTime = order.createdAt ? new Date(order.createdAt) : new Date();
    const timeStr = `${orderTime.getMonth() + 1}月${orderTime.getDate()}日 ${String(orderTime.getHours()).padStart(2, '0')}:${String(orderTime.getMinutes()).padStart(2, '0')}`;

    // 6. Try to send subscription message
    let messageSent = false;
    const results = [];

    for (const sellerOpenId of sellerOpenIds) {
      try {
        // Note: Template ID configured
        const templateId = 'W-O7syPHlj2O0swUboZlUJwfMvELgyI84iYVUWCxJjQ';

        const result = await cloud.openapi.subscribeMessage.send({
          touser: sellerOpenId,
          templateId: templateId,
          page: `pages/order-detail/order-detail?id=${orderId}`,
          data: {
            number1: { value: orderNo },
            thing2: { value: itemNames },
            amount3: { value: `¥${totalAmount}` },
            name4: { value: recipientStr },
            time5: { value: timeStr }
          }
        });

        messageSent = true;
        results.push({ sellerOpenId, success: true, errCode: 0 });
      } catch (err) {
        console.error(`Failed to send message to seller ${sellerOpenId}:`, err);
        results.push({ sellerOpenId, success: false, error: err.errMsg || err.message });
      }
    }

    // 7. Log this urgency attempt
    try {
      await db.collection('urgency-logs').add({
        data: {
          orderId,
          buyerId: order.buyerId,
          autoTrigger,
          messageSent,
          results,
          createdAt: db.serverDate()
        }
      });
    } catch (logErr) {
      // Log collection doesn't exist, skip logging but continue
      console.log('Failed to log urgency attempt:', logErr.message);
    }

    // 8. Update order with last urgency time (for UI display)
    if (!autoTrigger) {
      try {
        await db.collection('orders').doc(orderId).update({
          data: {
            lastUrgencyAt: db.serverDate()
          }
        });
      } catch (updateErr) {
        console.log('Failed to update order lastUrgencyAt:', updateErr.message);
      }
    }

    if (messageSent || autoTrigger) {
      return {
        code: 0,
        message: autoTrigger ? '下单提醒已发送' : '催单消息已发送',
        data: { messageSent, results }
      };
    } else {
      return {
        code: -1,
        message: '消息发送失败，请稍后重试',
        data: { results }
      };
    }
  } catch (err) {
    console.error('Send urgency message error:', err);
    return {
      code: -1,
      message: err.message || '发送催单消息失败'
    };
  }
};