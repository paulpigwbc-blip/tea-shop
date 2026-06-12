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

    // Mock user info
    const userInfo = wx.getStorageSync('userInfo') || {
      avatarUrl: '',
      nickName: '茶友',
      balance: 128.50,
      coupons: 5,
      points: 2680
    };
    this.globalData.userInfo = userInfo;
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

          const products = res.data.map(p => ({
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
    cloudEnabled: false,
    checkoutItems: null,
    cloudDataReady: false,
    dataReadyCallbacks: [],
    // All products mock data
    products: [
      // 绿茶
      { id: 1, name: '西湖龙井', desc: '明前特级 鲜爽回甘', price: 268, category: '绿茶', image: '/images/products/longjing.jpg', sales: 1580 },
      { id: 2, name: '碧螺春', desc: '洞庭东山 嫩香清雅', price: 198, category: '绿茶', image: '/images/products/biluochun.jpg', sales: 920 },
      { id: 3, name: '黄山毛峰', desc: '高山云雾 清香持久', price: 158, category: '绿茶', image: '/images/products/maofeng.jpg', sales: 760 },
      { id: 4, name: '信阳毛尖', desc: '核心产区 鲜浓甘爽', price: 138, category: '绿茶', image: '/images/products/maojian.jpg', sales: 650 },
      // 红茶
      { id: 5, name: '正山小种', desc: '桐木关原产 松烟香', price: 298, category: '红茶', image: '/images/products/xiaozhong.jpg', sales: 1320 },
      { id: 6, name: '金骏眉', desc: '芽头金黄 蜜香馥郁', price: 599, category: '红茶', image: '/images/products/jinjunmei.jpg', sales: 890 },
      { id: 7, name: '祁门红茶', desc: '祁红特绝 似花似蜜', price: 258, category: '红茶', image: '/images/products/qimen.jpg', sales: 540 },
      { id: 8, name: '滇红金芽', desc: '云南大叶 金毫显露', price: 188, category: '红茶', image: '/images/products/dianhong.jpg', sales: 430 },
      // 乌龙茶
      { id: 9, name: '铁观音', desc: '安溪原产 兰香雅韵', price: 228, category: '乌龙茶', image: '/images/products/tieguanyin.jpg', sales: 2100 },
      { id: 10, name: '大红袍', desc: '武夷岩韵 岩骨花香', price: 388, category: '乌龙茶', image: '/images/products/dahongpao.jpg', sales: 1560 },
      { id: 11, name: '凤凰单丛', desc: '潮州凤凰 丛韵独特', price: 328, category: '乌龙茶', image: '/images/products/dancong.jpg', sales: 680 },
      { id: 12, name: '冻顶乌龙', desc: '台湾高山 滋味醇厚', price: 278, category: '乌龙茶', image: '/images/products/dongding.jpg', sales: 520 },
      // 白茶
      { id: 13, name: '白毫银针', desc: '满披白毫 芽头肥壮', price: 488, category: '白茶', image: '/images/products/yinzhen.jpg', sales: 760 },
      { id: 14, name: '白牡丹', desc: '一芽一二叶 清甜醇爽', price: 268, category: '白茶', image: '/images/products/baimudan.jpg', sales: 620 },
      { id: 15, name: '寿眉', desc: '老白茶 陈香药韵', price: 168, category: '白茶', image: '/images/products/shoumei.jpg', sales: 480 },
      // 花茶
      { id: 16, name: '茉莉龙珠', desc: '茉莉窨制 花香怡人', price: 128, category: '花茶', image: '/images/products/longzhu.jpg', sales: 1800 },
      { id: 17, name: '玫瑰花茶', desc: '平阴玫瑰 芬芳馥郁', price: 88, category: '花茶', image: '/images/products/meigui.jpg', sales: 1350 },
      { id: 18, name: '桂花乌龙', desc: '桂花与乌龙的邂逅', price: 108, category: '花茶', image: '/images/products/guihua.jpg', sales: 920 },
      // 礼盒装
      { id: 19, name: '经典名茶礼盒', desc: '六大名茶 精美礼盒', price: 599, category: '礼盒装', image: '/images/products/lihe-classic.jpg', sales: 420 },
      { id: 20, name: '龙井尊享礼盒', desc: '特级龙井 商务之选', price: 388, category: '礼盒装', image: '/images/products/lihe-longjing.jpg', sales: 350 },
      { id: 21, name: '大红袍礼盒', desc: '岩茶至尊 送礼佳品', price: 458, category: '礼盒装', image: '/images/products/lihe-dahongpao.jpg', sales: 290 },
      { id: 22, name: '白茶年鉴礼盒', desc: '三年白茶 岁月陈香', price: 528, category: '礼盒装', image: '/images/products/lihe-baicha.jpg', sales: 210 }
    ],
    categories: ['绿茶', '红茶', '乌龙茶', '白茶', '花茶', '礼盒装']
  },

  // Cart operations
  addToCart(product, quantity) {
    const cart = this.globalData.cart;
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({ ...product, quantity: quantity, checked: true });
    }
    this.saveCart();
    wx.showToast({ title: '已加入购物车', icon: 'success' });
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
