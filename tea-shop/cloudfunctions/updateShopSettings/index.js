// cloudfunctions/updateShopSettings/index.js
// Update shop settings - only accessible by authorized sellers
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  // 跨账号环境共享时，使用 FROM_OPENID 而不是 OPENID
  const OPENID = wxContext.FROM_OPENID || wxContext.OPENID;
  
  if (!OPENID) {
    return { code: -1, data: null, message: 'User identity verification failed' };
  }

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
      // Settings don't exist yet - create them
      const createData = {
        _id: 'shop',
        name: event.name || '茶语轩',
        isOpen: event.isOpen !== undefined ? event.isOpen : true,
        businessHours: event.businessHours || '09:00-21:00',
        announcement: event.announcement || '欢迎光临茶语轩',
        sellerOpenIds: [OPENID],
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      };
      await db.collection('shop-settings').add({ data: createData });
      return { code: 0, data: createData, message: 'success' };
    }

    if (!isSeller) {
      return { code: -1, data: null, message: 'Permission denied: only seller can update settings' };
    }

    // Build update data from event parameters
    const allowedFields = ['isOpen', 'name', 'businessHours', 'announcement'];
    const updateData = { updatedAt: db.serverDate() };

    for (const field of allowedFields) {
      if (event[field] !== undefined) {
        updateData[field] = event[field];
      }
    }

    await db.collection('shop-settings').doc('shop').update({ data: updateData });

    return { code: 0, data: updateData, message: 'success' };
  } catch (err) {
    console.error('Update shop settings error:', err);
    return { code: -1, data: null, message: err.message || 'Failed to update settings' };
  }
};
