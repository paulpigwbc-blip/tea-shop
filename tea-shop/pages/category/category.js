// pages/category/category.js
const app = getApp()

Page({
  data: {
    categories: [],
    activeCategory: 0,
    products: [],
    filteredProducts: [],
    searchText: '',
    quantityMap: {}
  },

  onLoad() {
    this.loadFromGlobal();
    // Re-load when cloud data becomes available
    app.onDataReady(() => {
      this.loadFromGlobal();
    });
  },

  onShow() {
    // Refresh when cloud data may have loaded
    this.loadFromGlobal();
    // Refresh quantity map from cart
    const quantityMap = {};
    app.globalData.cart.forEach(item => {
      quantityMap[item.id] = item.quantity;
    });
    this.setData({ quantityMap: quantityMap });
  },

  loadFromGlobal() {
    const categories = app.globalData.categories;
    const products = app.globalData.products;

    // Build quantity map from cart
    const quantityMap = {};
    app.globalData.cart.forEach(item => {
      quantityMap[item.id] = item.quantity;
    });

    const activeCategory = this.data.activeCategory || 0;
    const categoryName = categories[activeCategory] || categories[0];

    this.setData({
      categories: categories,
      products: products,
      filteredProducts: products.filter(p => p.category === categoryName),
      quantityMap: quantityMap
    });
  },

  // Select category
  selectCategory(e) {
    const index = e.currentTarget.dataset.index;
    const category = this.data.categories[index];
    const filtered = this.data.products.filter(p => p.category === category);
    this.setData({
      activeCategory: index,
      filteredProducts: filtered
    });
  },

  // Search input
  onSearchInput(e) {
    this.setData({
      searchText: e.detail.value
    });
  },

  // Execute search
  onSearch() {
    const keyword = this.data.searchText.trim();
    if (!keyword) {
      const category = this.data.categories[this.data.activeCategory];
      this.setData({
        filteredProducts: this.data.products.filter(p => p.category === category)
      });
      return;
    }
    const results = this.data.products.filter(p =>
      p.name.includes(keyword) || p.desc.includes(keyword) || p.category.includes(keyword)
    );
    this.setData({ filteredProducts: results });
  },

  // Clear search
  clearSearch() {
    const category = this.data.categories[this.data.activeCategory];
    this.setData({
      searchText: '',
      filteredProducts: this.data.products.filter(p => p.category === category)
    });
  },

  // Increase quantity
  increaseQty(e) {
    const id = e.currentTarget.dataset.id;
    const product = this.data.products.find(p => p.id === id || p._id === id);
    if (!product) return;

    app.addToCart(product, 1);
    
    const quantityMap = this.data.quantityMap;
    quantityMap[id] = (quantityMap[id] || 0) + 1;
    this.setData({ quantityMap: quantityMap });
  },

  // Decrease quantity
  decreaseQty(e) {
    const id = e.currentTarget.dataset.id;
    const quantityMap = this.data.quantityMap;
    if (!quantityMap[id] || quantityMap[id] <= 0) return;

    const newQty = quantityMap[id] - 1;
    if (newQty <= 0) {
      delete quantityMap[id];
      app.removeFromCart(id);
    } else {
      quantityMap[id] = newQty;
      app.updateCartQuantity(id, newQty);
    }
    this.setData({ quantityMap: quantityMap });
  },

  // Navigate to product detail
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/product-detail/product-detail?id=' + id
    });
  }
});
