// utils/util.js - Common utility functions

/**
 * Format date to readable string
 */
function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second);
}

/**
 * Generate order number
 * Format: T + YYYYMMDD + 3-digit sequence
 */
function generateOrderNo() {
  const now = new Date();
  const dateStr = String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return 'T' + dateStr + random;
}

/**
 * Format price to 2 decimal places
 */
function formatPrice(price) {
  return Number(price).toFixed(2);
}

/**
 * Get order status text
 */
const ORDER_STATUS = {
  pending: '待付款',
  paid: '待发货',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消'
};

function getStatusText(status) {
  return ORDER_STATUS[status] || '未知状态';
}

/**
 * Get order status color
 */
const ORDER_STATUS_COLOR = {
  pending: '#E54D42',
  paid: '#FF9800',
  shipped: '#5B7744',
  completed: '#999999',
  cancelled: '#CCCCCC'
};

function getStatusColor(status) {
  return ORDER_STATUS_COLOR[status] || '#999999';
}

/**
 * Validate phone number (China)
 */
function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * Debounce function
 */
function debounce(fn, delay = 300) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Show toast message
 */
function showToast(title, icon = 'none', duration = 1500) {
  wx.showToast({ title, icon, duration });
}

/**
 * Show loading
 */
function showLoading(title = '加载中...') {
  wx.showLoading({ title, mask: true });
}

function hideLoading() {
  wx.hideLoading();
}

/**
 * Show modal confirm
 */
function showConfirm(content, title = '提示') {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => resolve(res.confirm),
      fail: () => resolve(false)
    });
  });
}

module.exports = {
  formatDate,
  generateOrderNo,
  formatPrice,
  getStatusText,
  getStatusColor,
  ORDER_STATUS,
  ORDER_STATUS_COLOR,
  isValidPhone,
  debounce,
  showToast,
  showLoading,
  hideLoading,
  showConfirm
};
