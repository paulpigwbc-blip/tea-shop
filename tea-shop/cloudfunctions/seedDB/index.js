// cloudfunctions/seedDB/index.js
// One-time setup: populate database with initial products and shop settings
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const products = [
  { name: '西湖龙井', desc: '明前特级 鲜爽回甘', price: 268, category: '绿茶', sales: 1580, stock: 100, status: 'active' },
  { name: '碧螺春', desc: '洞庭东山 嫩香清雅', price: 198, category: '绿茶', sales: 920, stock: 100, status: 'active' },
  { name: '黄山毛峰', desc: '高山云雾 清香持久', price: 158, category: '绿茶', sales: 760, stock: 100, status: 'active' },
  { name: '信阳毛尖', desc: '核心产区 鲜浓甘爽', price: 138, category: '绿茶', sales: 650, stock: 100, status: 'active' },
  { name: '正山小种', desc: '桐木关原产 松烟香', price: 298, category: '红茶', sales: 1320, stock: 100, status: 'active' },
  { name: '金骏眉', desc: '芽头金黄 蜜香馥郁', price: 599, category: '红茶', sales: 890, stock: 100, status: 'active' },
  { name: '祁门红茶', desc: '祁红特绝 似花似蜜', price: 258, category: '红茶', sales: 540, stock: 100, status: 'active' },
  { name: '滇红金芽', desc: '云南大叶 金毫显露', price: 188, category: '红茶', sales: 430, stock: 100, status: 'active' }
];

const categories = [
  { name: '绿茶', sort: 1 },
  { name: '红茶', sort: 2 }
];

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  // 跨账号环境共享时，使用 FROM_OPENID 而不是 OPENID
  const OPENID = wxContext.FROM_OPENID || wxContext.OPENID;
  const results = { products: 0, categories: 0, shopSettings: false };

  // 1. Add products
  for (const product of products) {
    try {
      await db.collection('products').add({
        data: {
          ...product,
          images: [],
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      results.products++;
    } catch (e) {
      console.error('Failed to add product:', product.name, e.message);
    }
  }

  // 2. Add categories
  for (const cat of categories) {
    try {
      await db.collection('categories').add({
        data: {
          ...cat,
          createdAt: db.serverDate()
        }
      });
      results.categories++;
    } catch (e) {
      console.error('Failed to add category:', cat.name, e.message);
    }
  }

  // 3. Add shop settings with current user as seller
  try {
    await db.collection('shop-settings').add({
      data: {
        _id: 'shop',
        name: '茶语轩',
        isOpen: true,
        businessHours: '09:00-21:00',
        announcement: '欢迎光临茶语轩',
        sellerOpenIds: [OPENID],  // Auto-add current user as seller
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    results.shopSettings = true;
  } catch (e) {
    console.error('Failed to add shop settings:', e.message);
    // Try update if already exists
    try {
      await db.collection('shop-settings').doc('shop').update({
        data: { sellerOpenIds: [OPENID] }
      });
      results.shopSettings = true;
    } catch (e2) {
      console.error('Failed to update shop settings:', e2.message);
    }
  }

  return {
    code: 0,
    data: results,
    message: `Seed complete: ${results.products} products, ${results.categories} categories, shopSettings: ${results.shopSettings}`
  };
};
