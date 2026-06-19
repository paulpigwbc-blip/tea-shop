// pages/order-detail/order-detail.js
const { getStatusText, getStatusColor, formatDate } = require('../../utils/util')

Page({
  data: {
    order: null,
    statusText: '',
    statusColor: '',
    formattedDate: '',
    timeline: [],
    watcher: null,
    showPayPopup: false,
    payProcessing: false,
    paySuccess: false
  },

  onLoad(options) {
    const id = options.id;
    const orderNo = options.orderNo || '';

    this.loadOrder(id, orderNo);
  },

  onUnload() {
    // Stop real-time listener
    if (this.data.watcher) {
      this.data.watcher.close();
    }
  },

  loadOrder(id, orderNo) {
    // Try cloud database first, fallback to local storage
    if (wx.cloud && id && !id.startsWith('mock_')) {
      const db = wx.cloud.database();
      db.collection('orders').doc(id).get({
        success: (res) => {
          if (res.data) {
            console.log('Loaded order from cloud:', id);
            const order = {
              ...res.data,
              createdAt: res.data.createdAt ? new Date(res.data.createdAt).toISOString() : new Date().toISOString(),
              updatedAt: res.data.updatedAt ? new Date(res.data.updatedAt).toISOString() : new Date().toISOString()
            };
            this.displayOrder(order);
            this.watchOrder(id);
          } else {
            this._loadOrderLocal(id, orderNo);
          }
        },
        fail: (err) => {
          console.error('Failed to load order from cloud:', err);
          this._loadOrderLocal(id, orderNo);
        }
      });
    } else {
      this._loadOrderLocal(id, orderNo);
    }
  },

  _loadOrderLocal(id, orderNo) {
    const orders = wx.getStorageSync('orders') || [];
    let order = null;

    if (id) {
      order = orders.find(o => o._id === id);
    }
    if (!order && orderNo) {
      order = orders.find(o => o.orderNo === orderNo);
    }

    if (order) {
      this.displayOrder(order);
      if (wx.cloud && order._id && !order._id.startsWith('mock_')) {
        this.watchOrder(order._id);
      }
    } else {
      wx.showToast({ title: '订单不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  displayOrder(order) {
    const timeline = this._buildTimeline(order);
    this.setData({
      order,
      statusText: getStatusText(order.status),
      statusColor: getStatusColor(order.status),
      formattedDate: formatDate(order.createdAt, 'YYYY-MM-DD HH:mm:ss'),
      timeline
    });
    wx.setNavigationBarTitle({ title: '订单 ' + order.orderNo });

    // Resolve cloud:// image URLs in order items
    const fileIDs = (order.items || [])
      .map(item => item.image)
      .filter(url => typeof url === 'string' && url.startsWith('cloud://'));

    if (fileIDs.length > 0 && wx.cloud) {
      wx.cloud.getTempFileURL({
        fileList: fileIDs,
        success: (res) => {
          const fileMap = {};
          (res.fileList || []).forEach(f => {
            if (f.tempFileURL) fileMap[f.fileID] = f.tempFileURL;
          });
          const updatedItems = order.items.map(item => ({
            ...item,
            image: fileMap[item.image] || item.image
          }));
          this.setData({ 'order.items': updatedItems });
        }
      });
    }
  },

  // Build order lifecycle timeline (newest first)
  _buildTimeline(order) {
    const timeline = [];
    const fmt = (t) => {
      if (!t) return '';
      return formatDate(t, 'YYYY-MM-DD HH:mm:ss');
    };
    const addEvent = (label, time) => {
      const formatted = fmt(time);
      if (formatted) {
        timeline.push({ label, time: formatted });
      }
    };

    addEvent('提交订单', order.createdAt);
    addEvent('订单支付', order.paidAt || (order.payment && order.payment.paidAt));
    if (order.status === 'cancel_pending' || order.cancelRequestedAt) {
      addEvent('申请取消', order.cancelRequestedAt);
    }
    if (order.cancelRejectedAt) {
      addEvent('取消申请被拒绝', order.cancelRejectedAt);
    }
    if (order.status === 'refund_pending' || order.refundRequestedAt) {
      addEvent('申请退款', order.refundRequestedAt);
    }
    if (order.refundRejectedAt) {
      addEvent('退款申请被拒绝', order.refundRejectedAt);
    }
    addEvent('商家发货', order.shippedAt || (order.express && order.express.shippedAt));
    if (order.completedAt) {
      let confirmLabel = '确认收货';
      if (order.autoConfirmed) {
        confirmLabel = '超时自动确认收货';
      } else if (order.confirmedBy === 'seller') {
        confirmLabel = '商家确认收货';
      }
      addEvent(confirmLabel, order.completedAt);
    }
    if (order.refund) {
      addEvent('退款完成', order.refund.refundAt);
    }
    if (order.status === 'cancelled' && order.cancelledBy) {
      const cancelTime = order.updatedAt || order.cancelledAt;
      let cancelLabel;
      if (order.refund) {
        cancelLabel = '商家同意退款';
      } else if (order.cancelledBy === 'seller') {
        cancelLabel = '商家同意取消';
      } else {
        cancelLabel = '订单已取消';
      }
      addEvent(cancelLabel, cancelTime);
    }

    // Sort by time, newest first
    timeline.sort((a, b) => b.time.localeCompare(a.time));
    return timeline;
  },

  // Watch order for real-time updates (cloud)
  watchOrder(orderId) {
    if (!wx.cloud || !orderId || orderId.startsWith('mock_')) return;

    try {
      const db = wx.cloud.database();
      const watcher = db.collection('orders').doc(orderId).watch({
        onChange: snapshot => {
          if (snapshot.docs && snapshot.docs.length > 0) {
            const order = snapshot.docs[0];
            // Update local storage
            const orders = wx.getStorageSync('orders') || [];
            const index = orders.findIndex(o => o._id === orderId);
            if (index >= 0) {
              orders[index] = order;
              wx.setStorageSync('orders', orders);
            }
            this.displayOrder(order);
          }
        },
        onError: err => {
          console.error('Order watch error:', err);
        }
      });
      this.setData({ watcher });
    } catch (e) {
      console.log('Watch not available:', e);
    }
  },

  // Cancel order — pending orders cancel directly; paid orders need seller approval (refund flow)
  cancelOrder() {
    const order = this.data.order;
    const isPending = order.status === 'pending';

    const modalTitle = isPending ? '取消订单' : '申请取消';
    const modalContent = isPending
      ? '确定要取消该订单吗？取消后不可恢复。'
      : '确定要申请取消该订单吗？商家确认后订单将取消。';
    const confirmText = isPending ? '确定取消' : '申请取消';

    wx.showModal({
      title: modalTitle,
      content: modalContent,
      confirmText: confirmText,
      confirmColor: '#E54D42',
      success: (res) => {
        if (res.confirm) {
          // Pending orders: cancel directly → 'cancelled'
          // Other orders: request cancel → 'cancel_pending' (seller must approve)
          const targetStatus = isPending ? 'cancelled' : 'cancel_pending';

          if (wx.cloud) {
            wx.showLoading({ title: '处理中...' });
            wx.cloud.callFunction({
              name: 'updateOrderStatus',
              data: {
                orderId: order._id,
                status: targetStatus,
                cancelReason: isPending ? '买家取消订单' : '买家申请取消'
              },
              success: (res) => {
                wx.hideLoading();
                if (res.result && res.result.code === 0) {
                  if (isPending) {
                    this._directCancelLocal(order);
                  } else {
                    this._requestCancelLocal(order);
                  }
                } else {
                  wx.showToast({ title: (res.result && res.result.message) || '操作失败', icon: 'none' });
                }
              },
              fail: (err) => {
                wx.hideLoading();
                console.error('Cancel order cloud function failed:', err);
                // Fallback to local for development only
                if (isPending) {
                  this._directCancelLocal(order);
                } else {
                  this._requestCancelLocal(order);
                }
              }
            });
          } else {
            // Development fallback without cloud
            if (isPending) {
              this._directCancelLocal(order);
            } else {
              this._requestCancelLocal(order);
            }
          }
        }
      }
    });
  },

  // Local direct cancel for pending orders
  _directCancelLocal(order) {
    order.status = 'cancelled';
    order.updatedAt = new Date().toISOString();
    order.cancelledAt = new Date().toISOString();
    order.cancelledBy = 'buyer';
    order.cancelReason = '买家取消订单';
    const orders = wx.getStorageSync('orders') || [];
    const index = orders.findIndex(o => o._id === order._id);
    if (index >= 0) {
      orders[index] = order;
      wx.setStorageSync('orders', orders);
    }
    this.displayOrder(order);
    wx.showToast({ title: '订单已取消', icon: 'success' });
  },

  // Local cancel request fallback for development
  _requestCancelLocal(order) {
    order.status = 'cancel_pending';
    order.updatedAt = new Date().toISOString();
    order.cancelRequestedAt = new Date().toISOString();
    order.cancelRequestReason = '买家申请取消';
    const orders = wx.getStorageSync('orders') || [];
    const index = orders.findIndex(o => o._id === order._id);
    if (index >= 0) {
      orders[index] = order;
      wx.setStorageSync('orders', orders);
    }
    this.displayOrder(order);
    wx.showToast({ title: '取消申请已提交', icon: 'success' });
  },

  // Request refund — buyer initiates refund request, merchant must approve
  requestRefund() {
    const order = this.data.order;
    if (!order || order.status !== 'paid') return;

    wx.showModal({
      title: '申请退款',
      content: '确定要申请退款吗？退款金额 ¥' + order.totalPrice + ' 将原路退回。商家确认后自动退款。',
      confirmText: '确定退款',
      confirmColor: '#E54D42',
      success: (res) => {
        if (res.confirm) {
          if (wx.cloud) {
            wx.showLoading({ title: '处理中...' });
            wx.cloud.callFunction({
              name: 'updateOrderStatus',
              data: {
                orderId: order._id,
                status: 'refund_pending',
                cancelReason: '买家申请退款'
              },
              success: (res) => {
                wx.hideLoading();
                if (res.result && res.result.code === 0) {
                  this._requestRefundLocal(order);
                } else {
                  wx.showToast({ title: (res.result && res.result.message) || '申请失败', icon: 'none' });
                }
              },
              fail: (err) => {
                wx.hideLoading();
                console.error('Refund cloud function failed:', err);
                this._requestRefundLocal(order);
              }
            });
          } else {
            this._requestRefundLocal(order);
          }
        }
      }
    });
  },

  // Internal: apply refund_pending status locally and refresh display
  _requestRefundLocal(order) {
    order.status = 'refund_pending';
    order.updatedAt = new Date().toISOString();
    order.refundRequestedAt = new Date().toISOString();
    order.refundRequestReason = '买家申请退款';
    const orders = wx.getStorageSync('orders') || [];
    const index = orders.findIndex(o => o._id === order._id);
    if (index >= 0) {
      orders[index] = order;
      wx.setStorageSync('orders', orders);
    }
    this.displayOrder(order);
    wx.showToast({ title: '退款申请已提交', icon: 'success' });
  },

  // Show mock payment popup
  payOrder() {
    this.setData({ showPayPopup: true, payProcessing: false, paySuccess: false });
  },

  // Request urgency (催单) - send reminder to seller
  requestUrgency() {
    const order = this.data.order;
    if (!order) return;

    wx.showModal({
      title: '催促发货',
      content: '确定要催促商家发货吗？',
      confirmText: '确定催单',
      confirmColor: '#8B6914',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '发送中...' });

          if (wx.cloud) {
            wx.cloud.callFunction({
              name: 'sendUrgencyMessage',
              data: {
                orderId: order._id,
                autoTrigger: false  // Buyer-triggered
              },
              success: (result) => {
                wx.hideLoading();
                if (result.result && result.result.code === 0) {
                  wx.showToast({ title: '催单已发送', icon: 'success' });
                  // Refresh order to show lastUrgencyAt
                  this.loadOrder(order._id);
                } else {
                  wx.showToast({ 
                    title: result.result.message || '发送失败', 
                    icon: 'none' 
                  });
                }
              },
              fail: (err) => {
                wx.hideLoading();
                console.error('Send urgency failed:', err);
                wx.showToast({ title: '网络错误，请重试', icon: 'none' });
              }
            });
          } else {
            wx.hideLoading();
            wx.showToast({ title: '云服务暂不可用', icon: 'none' });
          }
        }
      }
    });
  },

  // Close payment popup
  closePayPopup() {
    if (this.data.payProcessing) return; // Cannot close while processing
    this.setData({ showPayPopup: false });
  },

  // Confirm mock payment — simulates WeChat Pay with a short delay
  // TODO: Replace this entire method with wx.requestPayment() when going live
  confirmMockPay() {
    if (this.data.payProcessing || this.data.paySuccess) return;

    const order = this.data.order;
    this.setData({ payProcessing: true });

    // Simulate payment processing delay (1.5s)
    setTimeout(() => {
      if (wx.cloud) {
        wx.cloud.callFunction({
          name: 'updateOrderStatus',
          data: { orderId: order._id, status: 'paid' },
          success: (res) => {
            this.setData({ payProcessing: false, paySuccess: true });
            if (res.result && res.result.code === 0) {
              this._onPaySuccess(order);
            } else {
              wx.showToast({ title: (res.result && res.result.message) || '支付失败', icon: 'none' });
              setTimeout(() => this.setData({ showPayPopup: false }), 1000);
            }
          },
          fail: (err) => {
            console.error('Pay order cloud function failed:', err);
            // Development fallback — still treat as success
            this.setData({ payProcessing: false, paySuccess: true });
            this._onPaySuccess(order);
          }
        });
      } else {
        // No cloud — local mock success
        this.setData({ payProcessing: false, paySuccess: true });
        this._onPaySuccess(order);
      }
    }, 1500);
  },

  // Internal: apply paid status locally and refresh display
  _onPaySuccess(order) {
    order.status = 'paid';
    order.updatedAt = new Date().toISOString();
    const orders = wx.getStorageSync('orders') || [];
    const index = orders.findIndex(o => o._id === order._id);
    if (index >= 0) {
      orders[index] = order;
      wx.setStorageSync('orders', orders);
    }
    this.displayOrder(order);

    // Auto-close popup after showing success
    setTimeout(() => {
      this.setData({ showPayPopup: false });
    }, 800);
  },

  // Confirm receipt - MUST go through cloud function for security
  confirmReceipt() {
    wx.showModal({
      title: '确认收货',
      content: '确认您已收到商品？',
      success: (res) => {
        if (res.confirm) {
          const order = this.data.order;
          if (wx.cloud) {
            wx.showLoading({ title: '处理中...' });
            wx.cloud.callFunction({
              name: 'updateOrderStatus',
              data: { orderId: order._id, status: 'completed' },
              success: (res) => {
                wx.hideLoading();
                if (res.result && res.result.code === 0) {
                  order.status = 'completed';
                  order.updatedAt = new Date().toISOString();
                  order.completedAt = new Date().toISOString();
                  const orders = wx.getStorageSync('orders') || [];
                  const index = orders.findIndex(o => o._id === order._id);
                  if (index >= 0) {
                    orders[index] = order;
                    wx.setStorageSync('orders', orders);
                  }
                  this.displayOrder(order);
                  wx.showToast({ title: '已确认收货', icon: 'success' });
                } else {
                  wx.showToast({ title: (res.result && res.result.message) || '操作失败', icon: 'none' });
                }
              },
              fail: (err) => {
                wx.hideLoading();
                console.error('Confirm receipt failed:', err);
                // Fallback
                order.status = 'completed';
                order.updatedAt = new Date().toISOString();
                this.displayOrder(order);
                wx.showToast({ title: '已确认收货', icon: 'success' });
              }
            });
          } else {
            order.status = 'completed';
            order.updatedAt = new Date().toISOString();
            this.displayOrder(order);
            wx.showToast({ title: '已确认收货', icon: 'success' });
          }
        }
      }
    });
  },

  // Reorder
  reorder() {
    const order = this.data.order;
    if (!order) return;

    const app = getApp();
    order.items.forEach(item => {
      const product = app.globalData.products.find(p => p.id === item.productId);
      if (product) {
        app.addToCart(product, item.quantity);
      }
    });

    wx.switchTab({
      url: '/pages/cart/cart'
    });
  },

  // Go to product detail
  goToProductDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: '/pages/product-detail/product-detail?id=' + id
      });
    }
  },

  // Copy tracking number to clipboard
  copyTrackingNo() {
    const express = this.data.order && this.data.order.express;
    if (!express || !express.trackingNo) return;
    wx.setClipboardData({
      data: express.trackingNo,
      success: () => {
        wx.showToast({ title: '快递单号已复制', icon: 'success' });
      }
    });
  },

  // Go to order list
  goToOrderList() {
    wx.navigateTo({
      url: '/pages/order-list/order-list'
    });
  },

  // Share
  onShareAppMessage() {
    return {
      title: '茶语轩 - 订单详情',
      path: '/pages/home/home'
    };
  }
});
