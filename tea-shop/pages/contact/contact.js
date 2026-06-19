// pages/contact/contact.js
Page({
  data: {
    phone: '400-888-6789',
    wechat: 'chayuxuan_tea',
    phoneIcon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM1NTU1NTUiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMiAxNi45MnYzYTIgMiAwIDAgMS0yLjE4IDIgMTkuNzkgMTkuNzkgMCAwIDEtOC42My0zLjA3IDE5LjUgMTkuNSAwIDAgMS02LTYgMTkuNzkgMTkuNzkgMCAwIDEtMy4wNy04LjY3QTIgMiAwIDAgMSA0LjExIDJoM2EyIDIgMCAwIDEgMiAxLjcyYy4xMjcuOTYuMzYxIDEuOTAzLjcgMi44MWEyIDIgMCAwIDEtLjQ1IDIuMTFMOC4wOSA5LjkxYTE2IDE2IDAgMCAwIDYgNmwxLjI3LTEuMjdhMiAyIDAgMCAxIDIuMTEtLjQ1Yy45MDcuMzM5IDEuODUuNTczIDIuODEuN0EyIDIgMCAwIDEgMjIgMTYuOTJ6Ii8+PC9zdmc+',
    wechatIcon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM1NTU1NTUiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMSAxMS41YTguMzggOC4zOCAwIDAgMS0uOSAzLjggOC41IDguNSAwIDAgMS03LjYgNC43IDguMzggOC4zOCAwIDAgMS0zLjgtLjlMMyAyMWwxLjktNS43YTguMzggOC4zOCAwIDAgMS0uOS0zLjggOC41IDguNSAwIDAgMSA0LjctNy42IDguMzggOC4zOCAwIDAgMSAzLjgtLjloLjVhOC40OCA4LjQ4IDAgMCAxIDggOHYuNXoiLz48L3N2Zz4=',
    truckIcon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM1NTU1NTUiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjEiIHk9IjMiIHdpZHRoPSIxNSIgaGVpZ2h0PSIxMyIvPjxwb2x5Z29uIHBvaW50cz0iMTYgOCAyMCA4IDIzIDExIDIzIDE2IDE2IDE2IDE2IDgiLz48Y2lyY2xlIGN4PSI1LjUiIGN5PSIxOC41IiByPSIyLjUiLz48Y2lyY2xlIGN4PSIxOC41IiBjeT0iMTguNSIgcj0iMi41Ii8+PC9zdmc+'
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
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
