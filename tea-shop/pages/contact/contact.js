// pages/contact/contact.js
Page({
  data: {
    phone: '400-888-6789',
    wechat: 'chayuxuan_tea',
    storeHours: '09:00 - 21:00（周一至周日）'
  },

  // Make phone call
  makeCall(e) {
    const phone = e.currentTarget.dataset.phone || this.data.phone;
    wx.makePhoneCall({
      phoneNumber: phone,
      fail: () => {
        wx.showToast({ title: '拨打失败', icon: 'none' });
      }
    });
  },

  // Copy WeChat ID
  copyWechat() {
    wx.setClipboardData({
      data: this.data.wechat,
      success: () => {
        wx.showToast({ title: '微信号已复制', icon: 'success' });
      }
    });
  }
});
