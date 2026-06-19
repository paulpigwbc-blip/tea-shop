// pages/order-list/order-list.js
const { getStatusText, getStatusColor, formatDate } = require('../../utils/util')

Page({
  data: {
    tabs: ['全部', '待付款', '待发货', '退款', '已发货', '已完成'],
    tabStatuses: ['all', 'pending', 'paid', 'refund_related', 'shipped', 'completed'],
    activeTab: 2,
    orders: [],
    filteredOrders: [],
    searchText: '',
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

    // Search filter: orderNo + product names
    if (keyword) {
      filtered = filtered.filter(o => {
        if ((o.orderNo || '').toLowerCase().includes(keyword)) return true;
        if ((o.items || []).some(item => (item.name || '').toLowerCase().includes(keyword))) return true;
        return false;
      });
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

  // Request urgency (催单)
  requestUrgency(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o._id === id);
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
                orderId: id,
                autoTrigger: false
              },
              success: (result) => {
                wx.hideLoading();
                if (result.result && result.result.code === 0) {
                  wx.showToast({ title: '催单已发送', icon: 'success' });
                  this.loadOrders();
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

  // Request refund — buyer initiates refund request, merchant must approve
  requestRefund(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o._id === id);
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
                orderId: id,
                status: 'refund_pending',
                cancelReason: '买家申请退款'
              },
              success: (res) => {
                wx.hideLoading();
                if (res.result && res.result.code === 0) {
                  this._requestRefundLocal(id);
                } else {
                  wx.showToast({ title: (res.result && res.result.message) || '申请失败', icon: 'none' });
                }
              },
              fail: (err) => {
                wx.hideLoading();
                console.error('Refund cloud function failed:', err);
                this._requestRefundLocal(id);
              }
            });
          } else {
            this._requestRefundLocal(id);
          }
        }
      }
    });
  },

  // Internal: apply refund_pending status locally and refresh list
  _requestRefundLocal(id) {
    const orders = this.data.orders;
    const order = orders.find(o => o._id === id);
    if (order) {
      order.status = 'refund_pending';
      order.updatedAt = new Date().toISOString();
      order.refundRequestedAt = new Date().toISOString();
      order.refundRequestReason = '买家申请退款';
      wx.setStorageSync('orders', orders);
      this.loadOrders();
      wx.showToast({ title: '退款申请已提交', icon: 'success' });
    }
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

  // Cancel order — pending orders cancel directly; other orders need seller approval
  cancelOrder(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o._id === id);
    if (!order) return;
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
          const targetStatus = isPending ? 'cancelled' : 'cancel_pending';
          if (wx.cloud) {
            wx.showLoading({ title: '处理中...' });
            wx.cloud.callFunction({
              name: 'updateOrderStatus',
              data: { orderId: id, status: targetStatus, cancelReason: isPending ? '买家取消订单' : '买家申请取消' },
              success: (res) => {
                wx.hideLoading();
                if (res.result && res.result.code === 0) {
                  if (isPending) {
                    this._directCancelLocal(id);
                  } else {
                    this._requestCancelLocal(id);
                  }
                } else {
                  wx.showToast({ title: (res.result && res.result.message) || '操作失败', icon: 'none' });
                }
              },
              fail: () => {
                wx.hideLoading();
                if (isPending) {
                  this._directCancelLocal(id);
                } else {
                  this._requestCancelLocal(id);
                }
              }
            });
          } else {
            if (isPending) {
              this._directCancelLocal(id);
            } else {
              this._requestCancelLocal(id);
            }
          }
        }
      }
    });
  },

  // Local direct cancel for pending orders
  _directCancelLocal(id) {
    const orders = this.data.orders;
    const order = orders.find(o => o._id === id);
    if (order) {
      order.status = 'cancelled';
      order.updatedAt = new Date().toISOString();
      order.cancelledAt = new Date().toISOString();
      order.cancelledBy = 'buyer';
      order.cancelReason = '买家取消订单';
      wx.setStorageSync('orders', orders);
      this.loadOrders();
      wx.showToast({ title: '订单已取消', icon: 'success' });
    }
  },

  _requestCancelLocal(id) {
    const orders = this.data.orders;
    const order = orders.find(o => o._id === id);
    if (order) {
      order.status = 'cancel_pending';
      order.updatedAt = new Date().toISOString();
      order.cancelRequestedAt = new Date().toISOString();
      order.cancelRequestReason = '买家申请取消';
      wx.setStorageSync('orders', orders);
      this.loadOrders();
      wx.showToast({ title: '取消申请已提交', icon: 'success' });
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
