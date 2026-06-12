// pages/statistics/statistics.js
const app = getApp()

Page({
  data: {
    // Revenue cards
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    todayOrders: 0,
    weekOrders: 0,
    monthOrders: 0,

    // Revenue trend chart (last 7 days)
    trendLabels: [],
    trendValues: [],
    trendMax: 0,

    // Product ranking
    productRankByRevenue: [],   // Top products by revenue
    productRankByQuantity: [],  // Top products by quantity

    // Category breakdown
    categoryData: [],

    // Key metrics
    avgOrderValue: 0,
    completionRate: 0,
    totalOrders: 0,
    totalRevenue: 0,

    loading: true
  },

  onLoad() {
    if (!app.globalData.isSeller) {
      wx.showModal({
        title: '无权限',
        content: '您不是本店管理员',
        showCancel: false,
        success: () => wx.navigateBack()
      });
      return;
    }
    this.loadStatistics();
  },

  loadStatistics() {
    if (wx.cloud) {
      wx.showLoading({ title: '加载中...' });
      const db = wx.cloud.database();
      // Fetch all paid+ orders (max 1000 — enough for small shop)
      db.collection('orders')
        .where({ status: db.command.in(['paid', 'shipped', 'completed']) })
        .orderBy('createdAt', 'desc')
        .limit(1000)
        .get()
        .then(res => {
          wx.hideLoading();
          this._processData(res.data || []);
        })
        .catch(err => {
          wx.hideLoading();
          console.error('Load statistics error:', err);
          this._processData([]);
        });
    } else {
      const orders = (wx.getStorageSync('orders') || [])
        .filter(o => ['paid', 'shipped', 'completed'].includes(o.status));
      this._processData(orders);
    }
  },

  _processData(orders) {
    const now = new Date();

    // === Time boundaries (UTC+8) ===
    const utc8 = (d) => new Date(d.getTime() + 8 * 60 * 60 * 1000);
    const todayStr = utc8(now).toISOString().slice(0, 10);
    const todayStart = new Date(todayStr + 'T00:00:00.000Z');

    // This week (Monday start)
    const dayOfWeek = utc8(now).getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(todayStart.getTime() - mondayOffset * 24 * 60 * 60 * 1000);

    // This month
    const monthStr = todayStr.slice(0, 7); // "YYYY-MM"
    const monthStart = new Date(monthStr + '-01T00:00:00.000Z');

    // === Filter by period ===
    const todayOrders = orders.filter(o => new Date(o.createdAt) >= todayStart);
    const weekOrders = orders.filter(o => new Date(o.createdAt) >= weekStart);
    const monthOrders = orders.filter(o => new Date(o.createdAt) >= monthStart);

    const sumRevenue = (list) => list.reduce((s, o) => s + (o.totalPrice || 0), 0);

    // === Revenue trend (last 7 days) ===
    const trendLabels = [];
    const trendValues = [];
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      const nextDay = new Date(dayDate.getTime() + 24 * 60 * 60 * 1000);
      const label = i === 0 ? '今天' : '周' + dayNames[utc8(dayDate).getUTCDay()];
      trendLabels.push(label);
      const dayRevenue = orders
        .filter(o => { const d = new Date(o.createdAt); return d >= dayDate && d < nextDay; })
        .reduce((s, o) => s + (o.totalPrice || 0), 0);
      trendValues.push(Math.round(dayRevenue * 100) / 100);
    }
    const trendMax = Math.max(...trendValues, 1);

    // === Product ranking ===
    const productMap = {};
    const categoryMap = {};

    orders.forEach(order => {
      (order.items || []).forEach(item => {
        const key = item.name || item.productId;
        if (!productMap[key]) {
          productMap[key] = { name: key, quantity: 0, revenue: 0, orders: 0 };
        }
        productMap[key].quantity += (item.quantity || 0);
        productMap[key].revenue += (item.price || 0) * (item.quantity || 0);
        productMap[key].orders += 1;
      });

      // Category from product data — use first character or type field if available
      // Since we don't have category in order items, we'll derive from product name prefix
      // For now, aggregate by the product name's first meaningful category
    });

    // Get product details from DB for category info
    this._enrichWithCategories(productMap, orders);

    // Sort products
    const productRankByRevenue = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(p => ({ ...p, revenueStr: '¥' + p.revenue.toFixed(2) }));

    const productRankByQuantity = Object.values(productMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map(p => ({ ...p, revenueStr: '¥' + p.revenue.toFixed(2) }));

    // === Key metrics ===
    const totalRevenue = sumRevenue(orders);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;
    const completedOrders = orders.filter(o => o.status === 'completed').length;
    const completionRate = totalOrders > 0 ? Math.round(completedOrders / totalOrders * 100) : 0;

    this.setData({
      todayRevenue: sumRevenue(todayOrders).toFixed(2),
      weekRevenue: sumRevenue(weekOrders).toFixed(2),
      monthRevenue: sumRevenue(monthOrders).toFixed(2),
      todayOrders: todayOrders.length,
      weekOrders: weekOrders.length,
      monthOrders: monthOrders.length,
      trendLabels,
      trendValues,
      trendMax,
      productRankByRevenue,
      productRankByQuantity,
      avgOrderValue: avgOrderValue.toFixed(2),
      completionRate,
      totalOrders,
      totalRevenue: totalRevenue.toFixed(2),
      loading: false
    });
  },

  // Enrich product data with category info from products collection
  _enrichWithCategories(productMap, orders) {
    if (!wx.cloud) return;
    const db = wx.cloud.database();
    db.collection('products').limit(200).get().then(res => {
      const products = res.data || [];
      const categoryMap = {};

      // Map product names to categories
      const nameToCategory = {};
      products.forEach(p => {
        nameToCategory[p.name] = p.category || '其他';
      });

      // Build category aggregation
      Object.keys(productMap).forEach(key => {
        const cat = nameToCategory[key] || '其他';
        if (!categoryMap[cat]) {
          categoryMap[cat] = { name: cat, quantity: 0, revenue: 0 };
        }
        categoryMap[cat].quantity += productMap[key].quantity;
        categoryMap[cat].revenue += productMap[key].revenue;
      });

      const totalCatRevenue = Object.values(categoryMap).reduce((s, c) => s + c.revenue, 0);
      const categoryData = Object.values(categoryMap)
        .sort((a, b) => b.revenue - a.revenue)
        .map(c => ({
          ...c,
          revenueStr: '¥' + c.revenue.toFixed(2),
          percent: totalCatRevenue > 0 ? Math.round(c.revenue / totalCatRevenue * 100) : 0
        }));

      this.setData({ categoryData });
    }).catch(() => {});
  },

  // Tab switching for product rank
  switchRankTab(e) {
    this.setData({ rankTab: e.currentTarget.dataset.tab });
  }
});
