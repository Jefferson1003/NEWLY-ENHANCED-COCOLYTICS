import { Router } from 'express';
import {
  addItemToCart,
  addProduct,
  cancelMyOrder,
  deleteProduct,
  getPublicMarketplaceTraderDetail,
  getTraderProfile,
  listCart,
  listMarketplace,
  listMyPaperUploads,
  listPublicMarketplaceTraders,
  listOrders,
  listSalesOrders,
  markMyOrderReceived,
  updateSalesOrderStatus,
  listMyProducts,
  placeOrder,
  removeCartItem,
  updateProduct,
  updateCartItemQuantity,
  updateTraderProfile,
  updateTraderProfileImage,
  uploadPaperFile,
  uploadProfileImage,
  uploadProductImage,
  uploadTraderPaper,
} from '../controllers/traderController.js';
import { traderChatHandlers, uploadMessageImage } from '../controllers/chatController.js';
import { authRequired, requireRole } from '../middlewares/authMiddleware.js';

const traderRouter = Router();

traderRouter.get('/public/marketplace/traders', listPublicMarketplaceTraders);
traderRouter.get('/public/marketplace/traders/:id', getPublicMarketplaceTraderDetail);

traderRouter.use(authRequired, requireRole(['trader']));
traderRouter.get('/profile', getTraderProfile);
traderRouter.patch('/profile', updateTraderProfile);
traderRouter.post('/profile/image', (req, res, next) => {
  uploadProfileImage(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Invalid upload.' });
    }

    return next();
  });
}, updateTraderProfileImage);
traderRouter.get('/products', listMyProducts);
traderRouter.get('/marketplace/traders', listMarketplace);
traderRouter.get('/messages/contacts', traderChatHandlers.listMessageContacts);
traderRouter.get('/messages/stream', traderChatHandlers.streamMessageEvents);
traderRouter.post('/messages/presence/heartbeat', traderChatHandlers.heartbeatMessagePresence);
traderRouter.get('/messages/:partnerId', traderChatHandlers.listMessagesWithPartner);
traderRouter.post('/messages/:partnerId', (req, res, next) => {
  uploadMessageImage(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Invalid upload.' });
    }

    return next();
  });
}, traderChatHandlers.sendMessageToPartner);
traderRouter.post('/messages/:partnerId/call-signal', traderChatHandlers.sendCallSignalToPartner);
traderRouter.get('/cart', listCart);
traderRouter.post('/cart', addItemToCart);
traderRouter.delete('/cart/:id', removeCartItem);
traderRouter.patch('/cart/:id/quantity', updateCartItemQuantity);
traderRouter.post('/orders/place', placeOrder);
traderRouter.get('/orders', listOrders);
traderRouter.patch('/orders/:orderId/cancel', cancelMyOrder);
traderRouter.patch('/orders/:orderId/received', markMyOrderReceived);
traderRouter.get('/orders/sales', listSalesOrders);
traderRouter.patch('/orders/sales/:orderId/status', updateSalesOrderStatus);
traderRouter.get('/paper-uploads', listMyPaperUploads);
traderRouter.post('/paper-uploads', (req, res, next) => {
  uploadPaperFile(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Invalid upload.' });
    }

    return next();
  });
}, uploadTraderPaper);
traderRouter.post('/products', (req, res, next) => {
  uploadProductImage(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Invalid upload.' });
    }

    return next();
  });
}, addProduct);
traderRouter.patch('/products/:id', (req, res, next) => {
  uploadProductImage(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Invalid upload.' });
    }

    return next();
  });
}, updateProduct);
traderRouter.delete('/products/:id', deleteProduct);

export default traderRouter;
