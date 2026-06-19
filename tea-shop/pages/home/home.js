// pages/home/home.js
const app = getApp()

Page({
  data: {
    featuredProduct: null
  },

  onLoad() {
    this.loadFeaturedProduct();
    // Re-load when cloud data becomes available
    app.onDataReady(() => {
      this.loadFeaturedProduct();
    });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    // Refresh when page becomes visible
    this.loadFeaturedProduct();
  },

  loadFeaturedProduct() {
    const products = app.globalData.products || [];
    
    if (products.length === 0) {
      // Fallback: Show a mock featured product if no products loaded
      this.setData({
        featuredProduct: {
          id: 'mock_featured',
          name: '武夷大红袍',
          category: '红茶',
          desc: '生长于武夷山岩壁之间，独特的"岩骨花香"令人回味无穷。九次焙火，方得一味醇厚。',
          price: 388,
          image: ''
        }
      });
      return;
    }

    // Select featured product: highest sales from '红茶' category
    const blackTeaProducts = products.filter(p => p.category === '红茶');
    let featured;
    
    if (blackTeaProducts.length > 0) {
      // Prefer black tea products
      featured = blackTeaProducts.sort((a, b) => (b.sales || 0) - (a.sales || 0))[0];
    } else {
      // Fallback to any product with highest sales
      featured = products.sort((a, b) => (b.sales || 0) - (a.sales || 0))[0];
    }

    if (featured) {
      this.setData({
        featuredProduct: {
          id: featured._id || featured.id,
          name: featured.name,
          category: featured.category,
          desc: featured.desc || '精选好茶，匠心制作',
          price: featured.price,
          image: featured.images ? (featured.images[featured.coverIndex || 0] || featured.images[0]) : ''
        }
      });
    }
  },

  // Navigate to category page
  goToCategory() {
    wx.switchTab({
      url: '/pages/category/category'
    });
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