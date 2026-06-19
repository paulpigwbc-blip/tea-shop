// cloudfunctions/autoConfirmReceipt/index.js
// Timer-triggered cloud function: daily checks for shipped orders older than 7 days
// and auto-confirms receipt (shipped → completed).
//
// TODO: When real express API is integrated, replace time-based logic with
// actual delivery confirmation status from SF Express / other carriers.
// TODO: Add WeChat subscribe message to notify buyer of auto-confirmation.

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const AUTO_CONFIRM_DAYS = 7;

exports.main = async (event, context) => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000);

  // Cloud DB stores dates as server dates; we need to compare with ISO string
  const cutoffISO = cutoff.toISOString();

  console.log(`[AutoConfirm] Checking shipped orders before ${cutoffISO}`);

  try {
    // Query all shipped orders whose shippedAt is older than 7 days
    // Use express.shippedAt if available, otherwise fallback to shippedAt field
    const result = await db.collection('orders')
      .where(_.and([
        { status: 'shipped' },
        _.or([
          { shippedAt: _.lt(cutoffISO) },
          { 'express.shippedAt': _.lt(cutoffISO) }
        ])
      ]))
      .limit(100)
      .get();

    const orders = result.data || [];
    console.log(`[AutoConfirm] Found ${orders.length} orders eligible for auto-confirm`);

    let confirmed = 0;
    let failed = 0;

    for (const order of orders) {
      try {
        await db.collection('orders').doc(order._id).update({
          data: {
            status: 'completed',
            completedAt: db.serverDate(),
            autoConfirmed: true,
            confirmedBy: 'auto',
            updatedAt: db.serverDate()
          }
        });

        // TODO: Send WeChat subscribe message to buyer
        // await cloud.openapi.subscribeMessage.send({
        //   touser: order.buyerId,
        //   templateId: 'YOUR_TEMPLATE_ID',
        //   page: `/pages/order-detail/order-detail?id=${order._id}`,
        //   data: {
        //     thing1: { value: order.orderNo },
        //     phrase2: { value: '已自动确认收货' },
        //     time3: { value: new Date().toLocaleString('zh-CN') }
        //   }
        // });

        confirmed++;
        console.log(`[AutoConfirm] Confirmed: ${order._id} (${order.orderNo})`);
      } catch (e) {
        failed++;
        console.error(`[AutoConfirm] Failed to confirm ${order._id}:`, e);
      }
    }

    return {
      code: 0,
      data: {
        checked: orders.length,
        confirmed,
        failed,
        cutoffDate: cutoffISO
      },
      message: `Auto-confirmed ${confirmed}/${orders.length} orders`
    };
  } catch (err) {
    console.error('[AutoConfirm] Error:', err);
    return {
      code: -1,
      data: null,
      message: err.message || 'Auto-confirm failed'
    };
  }
};
