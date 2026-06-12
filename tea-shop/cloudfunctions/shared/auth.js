// cloudfunctions/shared/auth.js - Identity verification for cloud functions
const cloud = require('wx-server-sdk');

/**
 * Get and validate OPENID from cloud context
 * MUST be called at the start of every cloud function
 */
function getOpenId() {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    throw new Error('Unable to get user identity');
  }
  return openid;
}

/**
 * Verify the requester is the buyer of an order
 * @param {string} orderId - Order ID
 * @param {string} openid - Current user's OPENID
 * @param {object} db - Cloud database instance
 * @returns {object} order data if verified
 */
async function verifyBuyer(orderId, openid, db) {
  const orderDoc = await db.collection('orders').doc(orderId).get();
  const order = orderDoc.data;

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.buyerId !== openid) {
    throw new Error('Permission denied: not the order buyer');
  }

  return order;
}

/**
 * Verify the requester is the seller (shop owner)
 * For single-shop scenario, check against a whitelist of seller OPENIDs
 * @param {string} openid - Current user's OPENID
 * @param {object} db - Cloud database instance
 * @returns {boolean} true if verified seller
 */
async function verifySeller(openid, db) {
  // Check against seller whitelist in shop-settings collection
  const settingsDoc = await db.collection('shop-settings').doc('shop').get();
  const settings = settingsDoc.data;

  if (!settings || !settings.sellerOpenIds) {
    throw new Error('Shop settings not configured');
  }

  if (!settings.sellerOpenIds.includes(openid)) {
    throw new Error('Permission denied: not authorized seller');
  }

  return true;
}

/**
 * Generic identity check - verify the requester owns the resource
 * @param {string} collection - Database collection name
 * @param {string} docId - Document ID
 * @param {string} openid - Current user's OPENID
 * @param {string} ownerField - Field name that stores the owner ID (e.g., 'buyerId')
 * @param {object} db - Cloud database instance
 * @returns {object} document data if verified
 */
async function verifyOwner(collection, docId, openid, ownerField, db) {
  const doc = await db.collection(collection).doc(docId).get();
  const data = doc.data;

  if (!data) {
    throw new Error('Document not found');
  }

  if (data[ownerField] !== openid) {
    throw new Error('Permission denied: not the resource owner');
  }

  return data;
}

module.exports = {
  getOpenId,
  verifyBuyer,
  verifySeller,
  verifyOwner
};
