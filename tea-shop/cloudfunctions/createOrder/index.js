// cloudfunctions/createOrder/index.js
// SECURITY: This function handles order creation with full validation
// - Identity verification via OPENID
// - Server-side price recalculation (NEVER trust frontend prices)
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

  const { items, note, address, type = 'delivery', buyerInfo } = event;

  try {
    // Input validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return { code: -1, data: null, message: 'Invalid order items' };
    }

    // Delivery-only: address is required
    if (!address) {
      return { code: -1, data: null, message: '请选择收货地址' };
    }

    // Fetch all active products from database for price lookup
    const allProductsResult = await db.collection('products')
      .where({ status: 'active' })
      .limit(100)
      .get();
    const allProducts = allProductsResult.data;

    // SECURITY RULE 5: Server-side price recalculation
    // NEVER trust frontend price - recalculate from database
    let serverTotalPrice = 0;
    const validatedItems = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return { code: -1, data: null, message: 'Invalid item data' };
      }

      // Find product by _id (cloud DB auto-generated ID)
      const product = allProducts.find(p => p._id === String(item.productId));

      if (!product) {
        return { code: -1, data: null, message: 'Product not found: ' + item.productId };
      }

      // Check stock
      if (product.stock !== undefined && product.stock < item.quantity) {
        return { code: -1, data: null, message: 'Insufficient stock for: ' + product.name };
      }

      // Use SERVER-SIDE price, not the one from frontend
      const serverPrice = product.price;
      serverTotalPrice += serverPrice * item.quantity;

      validatedItems.push({
        productId: product._id,
        name: product.name,
        price: serverPrice,
        quantity: item.quantity,
        image: product.images ? (product.images[product.coverIndex || 0] || product.images[0]) : ''
      });
    }

    // Generate order number
    const now = new Date();
    const dateStr = '' + now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const count = await db.collection('orders').count();
    const orderNo = 'T' + dateStr + String(count.total + 1).padStart(3, '0');

    // Build address data (stored directly — DB security rules protect access)
    let orderAddress = null;
    if (address) {
      orderAddress = {
        province: address.province || '',
        city: address.city || '',
        district: address.district || '',
        name: address.name || '',
        phone: address.phone || '',
        detail: address.detail || '',
        isDefault: address.isDefault || false
      };
    }

    // Build buyer info
    let orderBuyerInfo = {};
    if (buyerInfo) {
      orderBuyerInfo = {
        name: buyerInfo.name || '',
        phone: buyerInfo.phone || ''
      };
    }

    const order = {
      orderNo,
      buyerId: OPENID,  // SECURITY: Always use server-side OPENID
      buyerInfo: orderBuyerInfo,
      items: validatedItems,
      totalPrice: Number(serverTotalPrice.toFixed(2)),  // SECURITY: Server-calculated price
      status: 'pending',
      note: note || '',
      address: orderAddress,
      type,
      payment: null,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
      completedAt: null
    };

    const result = await db.collection('orders').add({ data: order });

    // Update product stock and sales (server-side only)
    for (let i = 0; i < validatedItems.length; i++) {
      const item = validatedItems[i];
      try {
        await db.collection('products').doc(item.productId).update({
          data: {
            sales: _.inc(item.quantity),
            stock: _.inc(-item.quantity),
            updatedAt: db.serverDate()
          }
        });
      } catch (e) {
        console.error('Failed to update product stock:', e);
      }
    }

    // Auto-send urgency reminder to seller on order creation
    // This helps seller ship faster, improving buyer experience
    try {
      await cloud.callFunction({
        name: 'sendUrgencyMessage',
        data: {
          orderId: result._id,
          autoTrigger: true  // Indicates this is automatic, not buyer-triggered
        }
      });
    } catch (e) {
      // Don't block order creation if message fails
      console.error('Failed to send auto urgency message:', e);
    }

    return {
      code: 0,
      data: {
        orderId: result._id,
        orderNo,
        totalPrice: order.totalPrice
      },
      message: 'success'
    };
  } catch (err) {
    console.error('Create order error:', err);
    return {
      code: -1,
      data: null,
      message: err.message || 'Failed to create order'
    };
  }
};
