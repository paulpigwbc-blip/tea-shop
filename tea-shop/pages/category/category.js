// pages/category/category.js
const app = getApp()

Page({
  data: {
    categories: [],
    activeCategory: 0,
    products: [],
    filteredProducts: [],
    searchText: '',
    quantityMap: {},
    flyDots: [],
    flyDotKey: 0
  },

  onLoad() {
    this.loadFromGlobal();
    // Re-load when cloud data becomes available
    app.onDataReady(() => {
      this.loadFromGlobal();
    });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
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

    app.addToCart(product, 1, true);  // silent: no toast

    const quantityMap = this.data.quantityMap;
    quantityMap[id] = (quantityMap[id] || 0) + 1;
    this.setData({ quantityMap: quantityMap });

    // Trigger fly-to-cart animation
    this.flyToCart(e);
  },

  // Fly-to-cart animation
  flyToCart(e) {
    // Get tap position (touch coordinates relative to page)
    let touch = e.touches && e.touches[0];
    if (!touch && e.changedTouches) touch = e.changedTouches[0];
    if (!touch) return;

    const startX = touch.clientX || touch.x || 0;
    const startY = touch.clientY || touch.y || 0;

    // Target: cart tab icon (bottom area, approximate center-right of cart tab)
    const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const screenWidth = sysInfo.windowWidth;
    const screenHeight = sysInfo.windowHeight;
    // Cart tab is the 3rd of 5 tabs → roughly center of screen horizontally
    const endX = screenWidth * 0.5;
    const endY = screenHeight - 20;  // bottom of page (tab bar)

    // Midpoint for arc (parabola peak - higher than straight line)
    const midX = (startX + endX) / 2;
    const midY = Math.min(startY, endY) - 80;

    const key = 'dot_' + (++this.data.flyDotKey);

    // Create the animation
    const anim = wx.createAnimation({
      duration: 300,
      timingFunction: 'linear',
      delay: 0
    });

    // Step 1: move to midpoint (arc up)
    anim.translate(midX - startX, midY - startY).opacity(0.9).step({
      duration: 300,
      timingFunction: 'ease-out'
    });

    // Step 2: move from midpoint to end point, shrink + fade
    anim.translate(endX - midX, endY - midY).opacity(0).scale(0.3).step({
      duration: 300,
      timingFunction: 'ease-in'
    });

    // Add the dot
    const flyDots = this.data.flyDots.concat([{
      key: key,
      x: startX,
      y: startY,
      animation: anim.export()
    }]);
    this.setData({ flyDots: flyDots });

    // Remove the dot after animation completes
    setTimeout(() => {
      this.setData({
        flyDots: this.data.flyDots.filter(d => d.key !== key)
      });
    }, 700);
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
