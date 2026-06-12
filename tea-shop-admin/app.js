// app.js - Tea Shop Admin (Seller Mini Program)
App({
  onLaunch() {
    // Initialize WeChat Cloud Development
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d8gth5z836912129a',  // Same cloud env as buyer app
        traceUser: true
      });
      this.globalData.cloudEnabled = true;
    }

    // Check seller permission
    this._checkSellerPermission();
  },

  // Check if current user is a registered seller
  _checkSellerPermission() {
    if (!wx.cloud) {
      this.globalData.authChecked = true;
      this.globalData.isSeller = true;  // Allow in dev mode without cloud
      this._notifyPages();
      return;
    }

    // Use getStatistics as the permission probe
    // If it returns code 0 → authorized seller
    // If it returns "Permission denied" → not a seller
    // If function not found → not deployed yet, allow with warning
    wx.cloud.callFunction({
      name: 'getStatistics',
      success: (res) => {
        if (res.result && res.result.code === 0) {
          this.globalData.isSeller = true;
        } else {
          this.globalData.isSeller = false;
        }
        this.globalData.authChecked = true;
        this._notifyPages();
      },
      fail: (err) => {
        console.error('Auth check failed:', err);
        // If cloud function not found, it means not deployed yet
        // In that case auto-register as seller (first-time setup)
        if (err.errMsg && err.errMsg.includes('could not be found')) {
          this._autoRegister();
        } else {
          this.globalData.isSeller = false;
          this.globalData.authChecked = true;
          this._notifyPages();
        }
      }
    });
  },

  // First-time setup: auto-register current user as seller
  _autoRegister() {
    wx.cloud.callFunction({
      name: 'registerSeller',
      success: (res) => {
        if (res.result && res.result.code === 0) {
          this.globalData.isSeller = true;
          this.globalData.isFirstSeller = true;
        } else {
          this.globalData.isSeller = false;
        }
        this.globalData.authChecked = true;
        this._notifyPages();
      },
      fail: () => {
        this.globalData.isSeller = false;
        this.globalData.authChecked = true;
        this._notifyPages();
      }
    });
  },

  // Notify all pages that auth check is complete
  _notifyPages() {
    const pages = getCurrentPages();
    pages.forEach(page => {
      if (page && typeof page._onAuthResult === 'function') {
        page._onAuthResult(this.globalData.isSeller);
      }
    });
  },

  globalData: {
    cloudEnabled: false,
    authChecked: false,
    isSeller: false,
    isFirstSeller: false,
    shopSettings: null,
    products: [],
    categories: ['绿茶', '红茶', '乌龙茶', '白茶', '花茶', '礼盒装']
  }
});
