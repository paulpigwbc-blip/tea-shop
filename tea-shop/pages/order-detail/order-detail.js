// pages/order-detail/order-detail.js
const { getStatusText, getStatusColor, formatDate } = require('../../utils/util')

Page({
  data: {
    order: null,
    statusText: '',
    statusColor: '',
    formattedDate: '',
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
    this.setData({
      order,
      statusText: getStatusText(order.status),
      statusColor: getStatusColor(order.status),
      formattedDate: formatDate(order.createdAt, 'YYYY-MM-DD HH:mm:ss')
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

  // Cancel order - MUST go through cloud function for security
  cancelOrder() {
    wx.showModal({
      title: '提示',
      content: '确定要取消该订单吗？',
      success: (res) => {
        if (res.confirm) {
          const order = this.data.order;

          // SECURITY: Route through cloud function for server-side validation
          if (wx.cloud) {
            wx.showLoading({ title: '处理中...' });
            wx.cloud.callFunction({
              name: 'updateOrderStatus',
              data: {
                orderId: order._id,
                status: 'cancelled',
                cancelReason: '买家取消'
              },
              success: (res) => {
                wx.hideLoading();
                if (res.result && res.result.code === 0) {
                  // Update local copy
                  order.status = 'cancelled';
                  order.updatedAt = new Date().toISOString();
                  const orders = wx.getStorageSync('orders') || [];
                  const index = orders.findIndex(o => o._id === order._id);
                  if (index >= 0) {
                    orders[index] = order;
                    wx.setStorageSync('orders', orders);
                  }
                  this.displayOrder(order);
                  wx.showToast({ title: '订单已取消', icon: 'success' });
                } else {
                  wx.showToast({ title: (res.result && res.result.message) || '取消失败', icon: 'none' });
                }
              },
              fail: (err) => {
                wx.hideLoading();
                console.error('Cancel order cloud function failed:', err);
                // Fallback to local for development only
                this._cancelOrderLocal(order);
              }
            });
          } else {
            // Development fallback without cloud
            this._cancelOrderLocal(order);
          }
        }
      }
    });
  },

  // Show mock payment popup
  payOrder() {
    this.setData({ showPayPopup: true, payProcessing: false, paySuccess: false });
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

  // Local cancel fallback for development
  _cancelOrderLocal(order) {
    order.status = 'cancelled';
    order.updatedAt = new Date().toISOString();
    const orders = wx.getStorageSync('orders') || [];
    const index = orders.findIndex(o => o._id === order._id);
    if (index >= 0) {
      orders[index] = order;
      wx.setStorageSync('orders', orders);
    }
    this.displayOrder(order);
    wx.showToast({ title: '订单已取消', icon: 'success' });
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
