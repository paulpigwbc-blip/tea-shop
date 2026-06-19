// pages/cart/cart.js
const app = getApp()

Page({
  data: {
    cartItems: [],
    isAllChecked: false,
    totalCount: 0,
    totalPrice: 0,
    isManageMode: false,
    selectedCount: 0
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.loadCart();
  },

  loadCart() {
    const cartItems = app.globalData.cart.map(item => ({ ...item }));
    const isAllChecked = cartItems.length > 0 && cartItems.every(item => item.checked);
    this.setData({
      cartItems: cartItems,
      isAllChecked: isAllChecked
    });
    this.calculateTotal();
  },

  // Toggle manage mode
  toggleManageMode() {
    const isManageMode = !this.data.isManageMode;
    this.setData({ isManageMode: isManageMode });
    this.updateSelectedCount();
    this.calculateTotal();
  },

  // Update selected count for manage mode
  updateSelectedCount() {
    const selectedCount = this.data.cartItems.filter(item => item.checked).length;
    this.setData({ selectedCount: selectedCount });
  },

  // Toggle item check
  toggleCheck(e) {
    const id = e.currentTarget.dataset.id;
    const cartItems = this.data.cartItems;
    const item = cartItems.find(item => item.id === id);
    if (item) {
      item.checked = !item.checked;
      // Update global cart
      const globalItem = app.globalData.cart.find(i => i.id === id);
      if (globalItem) globalItem.checked = item.checked;
      app.saveCart();
    }
    const isAllChecked = cartItems.every(item => item.checked);
    this.setData({ cartItems: cartItems, isAllChecked: isAllChecked });
    this.updateSelectedCount();
    this.calculateTotal();
  },

  // Toggle select all
  toggleSelectAll() {
    const isAllChecked = !this.data.isAllChecked;
    const cartItems = this.data.cartItems;
    cartItems.forEach(item => {
      item.checked = isAllChecked;
      const globalItem = app.globalData.cart.find(i => i.id === item.id);
      if (globalItem) globalItem.checked = isAllChecked;
    });
    app.saveCart();
    this.setData({ cartItems: cartItems, isAllChecked: isAllChecked });
    this.updateSelectedCount();
    this.calculateTotal();
  },

  // Increase quantity
  increaseQty(e) {
    const id = e.currentTarget.dataset.id;
    const cartItems = this.data.cartItems;
    const item = cartItems.find(item => item.id === id);
    if (item) {
      item.quantity += 1;
      app.updateCartQuantity(id, item.quantity);
    }
    this.setData({ cartItems: cartItems });
    this.calculateTotal();
  },

  // Decrease quantity
  decreaseQty(e) {
    const id = e.currentTarget.dataset.id;
    const cartItems = this.data.cartItems;
    const item = cartItems.find(item => item.id === id);
    if (item && item.quantity > 1) {
      item.quantity -= 1;
      app.updateCartQuantity(id, item.quantity);
      this.setData({ cartItems: cartItems });
      this.calculateTotal();
    } else if (item && item.quantity === 1) {
      this.removeItem(id);
    }
  },

  // Remove item
  removeItem(id) {
    wx.showModal({
      title: '提示',
      content: '确定要删除该商品吗？',
      success: (res) => {
        if (res.confirm) {
          app.removeFromCart(id);
          this.loadCart();
        }
      }
    });
  },

  // Batch delete selected items
  batchDelete() {
    const selectedItems = this.data.cartItems.filter(item => item.checked);
    if (selectedItems.length === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '提示',
      content: '确定要删除选中的' + selectedItems.length + '件商品吗？',
      success: (res) => {
        if (res.confirm) {
          const selectedIds = selectedItems.map(item => item.id);
          selectedIds.forEach(id => app.removeFromCart(id));
          this.setData({ isManageMode: false });
          this.loadCart();
        }
      }
    });
  },

  // Swipe delete
  onDeleteItem(e) {
    const id = e.currentTarget.dataset.id;
    this.removeItem(id);
  },

  // Calculate total
  calculateTotal() {
    const cartItems = this.data.cartItems;
    let totalCount = 0;
    let totalPrice = 0;
    cartItems.forEach(item => {
      if (item.checked) {
        totalCount += item.quantity;
        totalPrice += item.price * item.quantity;
      }
    });
    this.setData({
      totalCount: totalCount,
      totalPrice: totalPrice.toFixed(2)
    });
  },

  // Checkout
  checkout() {
    if (this.data.totalCount === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/order-confirm/order-confirm'
    });
  },

  // Go to shopping
  goShopping() {
    wx.switchTab({
      url: '/pages/category/category'
    });
  },

  // Navigate to product detail
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: '/pages/product-detail/product-detail?id=' + id
      });
    }
  }
});
