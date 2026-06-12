// pages/address-edit/address-edit.js
const app = getApp()

Page({
  data: {
    editId: null,         // null = new address, string = editing existing
    name: '',
    phone: '',
    region: [],           // [province, city, district]
    regionText: '',
    detail: '',
    isDefault: false
  },

  onLoad(options) {
    if (options.id) {
      // Edit mode — load existing address
      const addresses = wx.getStorageSync('addresses') || [];
      const addr = addresses.find(a => a.id === options.id);
      if (addr) {
        this.setData({
          editId: options.id,
          name: addr.name || '',
          phone: addr.phone || '',
          region: [addr.province || '', addr.city || '', addr.district || ''],
          regionText: (addr.province || '') + (addr.city || '') + (addr.district || ''),
          detail: addr.detail || '',
          isDefault: addr.isDefault || false
        });
        wx.setNavigationBarTitle({ title: '编辑收货地址' });
      }
    } else {
      // Add mode
      wx.setNavigationBarTitle({ title: '新增收货地址' });
    }
  },

  // Handle text input
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  // Handle region picker change
  onRegionChange(e) {
    const region = e.detail.value; // [province, city, district]
    this.setData({
      region: region,
      regionText: region[0] + region[1] + region[2]
    });
  },

  // Toggle default
  toggleDefault() {
    this.setData({ isDefault: !this.data.isDefault });
  },

  // Save address
  saveAddress() {
    const { name, phone, region, detail, isDefault, editId } = this.data;

    // Validation
    if (!name.trim()) {
      wx.showToast({ title: '请输入收货人姓名', icon: 'none' });
      return;
    }
    if (!phone.trim() || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号码', icon: 'none' });
      return;
    }
    if (!region || region.length < 3 || !region[0]) {
      wx.showToast({ title: '请选择所在地区', icon: 'none' });
      return;
    }
    if (!detail.trim()) {
      wx.showToast({ title: '请输入详细地址', icon: 'none' });
      return;
    }

    const addresses = wx.getStorageSync('addresses') || [];

    // If set as default, clear other defaults
    if (isDefault) {
      addresses.forEach(a => { a.isDefault = false; });
    }

    const addressData = {
      name: name.trim(),
      phone: phone.trim(),
      province: region[0],
      city: region[1],
      district: region[2],
      detail: detail.trim(),
      isDefault: isDefault
    };

    if (editId) {
      // Update existing
      const index = addresses.findIndex(a => a.id === editId);
      if (index >= 0) {
        addresses[index] = { ...addresses[index], ...addressData };
      }
    } else {
      // Create new
      addressData.id = 'addr_' + Date.now();
      // First address is default automatically
      if (addresses.length === 0) {
        addressData.isDefault = true;
      }
      addresses.push(addressData);
    }

    wx.setStorageSync('addresses', addresses);
    wx.showToast({ title: '保存成功', icon: 'success' });

    setTimeout(() => {
      wx.navigateBack();
    }, 1000);
  }
});
