// pages/member/member.js
const app = getApp()

Page({
  data: {
    userInfo: null,
    isLogin: false,
    menuList: [
      { icon: '📦', name: '我的订单', key: 'orders', iconBg: 'order-bg' },
      { icon: '📍', name: '收货地址', key: 'address', iconBg: 'address-bg' },
      { icon: '⚙', name: '设置', key: 'settings', iconBg: 'settings-bg' },
      { icon: 'ℹ', name: '关于我们', key: 'about', iconBg: 'about-bg' }
    ]
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    const userInfo = app.globalData.userInfo;
    this.setData({
      userInfo: userInfo,
      isLogin: !!userInfo
    });
  },

  // Login
  handleLogin() {
    const userInfo = {
      avatarUrl: '',
      nickName: '茶友' + Math.floor(Math.random() * 10000)
    };
    app.globalData.userInfo = userInfo;
    wx.setStorageSync('userInfo', userInfo);
    this.setData({
      userInfo: userInfo,
      isLogin: true
    });
    wx.showToast({ title: '登录成功', icon: 'success' });
  },

  // Menu item tap
  onMenuTap(e) {
    const key = e.currentTarget.dataset.key;
    switch (key) {
      case 'orders':
        wx.navigateTo({
          url: '/pages/order-list/order-list'
        });
        break;
      case 'address':
        wx.navigateTo({
          url: '/pages/address/address'
        });
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
