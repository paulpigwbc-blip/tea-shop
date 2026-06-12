// components/product-card/product-card.js
Component({
  properties: {
    product: {
      type: Object,
      value: {}
    },
    quantity: {
      type: Number,
      value: 0
    }
  },

  observers: {
    'product'(p) {
      if (!p) return;
      let coverImage = '';
      if (p.images && p.images.length > 0) {
        const idx = p.coverIndex || 0;
        coverImage = p.images[idx] || p.images[0];
      }
      this.setData({ coverImage });
    }
  },

  methods: {
    onAddTap() {
      this.triggerEvent('add', { id: this.properties.product.id });
    },

    onMinusTap() {
      if (this.properties.quantity > 0) {
        this.triggerEvent('minus', { id: this.properties.product.id });
      }
    },

    onCardTap() {
      this.triggerEvent('tap', { id: this.properties.product.id });
    }
  }
});
