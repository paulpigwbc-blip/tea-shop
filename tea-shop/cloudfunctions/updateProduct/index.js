// cloudfunctions/updateProduct/index.js
// SECURITY: Product updates restricted to verified sellers only
// Cloud functions bypass client-side security rules
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  // 跨账号环境共享时，使用 FROM_OPENID 而不是 OPENID
  const OPENID = wxContext.FROM_OPENID || wxContext.OPENID;
  
  if (!OPENID) {
    return { code: -1, message: '身份验证失败' };
  }

  // Verify seller identity
  try {
    const settingsDoc = await db.collection('shop-settings').doc('shop').get();
    const sellerOpenIds = settingsDoc.data.sellerOpenIds || [];
    if (!sellerOpenIds.includes(OPENID)) {
      return { code: -1, message: '无权限：您不是商家管理员' };
    }
  } catch (e) {
    return { code: -1, message: '权限校验失败，请确认 shop-settings 集合存在: ' + e.message };
  }

  const { productId, productData, isNew } = event;

  // SECURITY: Whitelist allowed fields — prevent injection of unauthorized fields
  const ALLOWED_FIELDS = ['name', 'category', 'price', 'stock', 'description', 'status', 'images', 'coverIndex'];
  const cleanData = {};
  for (const key of ALLOWED_FIELDS) {
    if (productData && productData[key] !== undefined) {
      cleanData[key] = productData[key];
    }
  }

  // Validate required fields
  if (!cleanData.name || !cleanData.category || cleanData.price === undefined) {
    return { code: -1, message: '缺少必要字段：name/category/price' };
  }

  // Validate price and stock are numbers
  cleanData.price = Number(cleanData.price);
  cleanData.stock = Number(cleanData.stock) || 0;
  if (isNaN(cleanData.price) || cleanData.price < 0) {
    return { code: -1, message: '价格无效' };
  }

  // Validate images is an array of strings
  if (cleanData.images && !Array.isArray(cleanData.images)) {
    return { code: -1, message: 'images 格式无效' };
  }

  if (isNew) {
    // Create new product
    const data = {
      ...cleanData,
      sales: 0,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    try {
      const result = await db.collection('products').add({ data });
      return { code: 0, data: { _id: result._id }, message: '创建成功' };
    } catch (err) {
      return { code: -1, message: '创建失败: ' + err.message };
    }
  } else {
    // Update existing product
    if (!productId) {
      return { code: -1, message: '缺少商品ID' };
    }

    const data = {
      ...cleanData,
      updatedAt: db.serverDate()
    };

    try {
      const result = await db.collection('products').doc(productId).update({ data });
      console.log('Update result:', JSON.stringify(result));
      if (result.stats && result.stats.updated === 0) {
        return { code: -1, message: '更新失败：没有记录被修改（文档可能不存在）' };
      }
      return { code: 0, message: '更新成功' };
    } catch (err) {
      return { code: -1, message: '更新失败: ' + err.message };
    }
  }
};
