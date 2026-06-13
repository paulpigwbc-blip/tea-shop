// cloudfunctions/getStatistics/index.js
// SECURITY: Shop statistics - only accessible by authorized sellers
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  // SECURITY RULE 2: Mandatory identity verification
  const wxContext = cloud.getWXContext();
  // 跨账号环境共享时，使用 FROM_OPENID 而不是 OPENID
  const OPENID = wxContext.FROM_OPENID || wxContext.OPENID;
  
  if (!OPENID) {
    return { code: -1, data: null, message: 'User identity verification failed' };
  }

  console.log('[getStatistics] Checking permissions for OPENID:', OPENID);

  try {
    // Verify seller authorization
    let isSeller = false;
    try {
      const settingsDoc = await db.collection('shop-settings').doc('shop').get();
      if (settingsDoc.data && settingsDoc.data.sellerOpenIds &&
          settingsDoc.data.sellerOpenIds.includes(OPENID)) {
        isSeller = true;
      }
    } catch (e) {
      console.log('Shop settings not found');
    }

    if (!isSeller) {
      return { code: -1, data: null, message: 'Permission denied: only seller can view statistics' };
    }

    // Use UTC+8 (China Standard Time) for "today" boundary
    const now = new Date();
    const utc8Now = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayStr = utc8Now.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const todayStart = new Date(todayStr + 'T00:00:00.000Z');

    // Today's orders (all statuses for order count, only paid+ for revenue)
    const todayOrders = await db.collection('orders').where({
      createdAt: _.gte(todayStart)
    }).get();

    const orders = todayOrders.data;
    const orderCount = orders.length;

    // Revenue: only count orders that have been paid (paid/shipped/completed)
    const paidStatuses = ['paid', 'shipped', 'completed'];
    const totalRevenue = orders
      .filter(o => paidStatuses.includes(o.status))
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    // Count by status (ALL orders, not just today's — shop needs to see all unprocessed)
    const [pendingRes, paidRes, shippedRes] = await Promise.all([
      db.collection('orders').where({ status: 'pending' }).count(),
      db.collection('orders').where({ status: 'paid' }).count(),
      db.collection('orders').where({ status: 'shipped' }).count()
    ]);

    const todayCompletedCount = orders.filter(o => o.status === 'completed').length;

    // All orders count
    const allOrders = await db.collection('orders').count();

    // Recent orders
    const recentOrders = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    return {
      code: 0,
      data: {
        today: {
          orderCount,
          totalRevenue: Number(totalRevenue.toFixed(2)),
          completedCount: todayCompletedCount
        },
        pendingCount: pendingRes.total,
        paidCount: paidRes.total,
        shippedCount: shippedRes.total,
        totalOrders: allOrders.total,
        recentOrders: recentOrders.data
      },
      message: 'success'
    };
  } catch (err) {
    console.error('Get statistics error:', err);
    return {
      code: -1,
      data: null,
      message: err.message || 'Failed to get statistics'
    };
  }
};
