// pages/home/home.js
const app = getApp()

Page({
  data: {
    bestSellers: [],
    scrollTop: 0
  },

  onLoad() {
    this.loadProducts();
    // Re-load when cloud data becomes available
    app.onDataReady(() => {
      this.loadProducts();
    });
  },

  onShow() {
    // Refresh when page becomes visible (cloud products may have loaded)
    this.loadProducts();
  },

  loadProducts() {
    const products = app.globalData.products.slice();
    products.sort((a, b) => b.sales - a.sales);
    this.setData({
      bestSellers: products.slice(0, 6)
    });
  },

  // Scroll to section
  scrollToStory() {
    wx.pageScrollTo({
      selector: '.story-section',
      duration: 300
    });
  },

  // Navigate to category page
  goToCategory() {
    wx.switchTab({
      url: '/pages/category/category'
    });
  },

  // Add product to cart
  addToCart(e) {
    const productId = e.currentTarget.dataset.id;
    const product = app.globalData.products.find(p =>
      p.id === productId || p._id === productId
    );
    if (product) {
      app.addToCart(product, 1);
    }
  },

  // Navigate to product detail
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/product-detail/product-detail?id=' + id
    });
  },

  // Share
  onShareAppMessage() {
    return {
      title: '茶语轩 - 一杯好茶，一段故事',
      path: '/pages/home/home'
    };
  }
});
