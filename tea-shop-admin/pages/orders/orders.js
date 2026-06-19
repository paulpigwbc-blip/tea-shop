// pages/orders/orders.js
const app = getApp()

Page({
  data: {
    authState: 'loading',
    tabs: ['全部', '待发货', '退款', '已发货', '已完成'],
    tabStatuses: ['all', 'paid', 'refund_related', 'shipped', 'completed'],
    activeTab: 1,  // 默认显示「待发货」
    orders: [],
    filteredOrders: [],
    searchText: ''
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
    const resourceCloud = app.globalData.resourceCloud;
    if (!resourceCloud) {
      console.warn('[Orders] Resource cloud not available');
      return;
    }

    wx.showLoading({ title: '加载中...' });
    const db = resourceCloud.database();
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

  // Search input
  onSearchInput(e) {
    this.setData({ searchText: e.detail.value });
    this.filterOrders();
  },

  // Clear search
  clearSearch() {
    this.setData({ searchText: '' });
    this.filterOrders();
  },

  filterOrders() {
    const status = this.data.tabStatuses[this.data.activeTab];
    const keyword = (this.data.searchText || '').trim().toLowerCase();
    let filtered = this.data.orders;

    if (status !== 'all') {
      if (status === 'refund_related') {
        // 退款相关：退款中 + 已退款
        filtered = filtered.filter(o => o.status === 'refund_pending' || (o.status === 'cancelled' && o.refund));
      } else {
        filtered = filtered.filter(o => o.status === status);
      }
    }

    // Search: orderNo / recipient / tracking / product
    if (keyword) {
      filtered = filtered.filter(o => {
        if ((o.orderNo || '').toLowerCase().includes(keyword)) return true;
        if (o.address && ((o.address.name || '').toLowerCase().includes(keyword) || (o.address.phone || '').includes(keyword))) return true;
        if (o.express && (o.express.trackingNo || '').toLowerCase().includes(keyword)) return true;
        if ((o.items || []).some(i => (i.name || '').toLowerCase().includes(keyword))) return true;
        return false;
      });
    }

    const statusMap = {
      pending: '待付款',
      cancel_pending: '取消申请中',
      paid: '待发货',
      refund_pending: '退款申请中',
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

  // Ship order — navigate to detail page where express form is shown
  shipOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/order-detail/order-detail?id=' + id
    });
  },

  // Complete order
  completeOrder(e) {
    const id = e.currentTarget.dataset.id;
    this.updateStatus(id, 'completed');
  },

  // SECURITY: All status updates MUST go through cloud function first
  updateStatus(id, status) {
    const resourceCloud = app.globalData.resourceCloud;
    if (!resourceCloud) {
      this._updateStatusLocal(id, status);
      return;
    }

    // MUST use resourceCloud (not wx.cloud) for cross-account environment sharing
    wx.showLoading({ title: '处理中...' });
    resourceCloud.callFunction({
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
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
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
  },

  // Show cancel confirmation dialog with reason input
  confirmCancel(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o._id === id);
    if (!order) return;

    wx.showModal({
      title: '拒绝订单',
      content: '',
      editable: true,
      placeholderText: '请输入拒绝原因（可选）',
      confirmText: '确认拒绝',
      confirmColor: '#E54D42',
      success: (res) => {
        if (res.confirm) {
          const cancelReason = res.content || '';
          this._updateStatusWithReason(id, 'cancelled', cancelReason);
        }
      }
    });
  },

  // Update status with cancel reason
  _updateStatusWithReason(id, status, cancelReason) {
    const resourceCloud = app.globalData.resourceCloud;
    if (!resourceCloud) {
      this._updateStatusLocal(id, status);
      return;
    }

    wx.showLoading({ title: '处理中...' });
    resourceCloud.callFunction({
      name: 'updateOrderStatus',
      data: { orderId: id, status, cancelReason },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.code === 0) {
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
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  },

  // Approve refund (refund_pending → cancelled)
  approveRefund(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o._id === id);
    if (!order || order.status !== 'refund_pending') return;

    wx.showModal({
      title: '同意退款',
      content: '确认同意退款？金额 ¥' + order.totalPrice + ' 将退还给买家。',
      confirmText: '同意退款',
      confirmColor: '#7BAF8A',
      success: (res) => {
        if (res.confirm) {
          this._updateStatusWithReason(id, 'cancelled', '商家同意退款');
        }
      }
    });
  },

  // Reject refund (refund_pending → paid)
  rejectRefund(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o._id === id);
    if (!order || order.status !== 'refund_pending') return;

    wx.showModal({
      title: '拒绝退款',
      content: '',
      editable: true,
      placeholderText: '请输入拒绝原因（可选）',
      confirmText: '拒绝退款',
      confirmColor: '#E54D42',
      success: (res) => {
        if (res.confirm) {
          const reason = res.content || '商家拒绝退款';
          this._rejectRefundCall(id, reason);
        }
      }
    });
  },

  // Approve cancel (cancel_pending → cancelled)
  approveCancel(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o._id === id);
    if (!order || order.status !== 'cancel_pending') return;

    wx.showModal({
      title: '同意取消',
      content: '确认同意取消该订单？',
      confirmText: '同意取消',
      confirmColor: '#7BAF8A',
      success: (res) => {
        if (res.confirm) {
          this._updateStatusWithReason(id, 'cancelled', '商家同意取消');
        }
      }
    });
  },

  // Reject cancel (cancel_pending → pending)
  rejectCancel(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o._id === id);
    if (!order || order.status !== 'cancel_pending') return;

    wx.showModal({
      title: '拒绝取消',
      content: '',
      editable: true,
      placeholderText: '请输入拒绝原因（可选）',
      confirmText: '拒绝取消',
      confirmColor: '#E54D42',
      success: (res) => {
        if (res.confirm) {
          const reason = res.content || '商家拒绝取消';
          this._rejectCancelCall(id, reason);
        }
      }
    });
  },

  _rejectCancelCall(id, reason) {
    const resourceCloud = app.globalData.resourceCloud;
    if (!resourceCloud) {
      this._updateStatusLocal(id, 'pending');
      return;
    }

    wx.showLoading({ title: '处理中...' });
    resourceCloud.callFunction({
      name: 'updateOrderStatus',
      data: { orderId: id, status: 'pending', cancelReason: reason },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.code === 0) {
          this._updateStatusLocal(id, 'pending');
        } else {
          wx.showToast({
            title: (res.result && res.result.message) || '操作失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('Reject cancel failed:', err);
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      }
    });
  },

  _rejectRefundCall(id, reason) {
    const resourceCloud = app.globalData.resourceCloud;
    if (!resourceCloud) {
      this._updateStatusLocal(id, 'paid');
      return;
    }

    wx.showLoading({ title: '处理中...' });
    resourceCloud.callFunction({
      name: 'updateOrderStatus',
      data: { orderId: id, status: 'paid', cancelReason: reason },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.code === 0) {
          this._updateStatusLocal(id, 'paid');
        } else {
          wx.showToast({
            title: (res.result && res.result.message) || '操作失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('Reject refund failed:', err);
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      }
    });
  }
});
