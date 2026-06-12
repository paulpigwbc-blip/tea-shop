// utils/db.js - Cloud Database Helper
// Initialize cloud database reference

let db = null;
let _ = null;

function initDB() {
  if (!db) {
    db = wx.cloud.database();
    _ = db.command;
  }
  return { db, _ };
}

function getDB() {
  if (!db) {
    initDB();
  }
  return db;
}

function getCommand() {
  if (!_) {
    initDB();
  }
  return _;
}

// Generic CRUD operations
const dbHelper = {
  // Query documents
  query(collection, where = {}, options = {}) {
    const db = getDB();
    let query = db.collection(collection).where(where);
    if (options.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.order || 'desc');
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.skip) {
      query = query.skip(options.skip);
    }
    return query.get();
  },

  // Get single document by ID
  getById(collection, id) {
    const db = getDB();
    return db.collection(collection).doc(id).get();
  },

  // Add document
  add(collection, data) {
    const db = getDB();
    return db.collection(collection).add({ data });
  },

  // Update document
  update(collection, id, data) {
    const db = getDB();
    return db.collection(collection).doc(id).update({ data });
  },

  // Delete document
  remove(collection, id) {
    const db = getDB();
    return db.collection(collection).doc(id).remove();
  },

  // Count documents
  count(collection, where = {}) {
    const db = getDB();
    return db.collection(collection).where(where).count();
  },

  // Watch for real-time updates
  watch(collection, where = {}, onChange, onError) {
    const db = getDB();
    return db.collection(collection).where(where).watch({
      onChange: onChange,
      onError: onError || function(err) { console.error('Watch error:', err); }
    });
  }
};

module.exports = {
  initDB,
  getDB,
  getCommand,
  dbHelper
};
