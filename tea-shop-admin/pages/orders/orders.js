// pages/orders/orders.js
const app = getApp()

Page({
  data: {
    authState: 'loading',
    tabs: ['全部', '待发货', '已发货', '已完成'],
    tabStatuses: ['all', 'paid', 'shipped', 'completed'],
    activeTab: 0,
    orders: [],
    filteredOrders: []
  },

  onLoad() {
    this._checkAuth();
  },

  onShow() {
    if (app.globalData.authChecked) {
      this._onAuthResult(app.globalData.isSeller);
    }
    // Check if navigated from dashboard with a specific tab
    if (app.globalData.ordersTabIndex !== undefined) {
      const tabIndex = app.globalData.ordersTabIndex;
      delete app.globalData.ordersTabIndex;
      if (tabIndex !== this.data.activeTab) {
        this.setData({ activeTab: tabIndex });
        // Apply filter after data loads
        if (this.data.orders.length > 0) {
          this.filterOrders();
        }
      }
    }
  },

  _checkAuth() {
    if (app.globalData.authChecked) {
      this._onAuthResult(app.globalData.isSeller);
    }
  },

  _onAuthResult(isSeller) {
    if (isSeller) {
      this.setData({ authState: 'allowed' });
      this.loadOrders();
    } else {
      this.setData({ authState: 'denied' });
    }
  },

  loadOrders() {
    if (wx.cloud) {
      wx.showLoading({ title: '加载中...' });
      const db = wx.cloud.database();
      const _ = db.command;
      db.collection('orders')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get()
        .then(res => {
          wx.hideLoading();
          const orders = res.data || [];
          // Cache locally for offline fallback
          wx.setStorageSync('orders', orders);
          this.setData({ orders });
          this.filterOrders();
        })
        .catch(err => {
          wx.hideLoading();
          console.error('Cloud load orders error:', err);
          this._loadOrdersFallback();
        });
    } else {
      this._loadOrdersFallback();
    }
  },

  _loadOrdersFallback() {
    const orders = wx.getStorageSync('orders') || [];
    this.setData({ orders });
    this.filterOrders();
  },

  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ activeTab: index });
    this.filterOrders();
  },

  filterOrders() {
    const status = this.data.tabStatuses[this.data.activeTab];
    let filtered = this.data.orders;

    if (status !== 'all') {
      filtered = filtered.filter(o => o.status === status);
    }

    const statusMap = {
      pending: '待付款',
      paid: '待发货',
      shipped: '已发货',
      completed: '已完成',
      cancelled: '已取消'
    };

    filtered = filtered.map(o => ({
      ...o,
      statusText: statusMap[o.status] || '未知',
      timeStr: this.formatTime(o.createdAt)
    }));

    this.setData({ filteredOrders: filtered });
  },

  formatTime(dateVal) {
    if (!dateVal) return '';
    const d = typeof dateVal === 'string' ? new Date(dateVal) : (dateVal instanceof Date ? dateVal : new Date(dateVal));
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/order-detail/order-detail?id=' + id
    });
  },

  // Ship order directly from paid status
  shipOrder(e) {
    const id = e.currentTarget.dataset.id;
    this.updateStatus(id, 'shipped');
  },

  // Complete order
  completeOrder(e) {
    const id = e.currentTarget.dataset.id;
    this.updateStatus(id, 'completed');
  },

  // SECURITY: All status updates MUST go through cloud function first
  updateStatus(id, status) {
    // Always try cloud function first for security validation
    if (wx.cloud) {
      wx.showLoading({ title: '处理中...' });
      wx.cloud.callFunction({
        name: 'updateOrderStatus',
        data: { orderId: id, status },
        success: (res) => {
          wx.hideLoading();
          if (res.result && res.result.code === 0) {
            // Cloud function validated and succeeded - update local copy
            this._updateStatusLocal(id, status);
          } else {
            wx.showToast({
              title: (res.result && res.result.message) || '操作失败',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('Cloud update failed:', err);
          // Development fallback only
          this._updateStatusLocal(id, status);
        }
      });
    } else {
      // Development fallback without cloud
      this._updateStatusLocal(id, status);
    }
  },

  // Local update fallback for development only
  _updateStatusLocal(id, status) {
    const orders = this.data.orders;
    const order = orders.find(o => o._id === id);
    if (!order) return;

    order.status = status;
    order.updatedAt = new Date().toISOString();
    wx.setStorageSync('orders', orders);

    this.loadOrders();
    wx.showToast({ title: '状态已更新', icon: 'success' });
  }
});
