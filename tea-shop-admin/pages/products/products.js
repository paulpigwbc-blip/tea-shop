// pages/products/products.js
const app = getApp()

Page({
  data: {
    authState: 'loading',
    allProducts: [],       // Full product list from DB
    products: [],          // Filtered product list for display
    // Status filter
    statusOptions: ['全部', '上架中', '已下架'],
    statusValues: ['all', 'active', 'hidden'],
    activeStatus: 1,  // Default to 'active'
    // Category filter
    categoryOptions: ['全部'],
    activeCategory: 0
  },

  onLoad() {
    this._checkAuth();
  },

  onShow() {
    if (app.globalData.authChecked) {
      this._onAuthResult(app.globalData.isSeller);
    }
  },

  _checkAuth() {
    if (app.globalData.authChecked) {
      this._onAuthResult(app.globalData.isSeller);
    }
  },

  _onAuthResult(isSeller) {
    if (isSeller) {
      this.setData({ authState: 'allowed' });
      this.loadProducts();
    } else {
      this.setData({ authState: 'denied' });
    }
  },

  loadProducts() {
    const resourceCloud = app.globalData.resourceCloud;
    if (!resourceCloud) {
      console.warn('[Products] Resource cloud not available');
      return;
    }

    const db = resourceCloud.database();
    db.collection('products')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
      .then(res => {
        const allProducts = res.data || [];
        app.globalData.products = allProducts;

        // Build category options from actual data
        const catSet = new Set(allProducts.map(p => p.category).filter(Boolean));
        const categoryOptions = ['全部', ...Array.from(catSet)];

        this.setData({ allProducts, categoryOptions });
        this.applyFilters();
      })
      .catch(err => {
        console.error('Cloud load products error:', err);
        const allProducts = app.globalData.products || [];
        const catSet = new Set(allProducts.map(p => p.category).filter(Boolean));
        const categoryOptions = ['全部', ...Array.from(catSet)];
        this.setData({ allProducts, categoryOptions });
        this.applyFilters();
      });
  },

  // Apply both status and category filters
  applyFilters() {
    const { allProducts, activeStatus, activeCategory, statusValues, categoryOptions } = this.data;
    let filtered = allProducts;

    // Status filter
    const statusVal = statusValues[activeStatus];
    if (statusVal !== 'all') {
      filtered = filtered.filter(p => p.status === statusVal);
    }

    // Category filter
    if (activeCategory > 0 && categoryOptions[activeCategory]) {
      const cat = categoryOptions[activeCategory];
      filtered = filtered.filter(p => p.category === cat);
    }

    this.setData({ products: filtered });
  },

  // Switch status filter via picker
  switchStatus(e) {
    const index = Number(e.detail.value);
    this.setData({ activeStatus: index });
    this.applyFilters();
  },

  // Switch category filter via picker
  switchCategory(e) {
    const index = Number(e.detail.value);
    this.setData({ activeCategory: index });
    this.applyFilters();
  },

  goToEdit(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: '/pages/product-edit/product-edit?id=' + id
      });
    } else {
      wx.navigateTo({
        url: '/pages/product-edit/product-edit'
      });
    }
  },

  toggleStatus(e) {
    const id = e.currentTarget.dataset.id;
    const allProducts = this.data.allProducts;
    const product = allProducts.find(p => p._id === id);
    if (!product) return;

    const newStatus = product.status === 'active' ? 'hidden' : 'active';
    const statusLabel = newStatus === 'active' ? '上架' : '下架';

    wx.showLoading({ title: '处理中...' });

    if (wx.cloud) {
      // Use cloud function for DB write (bypasses security rules)
      wx.cloud.callFunction({
        name: 'updateProduct',
        data: {
          productId: id,
          productData: { ...product, status: newStatus },
          isNew: false
        },
        success: (res) => {
          wx.hideLoading();
          if (res.result && res.result.code === 0) {
            product.status = newStatus;
            this.setData({ allProducts });
            this.applyFilters();
            wx.showToast({ title: `已${statusLabel}`, icon: 'success' });
          } else {
            const msg = (res.result && res.result.message) || '操作失败';
            wx.showToast({ title: msg, icon: 'none' });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('Toggle status cloud function failed:', err);
          wx.showToast({ title: '云函数调用失败', icon: 'none' });
        }
      });
    } else {
      this._toggleFallback(product, newStatus, statusLabel);
    }
  },

  _toggleFallback(product, newStatus, statusLabel) {
    product.status = newStatus;
    this.setData({ allProducts: this.data.allProducts });
    this.applyFilters();
    wx.showToast({ title: `已${statusLabel}`, icon: 'success' });
  }
});
