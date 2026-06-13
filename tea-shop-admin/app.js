// app.js - Tea Shop Admin (Seller Mini Program)
// 使用环境共享访问 tea-shop 的云开发资源
App({
  async onLaunch() {
    console.log('[App] App launched');

    if (!wx.cloud) {
      console.warn('[App] wx.cloud not available');
      return;
    }

    // 初始化资源方的 cloud 实例（跨账号环境共享）
    try {
      this.globalData.resourceCloud = new wx.cloud.Cloud({
        // 资源方 AppID (tea-shop)
        resourceAppid: 'wx589b6eb5ff420b6a',
        // 资源方环境 ID
        resourceEnv: 'cloud1-d8gth5z836912129a',
      });

      console.log('[App] Initializing resource cloud...');
      // 跨账号调用，必须等待 init 完成
      await this.globalData.resourceCloud.init();
      console.log('[App] Resource cloud initialized successfully');
      this.globalData.cloudEnabled = true;
    } catch (err) {
      console.error('[App] Resource cloud init failed:', err);
      return;
    }

    // 测试连接
    setTimeout(() => {
      this._testCloudConnection();
    }, 500);
  },

  _testCloudConnection() {
    console.log('[App] Testing cloud connection...');
    
    // Try calling ping function (should exist)
    this.globalData.resourceCloud.callFunction({
      name: 'ping',
      success: (res) => {
        console.log('[App] Cloud connection test PASSED:', res.result);
        this._checkSellerPermission();
      },
      fail: (err) => {
        console.error('[App] Cloud connection test FAILED:', err);
        console.error('[App] Error code:', err.errCode);
        console.error('[App] Error message:', err.errMsg);
        // Still try permission check
        this._checkSellerPermission();
      }
    });
  },

  _checkSellerPermission() {
    if (!wx.cloud) {
      this.globalData.authChecked = true;
      this.globalData.isSeller = true;  // Allow in dev mode without cloud
      this._notifyPages();
      return;
    }

    console.log('[App] Starting permission check...');

    // First test: try to read from database to verify environment is accessible
    this.globalData.resourceCloud.database().collection('shop-settings').doc('shop').get({
      success: (res) => {
        console.log('[App] DB test passed, shop settings found:', res.data);
        this._callGetStatistics();
      },
      fail: (err) => {
        console.error('[App] DB test failed:', err);
        // DB fails, try cloud function anyway
        this._callGetStatistics();
      }
    });
  },

  _callGetStatistics() {
    console.log('[App] Calling getStatistics cloud function...');
    // Use getStatistics as the permission probe
    // If it returns code 0 → authorized seller
    // If it returns "Permission denied" → not a seller, auto-register
    // If function not found → not deployed yet, allow with warning
    this.globalData.resourceCloud.callFunction({
      name: 'getStatistics',
      success: (res) => {
        if (res.result && res.result.code === 0) {
          this.globalData.isSeller = true;
        } else {
          const msg = res.result && res.result.message || '';
          console.log('[App] getStatistics result:', res.result);
          // If permission denied, try to register as seller
          if (msg.includes('Permission denied') || msg.includes('only seller')) {
            console.log('[App] Permission denied, attempting to auto-register...');
            this._autoRegister();
            return; // _autoRegister will handle the rest
          }
          this.globalData.isSeller = false;
        }
        this.globalData.authChecked = true;
        this._notifyPages();
      },
      fail: (err) => {
        console.error('Auth check failed:', err);
        const msg = err.errMsg || err.message || '';
        // If cloud function not found, it means not deployed yet
        // If environment not found, shared env may not be bound yet
        if (msg.includes('could not be found') || msg.includes('Environment not found') || msg.includes('-501000')) {
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
    this.globalData.resourceCloud.callFunction({
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
    categories: ['绿茶', '红茶', '乌龙茶', '白茶', '花茶', '礼盒装'],
    // 资源方的 cloud 实例（用于环境共享）
    resourceCloud: null
  }
});
