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
  { name: '滇红金芽', desc: '云南大叶 金毫显露', price: 188, category: '红茶', sales: 430, stock: 100, status: 'active' },
  { name: '铁观音', desc: '安溪原产 兰香雅韵', price: 228, category: '乌龙茶', sales: 2100, stock: 100, status: 'active' },
  { name: '大红袍', desc: '武夷岩韵 岩骨花香', price: 388, category: '乌龙茶', sales: 1560, stock: 100, status: 'active' },
  { name: '凤凰单丛', desc: '潮州凤凰 丛韵独特', price: 328, category: '乌龙茶', sales: 680, stock: 100, status: 'active' },
  { name: '冻顶乌龙', desc: '台湾高山 滋味醇厚', price: 278, category: '乌龙茶', sales: 520, stock: 100, status: 'active' },
  { name: '白毫银针', desc: '满披白毫 芽头肥壮', price: 488, category: '白茶', sales: 760, stock: 100, status: 'active' },
  { name: '白牡丹', desc: '一芽一二叶 清甜醇爽', price: 268, category: '白茶', sales: 620, stock: 100, status: 'active' },
  { name: '寿眉', desc: '老白茶 陈香药韵', price: 168, category: '白茶', sales: 480, stock: 100, status: 'active' },
  { name: '茉莉龙珠', desc: '茉莉窨制 花香怡人', price: 128, category: '花茶', sales: 1800, stock: 100, status: 'active' },
  { name: '玫瑰花茶', desc: '平阴玫瑰 芬芳馥郁', price: 88, category: '花茶', sales: 1350, stock: 100, status: 'active' },
  { name: '桂花乌龙', desc: '桂花与乌龙的邂逅', price: 108, category: '花茶', sales: 920, stock: 100, status: 'active' },
  { name: '经典名茶礼盒', desc: '六大名茶 精美礼盒', price: 599, category: '礼盒装', sales: 420, stock: 50, status: 'active' },
  { name: '龙井尊享礼盒', desc: '特级龙井 商务之选', price: 388, category: '礼盒装', sales: 350, stock: 50, status: 'active' },
  { name: '大红袍礼盒', desc: '岩茶至尊 送礼佳品', price: 458, category: '礼盒装', sales: 290, stock: 50, status: 'active' },
  { name: '白茶年鉴礼盒', desc: '三年白茶 岁月陈香', price: 528, category: '礼盒装', sales: 210, stock: 50, status: 'active' }
];

const categories = [
  { name: '绿茶', sort: 1 },
  { name: '红茶', sort: 2 },
  { name: '乌龙茶', sort: 3 },
  { name: '白茶', sort: 4 },
  { name: '花茶', sort: 5 },
  { name: '礼盒装', sort: 6 }
];

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
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
