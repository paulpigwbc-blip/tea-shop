// pages/order-confirm/order-confirm.js
const app = getApp()
const { formatPrice } = require('../../utils/util')

Page({
  data: {
    items: [],
    totalPrice: 0,
    totalCount: 0,
    selectedAddress: null,
    note: '',
    submitting: false,
    fromBuyNow: false
  },

  onLoad(options) {
    const from = options.from || '';
    let items = [];

    if (from === 'buyNow' && app.globalData.checkoutItems) {
      items = app.globalData.checkoutItems;
      this.setData({ fromBuyNow: true });
    } else {
      // From cart - get checked items
      items = app.globalData.cart.filter(item => item.checked);
    }

    // Load default address
    const addresses = wx.getStorageSync('addresses') || [];
    const defaultAddr = addresses.find(a => a.isDefault) || addresses[0] || null;

    const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    this.setData({
      items,
      totalCount,
      totalPrice: Number(totalPrice.toFixed(2)),
      selectedAddress: defaultAddr
    });
  },

  // Select address
  selectAddress() {
    wx.navigateTo({
      url: '/pages/address/address?from=orderConfirm'
    });
  },

  // Input note
  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  // Submit order
  submitOrder() {
    if (this.data.submitting) return;

    if (!this.data.selectedAddress) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' });
      return;
    }

    if (this.data.items.length === 0) {
      wx.showToast({ title: '没有可结算的商品', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    // Build order items - DO NOT send price, server recalculates for security
    const orderItems = this.data.items.map(item => ({
      productId: item.id,
      quantity: item.quantity
    }));

    // SECURITY: Always use cloud function for order creation
    if (wx.cloud) {
      wx.cloud.callFunction({
        name: 'createOrder',
        data: {
          items: orderItems,
          note: this.data.note,
          address: this.data.selectedAddress,
          type: 'delivery',
          buyerInfo: {
            name: this.data.selectedAddress.name,
            phone: this.data.selectedAddress.phone
          }
        },
        success: (res) => {
          this.orderSuccess(res.result);
        },
        fail: (err) => {
          console.error('Cloud function failed:', err);
          wx.showModal({
            title: '下单失败',
            content: '请检查网络后重试',
            showCancel: false
          });
        }
      });
    } else {
      // Mock order for local development
      this.mockOrder();
    }
  },

  // Mock order creation for development
  mockOrder() {
    const now = new Date();
    const dateStr = '' + now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const orderNo = 'T' + dateStr + String(Math.floor(Math.random() * 1000)).padStart(3, '0');

    const order = {
      _id: 'mock_' + Date.now(),
      orderNo,
      items: this.data.items.map(item => ({
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      totalPrice: this.data.totalPrice,
      status: 'pending',
      note: this.data.note,
      type: this.data.orderType,
      address: this.data.orderType === 'delivery' ? this.data.selectedAddress : null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    // Save to local storage
    const orders = wx.getStorageSync('orders') || [];
    orders.unshift(order);
    wx.setStorageSync('orders', orders);

    this.orderSuccess({ code: 0, data: { orderId: order._id, orderNo } });
  },

  // Handle order success
  orderSuccess(result) {
    this.setData({ submitting: false });

    if (result.code === 0 || result.data) {
      // Clear cart items that were ordered
      if (!this.data.fromBuyNow) {
        const orderedIds = this.data.items.map(item => item.id);
        app.globalData.cart = app.globalData.cart.filter(item => !orderedIds.includes(item.id));
        app.saveCart();
      }

      // Clear checkout items
      if (app.globalData.checkoutItems) {
        delete app.globalData.checkoutItems;
      }

      wx.showToast({ title: '下单成功', icon: 'success' });

      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/order-detail/order-detail?id=' + (result.data.orderId || '') + '&orderNo=' + (result.data.orderNo || '')
        });
      }, 1000);
    } else {
      wx.showToast({ title: '下单失败，请重试', icon: 'none' });
    }
  }
});
