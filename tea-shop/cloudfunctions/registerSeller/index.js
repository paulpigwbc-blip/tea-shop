// cloudfunctions/registerSeller/index.js
// Register the calling user as an authorized seller
// This should be called from the admin mini program
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  // 跨账号环境共享时，使用 FROM_OPENID 而不是 OPENID
  const OPENID = wxContext.FROM_OPENID || wxContext.OPENID;
  
  if (!OPENID) {
    return { code: -1, data: null, message: '无法获取用户身份', openid: null };
  }

  // Always return OPENID so admin app can display it for manual setup
  try {
    // Get current shop settings
    let settings;
    try {
      const res = await db.collection('shop-settings').doc('shop').get();
      settings = res.data;
    } catch (e) {
      // Shop settings don't exist yet - create it
      await db.collection('shop-settings').add({
        data: {
          _id: 'shop',
          name: '茶语轩',
          isOpen: true,
          businessHours: '09:00-21:00',
          announcement: '欢迎光临茶语轩',
          sellerOpenIds: [OPENID],
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      return { code: 0, data: { registered: true }, message: '商家身份注册成功', openid: OPENID };
    }

    // Check if already registered
    const sellerOpenIds = settings.sellerOpenIds || [];
    if (sellerOpenIds.includes(OPENID)) {
      return { code: 0, data: { alreadyRegistered: true }, message: '已经是商家用户', openid: OPENID };
    }

    // Add to seller list
    await db.collection('shop-settings').doc('shop').update({
      data: {
        sellerOpenIds: _.push(OPENID),
        updatedAt: db.serverDate()
      }
    });

    return { code: 0, data: { registered: true }, message: '商家身份注册成功', openid: OPENID };
  } catch (err) {
    console.error('Register seller error:', err);
    return {
      code: -1,
      data: null,
      message: err.message || '注册失败',
      openid: OPENID
    };
  }
};
