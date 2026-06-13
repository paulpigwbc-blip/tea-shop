// utils/cloud.js - 云开发实例获取工具
// 获取资源方（tea-shop）的云开发实例

/**
 * 获取共享的云开发实例
 * @returns {Object} wx.cloud.Cloud 实例
 */
function getCloud() {
  const app = getApp();
  return app.globalData.resourceCloud;
}

/**
 * 获取云数据库实例
 * @returns {Object} 数据库实例
 */
function getDB() {
  const cloud = getCloud();
  return cloud ? cloud.database() : null;
}

/**
 * 调用云函数
 * @param {string} name 云函数名称
 * @param {object} data 传递的数据
 * @returns {Promise} 云函数调用结果
 */
function callFunction(name, data = {}) {
  const cloud = getCloud();
  if (!cloud) {
    return Promise.reject(new Error('Cloud instance not available'));
  }
  return new Promise((resolve, reject) => {
    cloud.callFunction({
      name,
      data,
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 获取云存储临时文件 URL
 * @param {string|Array} fileList 文件 ID 或文件 ID 数组
 * @returns {Promise} 临时文件 URL 结果
 */
function getTempFileURL(fileList) {
  const cloud = getCloud();
  if (!cloud) {
    return Promise.reject(new Error('Cloud instance not available'));
  }
  return new Promise((resolve, reject) => {
    cloud.getTempFileURL({
      fileList: Array.isArray(fileList) ? fileList : [fileList],
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 上传文件到云存储
 * @param {object} options 上传选项
 * @returns {Promise} 上传结果
 */
function uploadFile(options) {
  const cloud = getCloud();
  if (!cloud) {
    return Promise.reject(new Error('Cloud instance not available'));
  }
  return new Promise((resolve, reject) => {
    cloud.uploadFile({
      ...options,
      success: resolve,
      fail: reject
    });
  });
}

module.exports = {
  getCloud,
  getDB,
  callFunction,
  getTempFileURL,
  uploadFile
};