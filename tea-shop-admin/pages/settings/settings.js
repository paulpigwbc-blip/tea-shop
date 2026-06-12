// pages/settings/settings.js
const app = getApp()

Page({
  data: {
    authState: 'loading',
    shopSettings: {
      name: '茶语轩',
      isOpen: true,
      businessHours: '09:00-21:00',
      announcement: '欢迎光临茶语轩'
    }
  },

  onLoad() {
    this._checkAuth();
  },

  onShow() {
    if (app.globalData.authChecked) {
      this._onAuthResult(app.globalData.isSeller);
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
      this.loadSettings();
    } else {
      this.setData({ authState: 'denied' });
    }
  },

  loadSettings() {
    if (wx.cloud) {
      const db = wx.cloud.database();
      db.collection('shop-settings').doc('shop').get().then(res => {
        if (res.data) {
          app.globalData.shopSettings = res.data;
          this.setData({ shopSettings: res.data });
        }
      }).catch(err => {
        console.error('Load shop settings error:', err);
        const shopSettings = app.globalData.shopSettings || this.data.shopSettings;
        this.setData({ shopSettings });
      });
    } else {
      const shopSettings = app.globalData.shopSettings || this.data.shopSettings;
      this.setData({ shopSettings });
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`shopSettings.${field}`]: e.detail.value });
  },

  toggleShop() {
    const isOpen = !this.data.shopSettings.isOpen;
    this.setData({ 'shopSettings.isOpen': isOpen });
  },

  saveSettings() {
    const settings = this.data.shopSettings;
    if (wx.cloud) {
      wx.showLoading({ title: '保存中...' });
      const db = wx.cloud.database();
      db.collection('shop-settings').doc('shop').update({
        data: {
          name: settings.name,
          isOpen: settings.isOpen,
          businessHours: settings.businessHours,
          announcement: settings.announcement,
          updatedAt: db.serverDate()
        }
      }).then(() => {
        wx.hideLoading();
        app.globalData.shopSettings = settings;
        wx.showToast({ title: '设置已保存', icon: 'success' });
      }).catch(err => {
        wx.hideLoading();
        console.error('Save settings error:', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
    } else {
      app.globalData.shopSettings = settings;
      wx.setStorageSync('shopSettings', settings);
      wx.showToast({ title: '设置已保存', icon: 'success' });
    }
  }
});
