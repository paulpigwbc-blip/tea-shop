// pages/dashboard/dashboard.js
const app = getApp()

Page({
  data: {
    authState: 'loading',  // 'loading' | 'allowed' | 'denied'
    todayOrders: 0,
    todayRevenue: 0,
    paidCount: 0,
    shippedCount: 0,
    completedCount: 0,
    recentOrders: [],
    shopOpen: true,
    loading: true
  },

  onLoad() {
    this._checkAuth();
  },

  onShow() {
    // Re-check auth when page becomes visible (in case it changed)
    if (app.globalData.authChecked) {
      this._onAuthResult(app.globalData.isSeller);
    }
  },

  // Permission guard: check auth state
  _checkAuth() {
    if (app.globalData.authChecked) {
      this._onAuthResult(app.globalData.isSeller);
    }
    // If not checked yet, app.js will call _onAuthResult when ready
  },

  // Called by app.js when auth check completes
  _onAuthResult(isSeller) {
    if (isSeller) {
      this.setData({ authState: 'allowed' });
      this.loadDashboard();
    } else {
      this.setData({ authState: 'denied' });
    }
  },

  loadDashboard() {
    if (wx.cloud) {
      this.setData({ loading: true });
      wx.cloud.callFunction({
        name: 'getStatistics',
        success: (res) => {
          if (res.result && res.result.code === 0) {
            this._applyStatistics(res.result.data);
          } else {
            console.warn('getStatistics failed:', res.result && res.result.message);
            this._loadDirectDB();
          }
        },
        fail: (err) => {
          console.error('Cloud call getStatistics error:', err);
          this._loadDirectDB();
        }
      });
    } else {
      this._loadFallback();
    }

    // Load shop settings from cloud DB
    this._loadShopSettings();
  },

  // Apply statistics data from getStatistics cloud function
  _applyStatistics(d) {
    const recentOrders = (d.recentOrders || []).map(o => ({
      ...o,
      statusText: this.getStatusText(o.status),
      timeStr: this.formatTime(o.createdAt)
    }));

    this.setData({
      todayOrders: d.today.orderCount,
      todayRevenue: d.today.totalRevenue,
      paidCount: d.paidCount || 0,
      shippedCount: d.shippedCount || 0,
      completedCount: d.today.completedCount || 0,
      recentOrders,
      loading: false
    });
  },

  // Direct DB query fallback (bypasses getStatistics cloud function)
  _loadDirectDB() {
    if (!wx.cloud) return this._loadFallback();
    const db = wx.cloud.database();
    const _ = db.command;

    // Use UTC+8 (China Standard Time) for "today" boundary
    const now = new Date();
    const utc8Now = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayStr = utc8Now.toISOString().slice(0, 10);
    const todayStart = new Date(todayStr + 'T00:00:00.000Z');

    Promise.all([
      // Today's orders
      db.collection('orders').where({ createdAt: _.gte(todayStart) }).get(),
      // Recent 10 orders
      db.collection('orders').orderBy('createdAt', 'desc').limit(10).get(),
      // ALL paid orders (待发货)
      db.collection('orders').where({ status: 'paid' }).count(),
      // ALL shipped orders
      db.collection('orders').where({ status: 'shipped' }).count()
    ]).then(([todayRes, recentRes, paidRes, shippedRes]) => {
      const todayOrders = todayRes.data || [];

      // Revenue: only count orders that have been paid (paid/shipped/completed)
      const paidStatuses = ['paid', 'shipped', 'completed'];
      const totalRevenue = todayOrders
        .filter(o => paidStatuses.includes(o.status))
        .reduce((sum, o) => sum + (o.totalPrice || 0), 0);
      const completedCount = todayOrders.filter(o => o.status === 'completed').length;

      const recentOrders = (recentRes.data || []).map(o => ({
        ...o,
        statusText: this.getStatusText(o.status),
        timeStr: this.formatTime(o.createdAt)
      }));

      this.setData({
        todayOrders: todayOrders.length,
        todayRevenue: Number(totalRevenue.toFixed(2)),
        paidCount: paidRes.total,
        shippedCount: shippedRes.total,
        completedCount,
        recentOrders,
        loading: false
      });
    }).catch(err => {
      console.error('Direct DB query error:', err);
      this._loadFallback();
    });
  },

  // Fallback: read from local storage when cloud is unavailable
  _loadFallback() {
    const orders = wx.getStorageSync('orders') || [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todayOrders = orders.filter(o => new Date(o.createdAt) >= todayStart);

    // Revenue: only count orders that have been paid (paid/shipped/completed)
    const paidStatuses = ['paid', 'shipped', 'completed'];
    const todayRevenue = todayOrders
      .filter(o => paidStatuses.includes(o.status))
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    // Count ALL orders by status (not just today's)
    const paidCount = orders.filter(o => o.status === 'paid').length;
    const shippedCount = orders.filter(o => o.status === 'shipped').length;
    const completedCount = todayOrders.filter(o => o.status === 'completed').length;

    const recentOrders = orders.slice(0, 5).map(o => ({
      ...o,
      statusText: this.getStatusText(o.status),
      timeStr: this.formatTime(o.createdAt)
    }));

    this.setData({
      todayOrders: todayOrders.length,
      todayRevenue: Number(todayRevenue.toFixed(2)),
      paidCount,
      shippedCount,
      completedCount,
      recentOrders,
      loading: false
    });
  },

  _loadShopSettings() {
    if (!wx.cloud) return;
    const db = wx.cloud.database();
    db.collection('shop-settings').doc('shop').get().then(res => {
      if (res.data) {
        app.globalData.shopSettings = res.data;
        this.setData({ shopOpen: res.data.isOpen !== false });
      }
    }).catch(() => {});
  },

  getStatusText(status) {
    const map = {
      pending: '待付款',
      paid: '待发货',
      shipped: '已发货',
      completed: '已完成',
      cancelled: '已取消'
    };
    return map[status] || '未知';
  },

  // Format cloud DB date (ISO string or Date object) to readable string
  formatTime(dateVal) {
    if (!dateVal) return '';
    const d = typeof dateVal === 'string' ? new Date(dateVal) : (dateVal instanceof Date ? dateVal : new Date(dateVal));
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  // Toggle shop open/close
  toggleShop() {
    const isOpen = !this.data.shopOpen;
    app.globalData.shopSettings.isOpen = isOpen;
    wx.setStorageSync('shopSettings', app.globalData.shopSettings);
    this.setData({ shopOpen: isOpen });

    if (wx.cloud) {
      wx.cloud.callFunction({
        name: 'updateShopSettings',
        data: { isOpen }
      });
    }

    wx.showToast({
      title: isOpen ? '已开始营业' : '已暂停营业',
      icon: 'success'
    });
  },

  // Navigate to order detail
  goToOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/order-detail/order-detail?id=' + id
    });
  },

  // Navigate to statistics page
  goToStatistics() {
    wx.navigateTo({
      url: '/pages/statistics/statistics'
    });
  },

  // Navigate to orders page with filter
  goToOrders(e) {
    const tabIndex = e.currentTarget.dataset.tab;
    if (tabIndex !== undefined) {
      app.globalData.ordersTabIndex = Number(tabIndex);
    }
    wx.switchTab({
      url: '/pages/orders/orders'
    });
  }
});
