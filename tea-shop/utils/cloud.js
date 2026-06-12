// utils/cloud.js - Cloud Function Helpers

/**
 * Call a cloud function
 */
function callFunction(name, data = {}) {
  return wx.cloud.callFunction({
    name,
    data
  }).then(res => {
    if (res.result && res.result.code === 0) {
      return res.result.data;
    }
    return Promise.reject(res.result || { code: -1, message: 'Unknown error' });
  });
}

/**
 * Upload file to cloud storage
 */
function uploadFile(cloudPath, filePath) {
  return wx.cloud.uploadFile({
    cloudPath,
    filePath
  });
}

/**
 * Delete file from cloud storage
 */
function deleteFile(fileIDs) {
  return wx.cloud.deleteFile({
    fileList: fileIDs
  });
}

/**
 * Get temp file URL
 */
function getTempFileURL(fileIDs) {
  return wx.cloud.getTempFileURL({
    fileList: fileIDs
  });
}

module.exports = {
  callFunction,
  uploadFile,
  deleteFile,
  getTempFileURL
};
