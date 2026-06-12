// pages/address/address.js
const app = getApp()

Page({
  data: {
    addresses: [],
    fromPage: '',
    selectMode: false
  },

  onLoad(options) {
    const from = options.from || '';
    this.setData({
      fromPage: from,
      selectMode: from === 'orderConfirm'
    });
    this.loadAddresses();
  },

  onShow() {
    this.loadAddresses();
  },

  loadAddresses() {
    const addresses = wx.getStorageSync('addresses') || [];
    this.setData({ addresses });
  },

  saveAddresses() {
    wx.setStorageSync('addresses', this.data.addresses);
  },

  // Set default address
  setDefault(e) {
    const id = e.currentTarget.dataset.id;
    const addresses = this.data.addresses;
    addresses.forEach(addr => {
      addr.isDefault = addr.id === id;
    });
    this.setData({ addresses });
    this.saveAddresses();
  },

  // Select address (when in select mode)
  selectAddress(e) {
    if (!this.data.selectMode) return;
    const id = e.currentTarget.dataset.id;
    const address = this.data.addresses.find(a => a.id === id);
    if (address) {
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage && prevPage.setData) {
        prevPage.setData({ selectedAddress: address });
      }
      wx.navigateBack();
    }
  },

  // Add new address
  addAddress() {
    wx.navigateTo({
      url: '/pages/address-edit/address-edit'
    });
  },

  // Edit address
  editAddress(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/address-edit/address-edit?id=' + id
    });
  },

  // Delete address
  deleteAddress(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定要删除该地址吗？',
      success: (res) => {
        if (res.confirm) {
          const addresses = this.data.addresses.filter(a => a.id !== id);
          this.setData({ addresses });
          this.saveAddresses();
        }
      }
    });
  },

  // Go back
  goBack() {
    wx.navigateBack();
  }
});
