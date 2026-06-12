// pages/order-detail/order-detail.js
const app = getApp()

Page({
  data: {
    order: null,
    statusText: ''
  },

  onLoad(options) {
    // Permission guard for non-tab pages
    if (!app.globalData.isSeller) {
      wx.showModal({
        title: '无权限',
        content: '您不是本店管理员',
        showCancel: false,
        success: () => wx.navigateBack()
      });
      return;
    }

    const id = options.id;
    if (wx.cloud && id) {
      wx.showLoading({ title: '加载中...' });
      const db = wx.cloud.database();
      db.collection('orders').doc(id).get().then(res => {
        wx.hideLoading();
        if (res.data) {
          this._setOrder(res.data);
        } else {
          this._loadFallback(id);
        }
      }).catch(err => {
        wx.hideLoading();
        console.error('Cloud load order error:', err);
        this._loadFallback(id);
      });
    } else {
      this._loadFallback(id);
    }
  },

  _loadFallback(id) {
    const orders = wx.getStorageSync('orders') || [];
    const order = orders.find(o => o._id === id);
    if (order) {
      this._setOrder(order);
    }
  },

  _setOrder(order) {
    const statusMap = {
      pending: '待付款',
      paid: '待发货',
      shipped: '已发货',
      completed: '已完成',
      cancelled: '已取消'
    };

    // Format createdAt for display
    const dateStr = this._formatTime(order.createdAt);

    this.setData({
      order: {
        ...order,
        createdAt: dateStr
      },
      statusText: statusMap[order.status] || '未知'
    });
    if (order.orderNo) {
      wx.setNavigationBarTitle({ title: order.orderNo });
    }
  },

  // Format cloud DB date to readable string
  _formatTime(dateVal) {
    if (!dateVal) return '';
    const d = typeof dateVal === 'string' ? new Date(dateVal) :
              (dateVal instanceof Date ? dateVal : new Date(dateVal));
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  },

  // SECURITY: Status updates MUST go through cloud function for server-side validation
  updateStatus(e) {
    const status = e.currentTarget.dataset.status;
    const order = this.data.order;
    if (!order) return;

    // Route through cloud function first
    if (wx.cloud) {
      wx.showLoading({ title: '处理中...' });
      wx.cloud.callFunction({
        name: 'updateOrderStatus',
        data: { orderId: order._id, status },
        success: (res) => {
          wx.hideLoading();
          if (res.result && res.result.code === 0) {
            this._updateStatusLocal(order, status);
          } else {
            wx.showToast({
              title: (res.result && res.result.message) || '操作失败',
              icon: 'none'
            });
          }
        },
        fail: () => {
          wx.hideLoading();
          this._updateStatusLocal(order, status);
        }
      });
    } else {
      this._updateStatusLocal(order, status);
    }
  },

  // Local fallback for development
  _updateStatusLocal(order, status) {
    order.status = status;
    order.updatedAt = new Date().toISOString();

    const orders = wx.getStorageSync('orders') || [];
    const index = orders.findIndex(o => o._id === order._id);
    if (index >= 0) {
      orders[index] = order;
      wx.setStorageSync('orders', orders);
    }

    const statusMap = {
      pending: '待付款',
      paid: '待发货',
      shipped: '已发货',
      completed: '已完成',
      cancelled: '已取消'
    };

    this.setData({ order, statusText: statusMap[status] });
    wx.showToast({ title: '状态已更新', icon: 'success' });
  },

  // Copy recipient address to clipboard for easy shipping
  copyAddress() {
    const addr = this.data.order.address;
    if (!addr) return;
    const text = addr.name + ' ' + addr.phone + '\n' +
      (addr.province || '') + (addr.city || '') + (addr.district || '') + (addr.detail || '');
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制收货信息', icon: 'success' });
      }
    });
  }
});
