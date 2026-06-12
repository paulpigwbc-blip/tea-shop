// pages/product-detail/product-detail.js
const app = getApp()

Page({
  data: {
    product: null,
    quantity: 1,
    quantityInCart: 0
  },

  onLoad(options) {
    const productId = options.id;
    // Support both cloud _id (string) and mock id (number)
    const product = app.globalData.products.find(p =>
      p.id === productId || p._id === productId || p.id === parseInt(productId)
    );
    if (!product) {
      wx.showToast({ title: '商品不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // Check quantity in cart
    const cartItem = app.globalData.cart.find(item =>
      item.id === productId || item._id === productId
    );
    const quantityInCart = cartItem ? cartItem.quantity : 0;

    this.setData({
      product,
      quantityInCart
    });

    wx.setNavigationBarTitle({ title: product.name });
  },

  // Increase quantity
  increaseQty() {
    this.setData({
      quantity: this.data.quantity + 1
    });
  },

  // Decrease quantity
  decreaseQty() {
    if (this.data.quantity > 1) {
      this.setData({
        quantity: this.data.quantity - 1
      });
    }
  },

  // Add to cart
  addToCart() {
    const product = this.data.product;
    if (!product) return;
    app.addToCart(product, this.data.quantity);
    this.setData({
      quantityInCart: this.data.quantityInCart + this.data.quantity,
      quantity: 1
    });
  },

  // Buy now - go to checkout with this item
  buyNow() {
    const product = this.data.product;
    if (!product) return;

    // Temporarily set checkout items
    app.globalData.checkoutItems = [{
      ...product,
      quantity: this.data.quantity,
      checked: true
    }];

    wx.navigateTo({
      url: '/pages/order-confirm/order-confirm?from=buyNow'
    });
  },

  // Go to cart
  goToCart() {
    wx.switchTab({
      url: '/pages/cart/cart'
    });
  },

  // Preview image fullscreen
  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    const images = this.data.product.images || [];
    wx.previewImage({
      current: src,
      urls: images
    });
  },

  // Share
  onShareAppMessage() {
    return {
      title: this.data.product.name + ' - 茶语轩',
      path: '/pages/product-detail/product-detail?id=' + this.data.product.id
    };
  }
});
