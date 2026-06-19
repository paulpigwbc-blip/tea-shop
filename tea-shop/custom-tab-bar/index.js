// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/home/home',
        text: '首页',
        iconPath: '/images/tab-home.png',
        selectedIconPath: '/images/tab-home-active.png'
      },
      {
        pagePath: '/pages/category/category',
        text: '分类',
        iconPath: '/images/tab-category.png',
        selectedIconPath: '/images/tab-category-active.png'
      },
      {
        pagePath: '/pages/cart/cart',
        text: '购物车',
        iconPath: '/images/tab-cart.png',
        selectedIconPath: '/images/tab-cart-active.png'
      },
      {
        pagePath: '/pages/contact/contact',
        text: '联系我们',
        iconPath: '/images/tab-contact.png',
        selectedIconPath: '/images/tab-contact-active.png'
      },
      {
        pagePath: '/pages/member/member',
        text: '我的',
        iconPath: '/images/tab-user.png',
        selectedIconPath: '/images/tab-user-active.png'
      }
    ]
  },
  methods: {
    switchTab(e) {
      const path = e.currentTarget.dataset.path;
      wx.switchTab({ url: path });
    }
  }
});
