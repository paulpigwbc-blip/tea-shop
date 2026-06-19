// pages/order-detail/order-detail.js
const app = getApp()

Page({
  data: {
    order: null,
    statusText: '',
    timeline: [],
    // Express shipping form
    showShipForm: false,
    expressCompanies: ['顺丰速运', '中通快递', '圆通速递', '韵达快递', '申通快递', '京东物流', 'EMS'],
    expressIndex: 0,
    expressCompany: '顺丰速运',
    trackingNo: ''
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
    const resourceCloud = app.globalData.resourceCloud;
    if (resourceCloud && id) {
      wx.showLoading({ title: '加载中...' });
      const db = resourceCloud.database();
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
      cancel_pending: '取消申请中',
      paid: '待发货',
      refund_pending: '退款申请中',
      shipped: '已发货',
      completed: '已完成',
      cancelled: '已取消'
    };

    // Format createdAt for display
    const dateStr = this._formatTime(order.createdAt);

    // Build lifecycle timeline
    const timeline = [];
    const addEvent = (label, time, icon) => {
      if (time) {
        const t = typeof time === 'string' ? time : this._formatTime(time);
        if (t) timeline.push({ label, time: t, icon: icon || '●' });
      }
    };

    addEvent('下单', order.createdAt, '📋');
    addEvent('支付', order.paidAt || (order.payment && order.payment.paidAt), '💰');
    if (order.status === 'cancel_pending' || order.cancelRequestedAt) {
      addEvent('申请取消', order.cancelRequestedAt, '❌');
    }
    if (order.cancelRejectedAt) {
      addEvent('商家拒绝取消', order.cancelRejectedAt, '↩️');
    }
    if (order.status === 'refund_pending' || order.refundRequestedAt) {
      addEvent('申请退款', order.refundRequestedAt, '💵');
    }
    if (order.refundRejectedAt) {
      addEvent('商家拒绝退款', order.refundRejectedAt, '↩️');
    }
    addEvent('发货', order.shippedAt || (order.express && order.express.shippedAt), '📦');
    // 确认收货 - 区分商家确认 / 买家确认 / 超时自动确认
    if (order.completedAt) {
      let confirmLabel = '确认收货';
      if (order.autoConfirmed) {
        confirmLabel = '超时自动确认收货';
      } else if (order.confirmedBy === 'seller') {
        confirmLabel = '商家确认收货';
      } else if (order.confirmedBy === 'buyer') {
        confirmLabel = '买家确认收货';
      }
      addEvent(confirmLabel, order.completedAt, order.autoConfirmed ? '⏰' : '✅');
    }
    if (order.refund) {
      addEvent('商家确认退款', order.refund.refundAt, '💵');
    }
    if (order.status === 'cancelled' && order.cancelledBy) {
      const cancelTime = order.updatedAt || order.cancelledAt;
      let cancelLabel;
      if (order.refund) {
        cancelLabel = '商家确认退款';  // 退款审批通过 → 退款并取消
      } else if (order.cancelledBy === 'seller') {
        cancelLabel = '商家同意取消';  // 取消审批通过
      } else {
        cancelLabel = '买家取消';
      }
      addEvent(cancelLabel, cancelTime, order.refund ? '💵' : '🏁');
    }

    // Sort by time
    timeline.sort((a, b) => a.time.localeCompare(b.time));

    this.setData({
      order: {
        ...order,
        createdAt: dateStr
      },
      statusText: statusMap[order.status] || '未知',
      timeline
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

    const resourceCloud = app.globalData.resourceCloud;
    if (!resourceCloud) {
      this._updateStatusLocal(order, status);
      return;
    }

    // MUST use resourceCloud (not wx.cloud) for cross-account environment sharing
    wx.showLoading({ title: '处理中...' });
    resourceCloud.callFunction({
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
      fail: (err) => {
        wx.hideLoading();
        console.error('updateOrderStatus failed:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
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
      cancel_pending: '取消申请中',
      paid: '待发货',
      refund_pending: '退款申请中',
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
  },

  // Show cancel confirmation dialog with reason input
  confirmCancel() {
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
          this.updateStatusWithReason('cancelled', cancelReason);
        }
      }
    });
  },

  // Update status with cancel reason
  updateStatusWithReason(status, cancelReason) {
    const order = this.data.order;
    if (!order) return;

    const resourceCloud = app.globalData.resourceCloud;
    if (!resourceCloud) {
      this._updateStatusLocal(order, status);
      return;
    }

    wx.showLoading({ title: '处理中...' });
    resourceCloud.callFunction({
      name: 'updateOrderStatus',
      data: { orderId: order._id, status, cancelReason },
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
      fail: (err) => {
        wx.hideLoading();
        console.error('updateOrderStatus failed:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  },

  // Approve refund (refund_pending → cancelled)
  approveRefund() {
    const order = this.data.order;
    if (!order || order.status !== 'refund_pending') return;

    wx.showModal({
      title: '同意退款',
      content: '确认同意退款？金额 ¥' + order.totalPrice + ' 将退还给买家。',
      confirmText: '同意退款',
      confirmColor: '#7BAF8A',
      success: (res) => {
        if (res.confirm) {
          this.updateStatusWithReason('cancelled', '商家同意退款');
        }
      }
    });
  },

  // Reject refund (refund_pending → paid)
  rejectRefund() {
    const order = this.data.order;
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
          this._rejectRefundCall(reason);
        }
      }
    });
  },

  // Approve cancel (cancel_pending → cancelled)
  approveCancel() {
    const order = this.data.order;
    if (!order || order.status !== 'cancel_pending') return;

    wx.showModal({
      title: '同意取消',
      content: '确认同意取消该订单？',
      confirmText: '同意取消',
      confirmColor: '#7BAF8A',
      success: (res) => {
        if (res.confirm) {
          this.updateStatusWithReason('cancelled', '商家同意取消');
        }
      }
    });
  },

  // Reject cancel (cancel_pending → pending)
  rejectCancel() {
    const order = this.data.order;
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
          this._rejectCancelCall(reason);
        }
      }
    });
  },

  _rejectCancelCall(reason) {
    const order = this.data.order;
    if (!order) return;

    const resourceCloud = app.globalData.resourceCloud;
    if (!resourceCloud) {
      this._updateStatusLocal(order, 'pending');
      return;
    }

    wx.showLoading({ title: '处理中...' });
    resourceCloud.callFunction({
      name: 'updateOrderStatus',
      data: { orderId: order._id, status: 'pending', cancelReason: reason },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.code === 0) {
          this._updateStatusLocal(order, 'pending');
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

  _rejectRefundCall(reason) {
    const order = this.data.order;
    if (!order) return;

    const resourceCloud = app.globalData.resourceCloud;
    if (!resourceCloud) {
      this._updateStatusLocal(order, 'paid');
      return;
    }

    wx.showLoading({ title: '处理中...' });
    resourceCloud.callFunction({
      name: 'updateOrderStatus',
      data: { orderId: order._id, status: 'paid', cancelReason: reason },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.code === 0) {
          this._updateStatusLocal(order, 'paid');
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
  },

  // Show shipping form popup
  showShipFormPopup() {
    this.setData({
      showShipForm: true,
      expressIndex: 0,
      expressCompany: '顺丰速运',
      trackingNo: ''
    });
  },

  hideShipForm() {
    this.setData({ showShipForm: false });
  },

  // Express company picker change
  onExpressChange(e) {
    const index = e.detail.value;
    this.setData({
      expressIndex: index,
      expressCompany: this.data.expressCompanies[index]
    });
  },

  // Tracking number input
  onTrackingInput(e) {
    this.setData({ trackingNo: e.detail.value });
  },

  // Confirm shipping with express info
  confirmShip() {
    const { expressCompany, trackingNo } = this.data;
    const cleanTracking = (trackingNo || '').trim();

    if (!expressCompany || !expressCompany.trim()) {
      wx.showToast({ title: '请选择快递公司', icon: 'none' });
      return;
    }
    if (!cleanTracking) {
      wx.showToast({ title: '请输入快递单号', icon: 'none' });
      return;
    }

    const order = this.data.order;
    if (!order) return;

    // Capture values before async to avoid data race
    const company = expressCompany.trim();
    const tracking = cleanTracking;

    const resourceCloud = app.globalData.resourceCloud;
    if (!resourceCloud) {
      this._updateStatusLocal(order, 'shipped');
      this.hideShipForm();
      return;
    }

    wx.showLoading({ title: '发货中...' });
    resourceCloud.callFunction({
      name: 'updateOrderStatus',
      data: {
        orderId: order._id,
        status: 'shipped',
        expressCompany: company,
        trackingNo: tracking
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.code === 0) {
          this.hideShipForm();
          // Reload order to get express field
          this._setOrder({ ...order, status: 'shipped', express: { company: company, trackingNo: tracking, shippedAt: new Date().toISOString() } });
          wx.showToast({ title: '发货成功', icon: 'success' });
        } else {
          wx.showToast({
            title: (res.result && res.result.message) || '发货失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('Ship order failed:', err);
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      }
    });
  }
});
