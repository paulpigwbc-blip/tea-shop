// components/cart-item/cart-item.js
Component({
  properties: {
    item: {
      type: Object,
      value: {}
    }
  },

  methods: {
    onToggleCheck() {
      this.triggerEvent('check', { id: this.properties.item.id });
    },

    onIncrease() {
      this.triggerEvent('increase', { id: this.properties.item.id });
    },

    onDecrease() {
      this.triggerEvent('decrease', { id: this.properties.item.id });
    },

    onDelete() {
      this.triggerEvent('delete', { id: this.properties.item.id });
    }
  }
});
