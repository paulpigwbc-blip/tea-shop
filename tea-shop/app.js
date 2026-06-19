// app.js
App({
  onLaunch() {
    // Initialize WeChat Cloud Development
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d8gth5z836912129a',
        traceUser: true
      });
      this.globalData.cloudEnabled = true;
      // Load products from cloud database
      this.loadCloudProducts();
    }

    // Load cart from local storage
    const cart = wx.getStorageSync('cart') || [];
    this.globalData.cart = cart;

    // Load orders from local storage
    const orders = wx.getStorageSync('orders') || [];
    this.globalData.orders = orders;

    // Load user info from local storage (WeChat manages privacy consent)
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }
    // App-level stats (not personal data)
    this.globalData.userStats = {
      balance: 128.50,
      coupons: 5,
      points: 2680
    };
  },

  // Load products from cloud database (replaces mock data)
  loadCloudProducts() {
    const db = wx.cloud.database();
    db.collection('products').where({ status: 'active' }).limit(100).get({
      success: (res) => {
        if (res.data && res.data.length > 0) {
          // Debug: log raw DB response details
          console.log('[Products] Raw DB count:', res.data.length);
          const liheProducts = res.data.filter(p => (p.category || '').includes('礼盒'));
          console.log('[Products] 礼盒装 raw:', JSON.stringify(liheProducts.map(p => ({
            name: p.name, category: p.category, status: p.status, _id: p._id
          }))));

          const products = res.data
            .filter(p => p.category === '红茶')
            .map(p => ({
            id: p._id,
            _id: p._id,
            name: p.name,
            desc: p.description || p.desc || '',
            price: p.price,
            category: p.category,
            image: p.image || (p.images && p.images[p.coverIndex || 0]) || (p.images && p.images[0]) || '',
            images: p.images || [],
            coverIndex: p.coverIndex || 0,
            sales: p.sales || 0,
            stock: p.stock || 0
          }));
          this.globalData.products = products;
          this.globalData.cloudDataReady = true;

          // Debug: log product count per category
          const catCount = {};
          products.forEach(p => {
            catCount[p.category] = (catCount[p.category] || 0) + 1;
          });
          console.log('[Products] Loaded ' + products.length + ' from cloud');
          console.log('[Products] By category:', JSON.stringify(catCount));

          // Debug: also query ALL products (no status filter) to compare
          db.collection('products').limit(100).field({ name: true, category: true, status: true }).get().then(allRes => {
            const allCount = {};
            (allRes.data || []).forEach(p => {
              const key = p.category + '(' + (p.status || 'none') + ')';
              allCount[key] = (allCount[key] || 0) + 1;
            });
            console.log('[Products] ALL in DB (no filter):', JSON.stringify(allCount));
            console.log('[Products] ALL DB count:', (allRes.data || []).length);
          }).catch(() => {});

          // Convert cloud fileIDs to temp URLs for reliable image display
          this._resolveProductImages();

          // Notify waiting pages
          (this.globalData.dataReadyCallbacks || []).forEach(cb => {
            try { cb(); } catch (e) {}
          });
          this.globalData.dataReadyCallbacks = [];
        }
      },
      fail: (err) => {
        console.error('Failed to load cloud products, using mock data:', err);
        this.globalData.cloudDataReady = true;
      }
    });
  },

  // Register callback to be called when cloud data is ready
  onDataReady(cb) {
    if (this.globalData.cloudDataReady) {
      cb(); // data already loaded
    } else {
      this.globalData.dataReadyCallbacks = this.globalData.dataReadyCallbacks || [];
      this.globalData.dataReadyCallbacks.push(cb);
    }
  },

  // Convert all cloud:// fileIDs in product images to temp HTTP URLs
  _resolveProductImages() {
    const allFileIDs = [];
    this.globalData.products.forEach(p => {
      if (p.images) {
        p.images.forEach(url => {
          if (typeof url === 'string' && url.startsWith('cloud://') && !allFileIDs.includes(url)) {
            allFileIDs.push(url);
          }
        });
      }
    });

    if (allFileIDs.length === 0) return;

    wx.cloud.getTempFileURL({
      fileList: allFileIDs,
      success: (res) => {
        const fileMap = {};
        (res.fileList || []).forEach(item => {
          if (item.tempFileURL) {
            fileMap[item.fileID] = item.tempFileURL;
          }
        });

        // Update product data with resolved URLs
        this.globalData.products.forEach(p => {
          if (p.images && p.images.length > 0) {
            p.images = p.images.map(url => fileMap[url] || url);
            // Update cover image
            const idx = p.coverIndex || 0;
            p.image = p.images[idx] || p.images[0] || '';
          }
        });

        console.log('Resolved ' + Object.keys(fileMap).length + ' image URLs');

        // Notify visible pages to refresh
        const pages = getCurrentPages();
        pages.forEach(page => {
          if (page) {
            if (typeof page.loadProducts === 'function') page.loadProducts();
            if (typeof page.loadFromGlobal === 'function') page.loadFromGlobal();
          }
        });
      },
      fail: (err) => {
        console.warn('Failed to resolve image URLs:', err);
      }
    });
  },

  globalData: {
    cart: [],
    orders: [],
    userInfo: null,
    userStats: null,
    cloudEnabled: false,
    checkoutItems: null,
    cloudDataReady: false,
    dataReadyCallbacks: [],
    // All products mock data
    products: [
      // 红茶
      { id: 5, name: '正山小种', desc: '桐木关原产 松烟香', price: 298, category: '红茶', image: '/images/products/xiaozhong.jpg', sales: 1320 },
      { id: 6, name: '金骏眉', desc: '芽头金黄 蜜香馥郁', price: 599, category: '红茶', image: '/images/products/jinjunmei.jpg', sales: 890 },
      { id: 7, name: '祁门红茶', desc: '祁红特绝 似花似蜜', price: 258, category: '红茶', image: '/images/products/qimen.jpg', sales: 540 },
      { id: 8, name: '滇红金芽', desc: '云南大叶 金毫显露', price: 188, category: '红茶', image: '/images/products/dianhong.jpg', sales: 430 }
    ],
    categories: ['红茶']
  },

  // Cart operations
  addToCart(product, quantity, silent) {
    const cart = this.globalData.cart;
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({ ...product, quantity: quantity, checked: true });
    }
    this.saveCart();
    if (!silent) {
      wx.showToast({ title: '已加入购物车', icon: 'success' });
    }
  },

  removeFromCart(productId) {
    this.globalData.cart = this.globalData.cart.filter(item => item.id !== productId);
    this.saveCart();
  },

  updateCartQuantity(productId, quantity) {
    const item = this.globalData.cart.find(item => item.id === productId);
    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else {
        item.quantity = quantity;
        this.saveCart();
      }
    }
  },

  getCartTotal() {
    const cart = this.globalData.cart;
    return cart.reduce((total, item) => {
      return item.checked ? total + item.price * item.quantity : total;
    }, 0);
  },

  getCartCount() {
    return this.globalData.cart.reduce((count, item) => {
      return item.checked ? count + item.quantity : count;
    }, 0);
  },

  saveCart() {
    wx.setStorageSync('cart', this.globalData.cart);
  }
});
