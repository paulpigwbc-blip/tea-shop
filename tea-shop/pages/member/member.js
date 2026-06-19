// pages/member/member.js
const app = getApp()

Page({
  data: {
    userInfo: null,
    isLogin: false,
    showPrivacy: false,
    privacyContractName: '《茶语轩隐私保护指引》',
    profileIconPath: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM1NTU1NTUiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMCAyMXYtMmE0IDQgMCAwIDAtNC00SDhhNCA0IDAgMCAwLTQgNHYyIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0Ii8+PC9zdmc+',
    menuList: [
      {
        name: '我的订单',
        key: 'orders',
        iconPath: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM1NTU1NTUiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik05IDExSDE1TTkgMTVIMTVNOSA3SDE1TTUgMjFWNUM1IDMuODk1NDMgNS44OTU0MyAzIDcgM0gxN0MxOC4xMDQ2IDMgMTkgMy44OTU0MyAxOSA1VjIxTDE3IDE5LjVMMTUgMjFMMTMgMTkuNUwxMSAyMUw5IDE5LjVMNyAyMUw1IDE5LjVWMjFaIi8+PC9zdmc+'
      },
      {
        name: '收货地址',
        key: 'address',
        iconPath: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM1NTU1NTUiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMSAxMGMwIDctOSAxMy05IDEzcy05LTYtOS0xM2E5IDkgMCAwIDEgMTggMHoiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEwIiByPSIzIi8+PC9zdmc+'
      },
      {
        name: '设置',
        key: 'settings',
        iconPath: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM1NTU1NTUiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiLz48cGF0aCBkPSJNMTkuNCAxNWExLjY1IDEuNjUgMCAwIDAgLjMzIDEuODJsLjA2LjA2YTIgMiAwIDAgMSAwIDIuODMgMiAyIDAgMCAxLTIuODMgMGwtLjA2LS4wNmExLjY1IDEuNjUgMCAwIDAtMS44Mi0uMzMgMS42NSAxLjY1IDAgMCAwLTEgMS41MVYyMWEyIDIgMCAwIDEtMiAyIDIgMiAwIDAgMS0yLTJ2LS4wOUExLjY1IDEuNjUgMCAwIDAgOSAxOS40YTEuNjUgMS42NSAwIDAgMC0xLjgyLjMzbC0uMDYuMDZhMiAyIDAgMCAxLTIuODMgMCAyIDIgMCAwIDEgMC0yLjgzbC4wNi0uMDZhMS42NSAxLjY1IDAgMCAwIC4zMy0xLjgyIDEuNjUgMS42NSAwIDAgMC0xLjUxLTFIM2EyIDIgMCAwIDEtMi0yIDIgMiAwIDAgMSAyLTJoLjA5QTEuNjUgMS42NSAwIDAgMCA0LjYgOWExLjY1IDEuNjUgMCAwIDAtLjMzLTEuODJsLS4wNi0uMDZhMiAyIDAgMCAxIDAtMi44MyAyIDIgMCAwIDEgMi44MyAwbC4wNi4wNmExLjY1IDEuNjUgMCAwIDAgMS44Mi4zM0g5YTEuNjUgMS42NSAwIDAgMCAxLTEuNTFWM2EyIDIgMCAwIDEgMi0yIDIgMiAwIDAgMSAyIDJ2LjA5YTEuNjUgMS42NSAwIDAgMCAxIDEuNTEgMS42NSAxLjY1IDAgMCAwIDEuODItLjMzbC4wNi0uMDZhMiAyIDAgMCAxIDIuODMgMCAyIDIgMCAwIDEgMCAyLjgzbC0uMDYuMDZhMS42NSAxLjY1IDAgMCAwLS4zMyAxLjgyVjlhMS42NSAxLjY1IDAgMCAwIDEuNTEgMUgyMWEyIDIgMCAwIDEgMiAyIDIgMiAwIDAgMS0yIDJoLS4wOWExLjY1IDEuNjUgMCAwIDAtMS41MSAxeiIvPjwvc3ZnPg=='
      },
      {
        name: '关于我们',
        key: 'about',
        iconPath: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM1NTU1NTUiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PGxpbmUgeDE9IjEyIiB5MT0iMTYiIHgyPSIxMiIgeTI9IjEyIi8+PGxpbmUgeDE9IjEyIiB5MT0iOCIgeDI9IjEyLjAxIiB5Mj0iOCIvPjwvc3ZnPg=='
      }
    ]
  },

  onLoad() {
    this.loadUserInfo();
    this._initPrivacyListener();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
    this.loadUserInfo();
  },

  loadUserInfo() {
    const userInfo = app.globalData.userInfo;
    this.setData({
      userInfo: userInfo,
      isLogin: !!userInfo
    });
  },

  // ====== Privacy Authorization (Official WeChat API) ======

  // Register a passive listener: when any privacy-sensitive API is called
  // and the user hasn't consented yet, WeChat triggers this callback.
  _initPrivacyListener() {
    if (wx.onNeedPrivacyAuthorization) {
      wx.onNeedPrivacyAuthorization((resolve, eventInfo) => {
        console.log('[Privacy] onNeedPrivacyAuthorization triggered by:', eventInfo.referrer);
        // Show our custom popup, store the resolve function
        this._privacyResolve = resolve;
        this.setData({ showPrivacy: true });
      });
      console.log('[Privacy] Listener registered');
    } else {
      console.warn('[Privacy] wx.onNeedPrivacyAuthorization not available (base library < 2.32.3)');
    }
  },

  // Open the official privacy contract page
  handleOpenPrivacyContract() {
    wx.openPrivacyContract({
      success: () => {},
      fail: () => {
        wx.showToast({ title: '打开失败', icon: 'none' });
      }
    });
  },

  // User tapped "同意" on the privacy popup
  // The button has open-type="agreePrivacyAuthorization" so WeChat records consent
  handleAgreePrivacyAuthorization() {
    console.log('[Privacy] User agreed');
    this.setData({ showPrivacy: false });
    // Tell WeChat the user agreed, passing the button id
    if (this._privacyResolve) {
      this._privacyResolve({ buttonId: 'agree-btn', event: 'agree' });
      this._privacyResolve = null;
    }
  },

  // User tapped "拒绝" on the privacy popup
  handleDisagreePrivacy() {
    console.log('[Privacy] User disagreed');
    this.setData({ showPrivacy: false });
    if (this._privacyResolve) {
      this._privacyResolve({ event: 'disagree' });
      this._privacyResolve = null;
    }
  },

  // ====== Profile / Login ======

  // Profile tap: triggers login or shows profile
  onProfileTap() {
    if (this.data.isLogin) {
      wx.showActionSheet({
        itemList: ['查看个人资料', '退出登录'],
        success: (res) => {
          if (res.tapIndex === 0) {
            wx.showToast({ title: this.data.userInfo.nickName, icon: 'none' });
          } else if (res.tapIndex === 1) {
            this._logout();
          }
        }
      });
    } else {
      // Directly call wx.getUserProfile.
      // If privacy consent is needed, _initPrivacyListener will fire
      // and show the popup automatically.
      this._getUserProfile();
    }
  },

  // Call wx.getUserProfile to get real WeChat avatar & nickname
  _getUserProfile() {
    wx.getUserProfile({
      desc: '用于完善个人资料',
      success: (res) => {
        console.log('[Login] getUserProfile success:', res.userInfo.nickName);
        const wxUserInfo = res.userInfo;
        const stats = app.globalData.userStats || {};
        const userInfo = {
          avatarUrl: wxUserInfo.avatarUrl,
          nickName: wxUserInfo.nickName,
          balance: stats.balance || 0,
          coupons: stats.coupons || 0,
          points: stats.points || 0
        };
        app.globalData.userInfo = userInfo;
        wx.setStorageSync('userInfo', userInfo);
        this.setData({
          userInfo: userInfo,
          isLogin: true
        });
        wx.showToast({ title: '登录成功', icon: 'success' });
      },
      fail: (err) => {
        console.log('[Login] getUserProfile failed:', err);
        wx.showToast({ title: '已取消登录', icon: 'none' });
      }
    });
  },

  // Logout
  _logout() {
    app.globalData.userInfo = null;
    wx.removeStorageSync('userInfo');
    this.setData({
      userInfo: null,
      isLogin: false
    });
    wx.showToast({ title: '已退出登录', icon: 'none' });
  },

  // Menu item tap
  onMenuTap(e) {
    const key = e.currentTarget.dataset.key;
    switch (key) {
      case 'orders':
        wx.navigateTo({ url: '/pages/order-list/order-list' });
        break;
      case 'address':
        wx.navigateTo({ url: '/pages/address/address' });
        break;
      case 'settings':
        wx.showToast({ title: '设置功能开发中', icon: 'none' });
        break;
      case 'about':
        wx.showToast({ title: '关于我们开发中', icon: 'none' });
        break;
    }
  }
});
