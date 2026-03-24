import { Router } from 'express';
import {
  addItemToCart,
  addProduct,
  getPublicMarketplaceTraderDetail,
  getTraderProfile,
  listCart,
  listMarketplace,
  listPublicMarketplaceTraders,
  listOrders,
  listMyProducts,
  placeOrder,
  removeCartItem,
  updateCartItemQuantity,
  updateTraderProfile,
  updateTraderProfileImage,
  uploadProfileImage,
  uploadProductImage,
} from '../controllers/traderController.js';
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
traderRouter.get('/cart', listCart);
traderRouter.post('/cart', addItemToCart);
traderRouter.delete('/cart/:id', removeCartItem);
traderRouter.patch('/cart/:id/quantity', updateCartItemQuantity);
traderRouter.post('/orders/place', placeOrder);
traderRouter.get('/orders', listOrders);
traderRouter.post('/products', (req, res, next) => {
  uploadProductImage(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Invalid upload.' });
    }

    return next();
  });
}, addProduct);

export default traderRouter;
