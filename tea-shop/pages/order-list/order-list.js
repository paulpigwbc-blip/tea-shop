// pages/order-list/order-list.js
const { getStatusText, getStatusColor, formatDate } = require('../../utils/util')

Page({
  data: {
    tabs: ['全部', '待付款', '待发货', '已发货', '已完成'],
    tabStatuses: ['all', 'pending', 'paid', 'shipped', 'completed'],
    activeTab: 2,
    orders: [],
    filteredOrders: [],
    showPayPopup: false,
    payProcessing: false,
    paySuccess: false,
    payOrderId: '',
    payAmount: 0
  },

  onLoad(options) {
    // Support initial tab override from navigation (e.g., from order detail)
    if (options && options.tab) {
      const tabIndex = parseInt(options.tab);
      if (!isNaN(tabIndex) && tabIndex >= 0 && tabIndex < this.data.tabs.length) {
        this.setData({ activeTab: tabIndex });
        this._tabManuallySet = true;
      }
    }
    this.loadOrders();
  },

  onShow() {
    this.loadOrders();
  },

  loadOrders() {
    // Load from cloud database first, fallback to local storage
    if (wx.cloud) {
      const db = wx.cloud.database();
      db.collection('orders').orderBy('createdAt', 'desc').limit(50).get({
        success: (res) => {
          if (res.data && res.data.length > 0) {
            console.log('Loaded ' + res.data.length + ' orders from cloud');
            const orders = res.data.map(o => ({
              ...o,
              createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
              updatedAt: o.updatedAt ? new Date(o.updatedAt).toISOString() : new Date().toISOString()
            }));
            this.setData({ orders });
            this._resolveOrderImages();
            this._applySmartDefaultTab();
            this.filterOrders();
          } else {
            // No cloud orders, try local
            this._loadOrdersLocal();
          }
        },
        fail: (err) => {
          console.error('Failed to load cloud orders:', err);
          this._loadOrdersLocal();
        }
      });
    } else {
      this._loadOrdersLocal();
    }
  },

  // Resolve cloud:// image URLs in order items to temp HTTP URLs
  _resolveOrderImages() {
    const allFileIDs = [];
    this.data.orders.forEach(order => {
      (order.items || []).forEach(item => {
        if (item.image && typeof item.image === 'string' && item.image.startsWith('cloud://') && !allFileIDs.includes(item.image)) {
          allFileIDs.push(item.image);
        }
      });
    });
    if (allFileIDs.length === 0) return;

    wx.cloud.getTempFileURL({
      fileList: allFileIDs,
      success: (res) => {
        const fileMap = {};
        (res.fileList || []).forEach(f => {
          if (f.tempFileURL) fileMap[f.fileID] = f.tempFileURL;
        });
        const orders = this.data.orders.map(order => ({
          ...order,
          items: (order.items || []).map(item => ({
            ...item,
            image: fileMap[item.image] || item.image
          }))
        }));
        this.setData({ orders });
        this.filterOrders();
      }
    });
  },

  _loadOrdersLocal() {
    const orders = wx.getStorageSync('orders') || [];
    this.setData({ orders });
    this._applySmartDefaultTab();
    this.filterOrders();
  },

  // Default to '待发货' tab
  _applySmartDefaultTab() {
    if (this._tabManuallySet) return;
    this._tabManuallySet = true;
    // Always default to '待发货' (index 2)
    this.setData({ activeTab: 2 });
  },

  // Switch tab
  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    this._tabManuallySet = true;
    this.setData({ activeTab: index });
    this.filterOrders();
  },

  filterOrders() {
    const status = this.data.tabStatuses[this.data.activeTab];
    let filtered = this.data.orders;

    if (status !== 'all') {
      filtered = filtered.filter(o => o.status === status);
    }

    // Format for display
    filtered = filtered.map(order => ({
      ...order,
      statusText: getStatusText(order.status),
      statusColor: getStatusColor(order.status),
      formattedDate: formatDate(order.createdAt, 'MM-DD HH:mm')
    }));

    this.setData({ filteredOrders: filtered });
  },

  // View order detail
  viewOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/order-detail/order-detail?id=' + id
    });
  },

  // Navigate to product detail from order item
  goToProductDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: '/pages/product-detail/product-detail?id=' + id
      });
    }
  },

  // Show mock payment popup
  // TODO: Replace with wx.requestPayment() when going live
  payOrder(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o._id === id);
    if (!order) return;
    this.setData({
      showPayPopup: true,
      payProcessing: false,
      paySuccess: false,
      payOrderId: id,
      payAmount: order.totalPrice
    });
  },

  // Close payment popup
  closePayPopup() {
    if (this.data.payProcessing) return;
    this.setData({ showPayPopup: false });
  },

  // Confirm mock payment with simulated delay
  confirmMockPay() {
    if (this.data.payProcessing || this.data.paySuccess) return;
    const id = this.data.payOrderId;
    this.setData({ payProcessing: true });

    // Simulate payment processing (1.5s)
    setTimeout(() => {
      if (wx.cloud) {
        wx.cloud.callFunction({
          name: 'updateOrderStatus',
          data: { orderId: id, status: 'paid' },
          success: (res) => {
            this.setData({ payProcessing: false, paySuccess: true });
            if (res.result && res.result.code === 0) {
              this._payLocal(id);
            } else {
              wx.showToast({ title: (res.result && res.result.message) || '支付失败', icon: 'none' });
              setTimeout(() => this.setData({ showPayPopup: false }), 1000);
            }
          },
          fail: () => {
            this.setData({ payProcessing: false, paySuccess: true });
            this._payLocal(id);
          }
        });
      } else {
        this.setData({ payProcessing: false, paySuccess: true });
        this._payLocal(id);
      }
    }, 1500);
  },

  _payLocal(id) {
    const orders = this.data.orders;
    const order = orders.find(o => o._id === id);
    if (order) {
      order.status = 'paid';
      order.updatedAt = new Date().toISOString();
      wx.setStorageSync('orders', orders);
      this.loadOrders();
      wx.showToast({ title: '支付成功', icon: 'success' });
    }
    // Auto-close popup after showing success
    setTimeout(() => {
      this.setData({ showPayPopup: false });
    }, 800);
  },

  // Cancel order - MUST go through cloud function for security
  cancelOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定要取消该订单吗？',
      success: (res) => {
        if (res.confirm) {
          // SECURITY: Route through cloud function
          if (wx.cloud) {
            wx.showLoading({ title: '处理中...' });
            wx.cloud.callFunction({
              name: 'updateOrderStatus',
              data: { orderId: id, status: 'cancelled', cancelReason: '买家取消' },
              success: (res) => {
                wx.hideLoading();
                if (res.result && res.result.code === 0) {
                  this._cancelOrderLocal(id);
                } else {
                  wx.showToast({ title: (res.result && res.result.message) || '取消失败', icon: 'none' });
                }
              },
              fail: () => {
                wx.hideLoading();
                this._cancelOrderLocal(id);
              }
            });
          } else {
            this._cancelOrderLocal(id);
          }
        }
      }
    });
  },

  _cancelOrderLocal(id) {
    const orders = this.data.orders;
    const order = orders.find(o => o._id === id);
    if (order) {
      order.status = 'cancelled';
      order.updatedAt = new Date().toISOString();
      wx.setStorageSync('orders', orders);
      this.loadOrders();
      wx.showToast({ title: '订单已取消', icon: 'success' });
    }
  },

  // Confirm receipt - MUST go through cloud function
  confirmReceipt(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认收货',
      content: '确认您已收到商品？',
      success: (res) => {
        if (res.confirm) {
          if (wx.cloud) {
            wx.showLoading({ title: '处理中...' });
            wx.cloud.callFunction({
              name: 'updateOrderStatus',
              data: { orderId: id, status: 'completed' },
              success: (res) => {
                wx.hideLoading();
                if (res.result && res.result.code === 0) {
                  this._confirmLocal(id);
                } else {
                  wx.showToast({ title: (res.result && res.result.message) || '操作失败', icon: 'none' });
                }
              },
              fail: () => {
                wx.hideLoading();
                this._confirmLocal(id);
              }
            });
          } else {
            this._confirmLocal(id);
          }
        }
      }
    });
  },

  _confirmLocal(id) {
    const orders = this.data.orders;
    const order = orders.find(o => o._id === id);
    if (order) {
      order.status = 'completed';
      order.updatedAt = new Date().toISOString();
      wx.setStorageSync('orders', orders);
      this.loadOrders();
      wx.showToast({ title: '已确认收货', icon: 'success' });
    }
  },

  // Reorder
  reorder(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o._id === id);
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
  }
});
