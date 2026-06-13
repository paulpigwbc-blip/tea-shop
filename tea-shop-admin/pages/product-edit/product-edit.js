// pages/product-edit/product-edit.js
const app = getApp()

Page({
  data: {
    isEdit: false,
    product: {
      name: '',
      category: '',
      price: '',
      stock: '',
      description: '',
      status: 'active'
    },
    categories: [],
    imageList: [],  // [{url, isCover, cloudPath}]
    uploading: false
  },

  onLoad(options) {
    // Permission guard for non-tab pages
    if (!app.globalData.isSeller) {
      wx.showModal({
        title: '无权限',
        content: '您不是本店管理员',
        showCancel: false,
        success: () => wx.navigateBack()
      });
      return;
    }

    // Load categories from cloud DB
    const resourceCloud = app.globalData.resourceCloud;
    if (resourceCloud) {
      const db = resourceCloud.database();
      db.collection('categories').orderBy('sort', 'asc').get().then(res => {
        const cats = (res.data || []).map(c => c.name);
        if (cats.length > 0) {
          app.globalData.categories = cats;
        }
        this.setData({ categories: app.globalData.categories });
      }).catch(() => {
        this.setData({ categories: app.globalData.categories });
      });
    } else {
      this.setData({ categories: app.globalData.categories });
    }

    if (options.id) {
      // Load product from cloud DB
      if (wx.cloud) {
        const db = wx.cloud.database();
        db.collection('products').doc(options.id).get().then(res => {
          if (res.data) {
            const p = res.data;
            this.setData({
              isEdit: true,
              product: { ...p, price: String(p.price), stock: String(p.stock) }
            });
            // Load existing images
            if (p.images && p.images.length > 0) {
              this._loadExistingImages(p.images, p.coverIndex || 0);
            }
            wx.setNavigationBarTitle({ title: '编辑商品' });
          }
        }).catch(err => {
          console.error('Load product error:', err);
          this._loadProductFallback(options.id);
        });
      } else {
        this._loadProductFallback(options.id);
      }
    } else {
      wx.setNavigationBarTitle({ title: '添加商品' });
    }
  },

  _loadProductFallback(id) {
    const product = app.globalData.products.find(p => p._id === id);
    if (product) {
      this.setData({
        isEdit: true,
        product: { ...product, price: String(product.price), stock: String(product.stock) }
      });
      // Load images from cached product data
      if (product.images && product.images.length > 0) {
        this._loadExistingImages(product.images, product.coverIndex || 0);
      }
      wx.setNavigationBarTitle({ title: '编辑商品' });
    }
  },

  // Load existing images: convert cloud fileIDs to temp URLs for display
  _loadExistingImages(images, coverIndex) {
    const imageList = images.map((url, i) => ({
      url,
      isCover: i === coverIndex,
      cloudPath: url
    }));
    this.setData({ imageList });

    // Convert cloud:// fileIDs to temporary HTTP URLs for reliable display
    const cloudFileIDs = images.filter(url => typeof url === 'string' && url.startsWith('cloud://'));
    if (cloudFileIDs.length > 0 && wx.cloud) {
      wx.cloud.getTempFileURL({
        fileList: cloudFileIDs,
        success: (res) => {
          const fileMap = {};
          (res.fileList || []).forEach(item => {
            if (item.tempFileURL) {
              fileMap[item.fileID] = item.tempFileURL;
            }
          });
          const updatedList = this.data.imageList.map(img => {
            if (fileMap[img.cloudPath]) {
              return { ...img, url: fileMap[img.cloudPath] };
            }
            return img;
          });
          this.setData({ imageList: updatedList });
        },
        fail: (err) => {
          console.warn('Failed to get temp file URLs:', err);
          // Keep cloud:// URLs as-is, they may still work
        }
      });
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`product.${field}`]: e.detail.value });
  },

  onCategoryChange(e) {
    const index = e.detail.value;
    this.setData({ 'product.category': this.data.categories[index] });
  },

  // Choose images from album/camera
  chooseImage() {
    if (this.data.uploading) return;
    const remaining = 9 - this.data.imageList.length;
    if (remaining <= 0) return;

    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const newImages = res.tempFiles.map(f => ({
          url: f.tempFilePath,
          isCover: false,
          cloudPath: ''
        }));
        // Auto-set first image as cover if no cover exists
        if (this.data.imageList.length === 0 && newImages.length > 0) {
          newImages[0].isCover = true;
        }
        this.setData({ imageList: [...this.data.imageList, ...newImages] });
      }
    });
  },

  // Set an image as cover
  setCoverImage(e) {
    const index = e.currentTarget.dataset.index;
    const imageList = this.data.imageList.map((img, i) => ({
      ...img,
      isCover: i === index
    }));
    this.setData({ imageList });
  },

  // Delete an image
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    let imageList = [...this.data.imageList];
    const wasCover = imageList[index].isCover;
    imageList.splice(index, 1);
    // If deleted cover, set first remaining as cover
    if (wasCover && imageList.length > 0) {
      imageList[0].isCover = true;
    }
    this.setData({ imageList });
  },

  // Upload images to cloud storage
  // Returns: { success: true, cloudPaths: ['cloud://...', ...] } or { success: false, error: '...' }
  _uploadNewImages() {
    const imageList = this.data.imageList;
    const toUpload = imageList.filter(img => !img.cloudPath);

    console.log('[DIAG] imageList length:', imageList.length);
    console.log('[DIAG] toUpload length:', toUpload.length);
    console.log('[DIAG] wx.cloud exists:', !!wx.cloud);

    if (toUpload.length === 0) {
      const existingPaths = imageList.map(img => img.cloudPath);
      console.log('[DIAG] No new uploads needed, existing paths:', existingPaths);
      return Promise.resolve({ success: true, cloudPaths: existingPaths });
    }

    this.setData({ uploading: true });

    const uploadPromises = toUpload.map((img, idx) => {
      return new Promise((resolve) => {
        const ext = (img.url.split('.').pop() || 'jpg').substring(0, 5);
        const cloudPath = 'products/' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 8) + '.' + ext;

        console.log('[DIAG] Uploading image', idx, '| url:', img.url, '| cloudPath:', cloudPath);

        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: img.url,
          success: (res) => {
            console.log('[DIAG] Upload SUCCESS', idx, '| fileID:', res.fileID);
            resolve({ success: true, fileID: res.fileID });
          },
          fail: (err) => {
            console.error('[DIAG] Upload FAILED', idx, '| error:', JSON.stringify(err));
            resolve({ success: false, error: err.errMsg || JSON.stringify(err) });
          }
        });
      });
    });

    return Promise.all(uploadPromises).then(results => {
      this.setData({ uploading: false });

      console.log('[DIAG] All uploads done, results:', JSON.stringify(results));

      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        const errorMsg = failed.length + '/' + results.length + '张图片上传失败: ' + failed[0].error;
        console.error('[DIAG] Some uploads failed:', errorMsg);
        return { success: false, error: errorMsg };
      }

      // All succeeded
      const newPaths = results.map(r => r.fileID);
      const existingPaths = imageList.filter(img => img.cloudPath).map(img => img.cloudPath);
      const allPaths = [...existingPaths, ...newPaths];

      console.log('[DIAG] SUCCESS - all paths:', JSON.stringify(allPaths));
      return { success: true, cloudPaths: allPaths };
    });
  },

  saveProduct() {
    const product = this.data.product;
    if (!product.name || !product.category || !product.price) {
      wx.showToast({ title: '请填写必要信息', icon: 'none' });
      return;
    }

    if (this.data.imageList.length === 0) {
      wx.showToast({ title: '请至少上传一张图片', icon: 'none' });
      return;
    }

    const price = Number(product.price);
    const stock = Number(product.stock) || 0;

    if (wx.cloud) {
      wx.showLoading({ title: '上传并保存中...' });

      // Quick cloud connectivity test
      const db = wx.cloud.database();
      db.serverDate();  // If cloud is broken, this would throw
      console.log('[DIAG] Cloud initialized, env:', wx.cloud.init ? 'init called' : 'no init');

      this._uploadNewImages().then(result => {
        console.log('[DIAG] upload result:', JSON.stringify(result));

        if (!result.success) {
          wx.hideLoading();
          console.error('[DIAG] Upload failed:', result.error);
          wx.showModal({
            title: '上传失败',
            content: result.error + '\n\n请检查：1)云开发控制台是否已激活 2)云存储是否可用 3)网络是否正常',
            showCancel: false
          });
          return;
        }

        const images = result.cloudPaths;
        console.log('[DIAG] Images to save:', JSON.stringify(images));

        if (!images || images.length === 0) {
          wx.hideLoading();
          wx.showModal({ title: '保存失败', content: '上传完成但没有获得图片路径，请查看控制台日志', showCancel: false });
          return;
        }

        const coverIndex = this.data.imageList.findIndex(img => img.isCover);
        const productData = {
          name: product.name,
          category: product.category,
          price,
          stock,
          description: product.description || '',
          status: product.status || 'active',
          images: images,
          coverIndex: coverIndex >= 0 ? coverIndex : 0
        };

        console.log('[DIAG] Calling cloud function updateProduct');
        console.log('[DIAG] productData:', JSON.stringify(productData));
        console.log('[DIAG] isEdit:', this.data.isEdit, '| productId:', product._id);

        // Use cloud function for DB write (bypasses security rules)
        wx.cloud.callFunction({
          name: 'updateProduct',
          data: {
            productId: this.data.isEdit ? product._id : null,
            productData: productData,
            isNew: !this.data.isEdit
          },
          success: (res) => {
            wx.hideLoading();
            console.log('[DIAG] Cloud function result:', JSON.stringify(res.result));

            if (res.result && res.result.code === 0) {
              // Verify: re-read the document
              const savedId = (res.result.data && res.result.data._id) || product._id;
              if (savedId) {
                const db = wx.cloud.database();
                db.collection('products').doc(savedId).field({ updatedAt: true, images: true, name: true }).get().then(verifyRes => {
                  console.log('[DIAG] Verify after save:', JSON.stringify(verifyRes.data));
                }).catch(() => {});
              }

              wx.showToast({ title: '保存成功', icon: 'success' });
              setTimeout(() => wx.navigateBack(), 1000);
            } else {
              const msg = (res.result && res.result.message) || '未知错误';
              console.error('[DIAG] Cloud function failed:', msg);
              wx.showModal({
                title: '保存失败',
                content: msg,
                showCancel: false
              });
            }
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('[DIAG] Cloud function call failed:', JSON.stringify(err));
            wx.showModal({
              title: '保存失败',
              content: '云函数调用失败，请确认 updateProduct 云函数已上传部署',
              showCancel: false
            });
          }
        });
      }).catch(err => {
        wx.hideLoading();
        console.error('[Upload exception]', JSON.stringify(err));
        wx.showToast({ title: '上传过程出错', icon: 'none' });
      });
    } else {
      // Local fallback
      const images = this.data.imageList.map(img => img.url);
      const coverIndex = this.data.imageList.findIndex(img => img.isCover);
      product.price = price;
      product.stock = stock;
      product.images = images;
      product.coverIndex = coverIndex >= 0 ? coverIndex : 0;
      if (this.data.isEdit) {
        const products = app.globalData.products;
        const index = products.findIndex(p => p._id === product._id);
        if (index >= 0) products[index] = product;
      } else {
        product._id = 'p_' + Date.now();
        product.sales = 0;
        app.globalData.products.push(product);
      }
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    }
  }
});
