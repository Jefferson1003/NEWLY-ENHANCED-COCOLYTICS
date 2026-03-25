import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import {
  createMessageBetweenTraders,
  listConversationPartnerIds,
  listMessagesBetweenTraders,
  listTraderMessageContacts,
} from '../models/chatModel.js';
import {
  createOutgoingCallLog,
  listCallLogsBetweenTraders,
  markCallAccepted,
  markCallDeclined,
  markCallEnded,
} from '../models/callModel.js';
import {
  createPaperUpload,
  findPaperUploadsByTraderId,
  sanitizePaperUpload,
} from '../models/paperUploadModel.js';
import {
  addTraderStreamClient,
  isTraderOnline,
  pushTraderEvent,
  removeTraderStreamClient,
} from '../realtime/messageStream.js';
import {
  addToCart,
  findMarketplaceRows,
  findMarketplaceRowsByTraderId,
  findCartItemById,
  findOrderByBuyerId,
  findProductById,
  findSalesOrderStatusByTraderId,
  listCartByBuyerId,
  listOrdersByBuyerId,
  listSalesOrderItemsByTraderId,
  placeOrderFromCart,
  removeCartItemById,
  updateOrderStatusByBuyerId,
  updateSalesOrderStatusByTraderId,
  updateCartItemQuantityById,
} from '../models/marketplaceModel.js';
import {
  createProduct,
  findProductByIdAndTraderId,
  findProductsByTraderId,
  sanitizeProduct,
  updateProductByIdAndTraderId,
} from '../models/productModel.js';
import {
  findUserById,
  sanitizeUser,
  updateUserLastSeenById,
  updateTraderProfileById,
  updateTraderProfileImageById,
} from '../models/userModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../../frontend/public/uploads/products_img');
const profileUploadsDir = path.resolve(__dirname, '../../../frontend/public/uploads/profile_img');
const paperUploadsDir = path.resolve(__dirname, '../../../frontend/public/uploads/paper_docs');
const messengerUploadsDir = path.resolve(__dirname, '../../../frontend/public/uploads/messenger');
const PRESENCE_RECENT_WINDOW_MS = 90 * 1000;

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await mkdir(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const safeExt = extension || '.jpg';
    const uniqueName = `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, uniqueName);
  },
});

function fileFilter(_req, file, cb) {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error('Only JPG, PNG, WEBP, or GIF images are allowed.'));
    return;
  }

  cb(null, true);
}

export const uploadProductImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('productImage');

const profileImageStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await mkdir(profileUploadsDir, { recursive: true });
      cb(null, profileUploadsDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const safeExt = extension || '.jpg';
    const uniqueName = `profile-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, uniqueName);
  },
});

const paperFileStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await mkdir(paperUploadsDir, { recursive: true });
      cb(null, paperUploadsDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const safeExt = extension || '.bin';
    const uniqueName = `paper-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, uniqueName);
  },
});

export const uploadPaperFile = multer({
  storage: paperFileStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
}).single('paperFile');

export const uploadProfileImage = multer({
  storage: profileImageStorage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
}).single('profileImage');

const messageImageStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await mkdir(messengerUploadsDir, { recursive: true });
      cb(null, messengerUploadsDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const safeExt = extension || '.jpg';
    const uniqueName = `msg-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, uniqueName);
  },
});

export const uploadMessageImage = multer({
  storage: messageImageStorage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
}).single('messageImage');

function mapMarketplaceRowsToTraders(rows) {
  const tradersMap = new Map();

  for (const row of rows) {
    if (!tradersMap.has(row.trader_id)) {
      tradersMap.set(row.trader_id, {
        traderId: row.trader_id,
        traderNumber: row.trader_id,
        name: row.profile_name || row.full_name,
        description: row.profile_description || '',
        profileImagePath: row.profile_image_path || '',
        contactNumber: row.contact_number || '',
        businessAddress: row.business_address || '',
        totalProducts: 0,
        totalStocks: 0,
        products: [],
      });
    }

    if (row.product_id) {
      const trader = tradersMap.get(row.trader_id);
      trader.totalProducts += 1;
      trader.totalStocks += Number(row.stock_quantity || 0);
      trader.products.push({
        id: row.product_id,
        productName: row.product_name,
        size: row.size,
        lengthCm: row.length_cm,
        stockQuantity: row.stock_quantity,
        productImagePath: row.product_image_path,
        createdAt: row.product_created_at,
      });
    }
  }

  return Array.from(tradersMap.values());
}

export async function listPublicMarketplaceTraders(_req, res) {
  try {
    const rows = await findMarketplaceRows();
    const traders = mapMarketplaceRowsToTraders(rows);
    return res.status(200).json({ traders });
  } catch {
    return res.status(500).json({ error: 'Could not load traders.' });
  }
}

export async function getPublicMarketplaceTraderDetail(req, res) {
  const traderId = Number(req.params.id);
  if (!Number.isInteger(traderId) || traderId <= 0) {
    return res.status(400).json({ error: 'Invalid trader ID.' });
  }

  try {
    const rows = await findMarketplaceRowsByTraderId(traderId);
    const traders = mapMarketplaceRowsToTraders(rows);
    const trader = traders[0] || null;

    if (!trader) {
      return res.status(404).json({ error: 'Trader not found.' });
    }

    return res.status(200).json({ trader });
  } catch {
    return res.status(500).json({ error: 'Could not load trader details.' });
  }
}

export async function getTraderProfile(req, res) {
  try {
    const user = await findUserById(req.auth.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch {
    return res.status(500).json({ error: 'Could not fetch trader profile.' });
  }
}

export async function updateTraderProfile(req, res) {
  const { name, description, contactNumber, businessAddress } = req.body;

  if (!name || !contactNumber || !businessAddress) {
    return res.status(400).json({
      error: 'name, contactNumber, and businessAddress are required.',
    });
  }

  try {
    const affectedRows = await updateTraderProfileById(req.auth.id, {
      name,
      description,
      contactNumber,
      businessAddress,
    });

    if (!affectedRows) {
      return res.status(404).json({ error: 'Trader profile not found.' });
    }

    const updatedUser = await findUserById(req.auth.id);
    return res.status(200).json({
      message: 'Trader profile updated successfully.',
      user: sanitizeUser(updatedUser),
    });
  } catch {
    return res.status(500).json({ error: 'Could not update trader profile.' });
  }
}

export async function updateTraderProfileImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'profileImage file is required.' });
  }

  const imagePath = `/uploads/profile_img/${req.file.filename}`;

  try {
    const affectedRows = await updateTraderProfileImageById(req.auth.id, imagePath);
    if (!affectedRows) {
      return res.status(404).json({ error: 'Trader profile not found.' });
    }

    const updatedUser = await findUserById(req.auth.id);
    return res.status(200).json({
      message: 'Profile image updated successfully.',
      user: sanitizeUser(updatedUser),
    });
  } catch {
    return res.status(500).json({ error: 'Could not update profile image.' });
  }
}

export async function listMyProducts(req, res) {
  try {
    const products = await findProductsByTraderId(req.auth.id);
    return res.status(200).json({ products: products.map(sanitizeProduct) });
  } catch {
    return res.status(500).json({ error: 'Could not fetch products.' });
  }
}

export async function addProduct(req, res) {
  const { productName, size, lengthCm, stockQuantity } = req.body;
  const normalizedSize = String(size || '').trim().toLowerCase();
  const fixedSize = normalizedSize === 'meduim' ? 'medium' : normalizedSize;

  if (!productName) {
    return res.status(400).json({ error: 'productName is required.' });
  }

  if (!['small', 'medium', 'large'].includes(fixedSize)) {
    return res.status(400).json({ error: 'size must be small, medium, or large.' });
  }

  const parsedLength = lengthCm === '' || lengthCm === undefined ? null : Number(lengthCm);
  const parsedStock = Number(stockQuantity);

  if (parsedLength !== null && (!Number.isFinite(parsedLength) || parsedLength < 0)) {
    return res.status(400).json({ error: 'lengthCm must be 0 or higher.' });
  }

  if (!Number.isInteger(parsedStock) || parsedStock < 0) {
    return res.status(400).json({ error: 'stockQuantity must be a non-negative whole number.' });
  }

  try {
    const productImagePath = req.file ? `/uploads/products_img/${req.file.filename}` : null;

    const createdId = await createProduct({
      traderId: req.auth.id,
      productName,
      size: fixedSize,
      lengthCm: parsedLength,
      stockQuantity: parsedStock,
      productImagePath,
    });

    return res.status(201).json({
      message: 'Product added successfully.',
      productId: createdId,
      productImagePath,
    });
  } catch {
    return res.status(500).json({ error: 'Could not add product.' });
  }
}

export async function updateProduct(req, res) {
  const productId = Number(req.params.id);
  const { productName, size, lengthCm, stockQuantity } = req.body;
  const normalizedSize = String(size || '').trim().toLowerCase();
  const fixedSize = normalizedSize === 'meduim' ? 'medium' : normalizedSize;

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: 'Invalid product ID.' });
  }

  if (!productName) {
    return res.status(400).json({ error: 'productName is required.' });
  }

  if (!['small', 'medium', 'large'].includes(fixedSize)) {
    return res.status(400).json({ error: 'size must be small, medium, or large.' });
  }

  const parsedLength = lengthCm === '' || lengthCm === undefined ? null : Number(lengthCm);
  const parsedStock = Number(stockQuantity);

  if (parsedLength !== null && (!Number.isFinite(parsedLength) || parsedLength < 0)) {
    return res.status(400).json({ error: 'lengthCm must be 0 or higher.' });
  }

  if (!Number.isInteger(parsedStock) || parsedStock < 0) {
    return res.status(400).json({ error: 'stockQuantity must be a non-negative whole number.' });
  }

  try {
    const existingProduct = await findProductByIdAndTraderId(productId, req.auth.id);
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const productImagePath = req.file ? `/uploads/products_img/${req.file.filename}` : null;

    const affectedRows = await updateProductByIdAndTraderId(productId, req.auth.id, {
      productName,
      size: fixedSize,
      lengthCm: parsedLength,
      stockQuantity: parsedStock,
      productImagePath,
    });

    if (!affectedRows) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const updatedProduct = await findProductByIdAndTraderId(productId, req.auth.id);
    return res.status(200).json({
      message: 'Product updated successfully.',
      product: sanitizeProduct(updatedProduct),
    });
  } catch {
    return res.status(500).json({ error: 'Could not update product.' });
  }
}

export async function listMarketplace(req, res) {
  try {
    const rows = await findMarketplaceRows();
    const traders = mapMarketplaceRowsToTraders(rows);
    return res.status(200).json({ traders });
  } catch {
    return res.status(500).json({ error: 'Could not load marketplace.' });
  }
}

export async function addItemToCart(req, res) {
  const productId = Number(req.body.productId);
  const quantity = Number(req.body.quantity || 1);

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: 'Valid productId is required.' });
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive whole number.' });
  }

  try {
    const product = await findProductById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (product.trader_id === req.auth.id) {
      return res.status(400).json({ error: 'You cannot add your own product to cart.' });
    }

    if (product.stock_quantity < quantity) {
      return res.status(400).json({ error: 'Not enough stock for this product.' });
    }

    const result = await addToCart(req.auth.id, productId, quantity);
    return res.status(200).json({
      message: 'Product added to cart.',
      cartItemId: result.cartItemId,
    });
  } catch {
    return res.status(500).json({ error: 'Could not add to cart.' });
  }
}

export async function listCart(req, res) {
  try {
    const items = await listCartByBuyerId(req.auth.id);
    return res.status(200).json({
      items: items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        productId: item.product_id,
        productName: item.product_name,
        size: item.size,
        lengthCm: item.length_cm,
        stockQuantity: item.stock_quantity,
        productImagePath: item.product_image_path,
        traderId: item.trader_id,
        traderName: item.trader_name,
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Could not fetch cart.' });
  }
}

export async function removeCartItem(req, res) {
  const cartItemId = Number(req.params.id);
  if (!Number.isInteger(cartItemId) || cartItemId <= 0) {
    return res.status(400).json({ error: 'Invalid cart item ID.' });
  }

  try {
    const affectedRows = await removeCartItemById(req.auth.id, cartItemId);
    if (!affectedRows) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    return res.status(200).json({ message: 'Item removed from cart.' });
  } catch {
    return res.status(500).json({ error: 'Could not remove cart item.' });
  }
}

export async function updateCartItemQuantity(req, res) {
  const cartItemId = Number(req.params.id);
  const quantity = Number(req.body?.quantity);

  if (!Number.isInteger(cartItemId) || cartItemId <= 0) {
    return res.status(400).json({ error: 'Invalid cart item ID.' });
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive whole number.' });
  }

  try {
    const cartItem = await findCartItemById(req.auth.id, cartItemId);
    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    if (quantity > Number(cartItem.stock_quantity || 0)) {
      return res.status(400).json({
        error: `Only ${cartItem.stock_quantity} stock available for ${cartItem.product_name}.`,
      });
    }

    await updateCartItemQuantityById(req.auth.id, cartItemId, quantity);
    return res.status(200).json({ message: 'Cart quantity updated successfully.' });
  } catch {
    return res.status(500).json({ error: 'Could not update cart quantity.' });
  }
}

export async function placeOrder(req, res) {
  const fullName = String(req.body?.fullName || '').trim();
  const contactNumber = String(req.body?.contactNumber || '').trim();
  const streetAddress = String(req.body?.streetAddress || '').trim();
  const regionName = String(req.body?.regionName || '').trim();
  const provinceName = String(req.body?.provinceName || '').trim();
  const cityName = String(req.body?.cityName || '').trim();
  const barangayName = String(req.body?.barangayName || '').trim();
  const paymentMethod = String(req.body?.paymentMethod || '').trim().toLowerCase();
  const deliveryNotes = String(req.body?.deliveryNotes || '').trim();
  const selectedCartItemIds = Array.isArray(req.body?.selectedCartItemIds)
    ? req.body.selectedCartItemIds
    : [];

  if (
    !fullName ||
    !contactNumber ||
    !streetAddress ||
    !regionName ||
    !provinceName ||
    !cityName ||
    !barangayName
  ) {
    return res.status(400).json({
      error:
        'fullName, contactNumber, streetAddress, regionName, provinceName, cityName, and barangayName are required.',
    });
  }

  if (paymentMethod && paymentMethod !== 'cash_on_delivery') {
    return res.status(400).json({ error: 'Only cash_on_delivery payment method is supported.' });
  }

  const normalizedSelectedIds = [...new Set(
    selectedCartItemIds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
  )];

  if (!normalizedSelectedIds.length) {
    return res.status(400).json({ error: 'Please select at least one cart item to checkout.' });
  }

  const fullAddress = `${streetAddress}, ${barangayName}, ${cityName}, ${provinceName}, ${regionName}`;

  try {
    const orderId = await placeOrderFromCart(req.auth.id, {
      fullName,
      contactNumber,
      streetAddress,
      regionName,
      provinceName,
      cityName,
      barangayName,
      fullAddress,
      deliveryNotes,
    }, normalizedSelectedIds);
    return res.status(201).json({ message: 'Order placed successfully.', orderId });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Could not place order.' });
  }
}

export async function listOrders(req, res) {
  try {
    const rows = await listOrdersByBuyerId(req.auth.id);
    const ordersMap = new Map();

    for (const row of rows) {
      if (!ordersMap.has(row.order_id)) {
        ordersMap.set(row.order_id, {
          id: row.order_id,
          status: row.status,
          customerFullName: row.customer_full_name || '',
          customerContactNumber: row.customer_contact_number || '',
          deliveryRegion: row.delivery_region || '',
          deliveryProvince: row.delivery_province || '',
          deliveryCity: row.delivery_city || '',
          deliveryBarangay: row.delivery_barangay || '',
          deliveryStreetAddress: row.delivery_street_address || '',
          deliveryFullAddress: row.delivery_full_address || '',
          paymentMethod: row.payment_method || 'cash_on_delivery',
          deliveryNotes: row.delivery_notes || '',
          cancellationReason: row.cancellation_reason || '',
          createdAt: row.order_created_at,
          items: [],
        });
      }

      const order = ordersMap.get(row.order_id);
      order.items.push({
        id: row.order_item_id,
        productId: row.product_id,
        productName: row.product_name,
        size: row.size,
        lengthCm: row.length_cm,
        quantity: row.quantity,
        productImagePath: row.product_image_path,
        traderId: row.trader_id,
        traderName: row.trader_name,
      });
    }

    return res.status(200).json({ orders: Array.from(ordersMap.values()) });
  } catch {
    return res.status(500).json({ error: 'Could not fetch orders.' });
  }
}

export async function listSalesOrders(req, res) {
  try {
    const rows = await listSalesOrderItemsByTraderId(req.auth.id);
    const ordersMap = new Map();

    for (const row of rows) {
      if (!ordersMap.has(row.order_id)) {
        ordersMap.set(row.order_id, {
          id: row.order_id,
          status: row.status,
          buyerName: row.buyer_name || '',
          customerFullName: row.customer_full_name || '',
          customerContactNumber: row.customer_contact_number || '',
          deliveryRegion: row.delivery_region || '',
          deliveryProvince: row.delivery_province || '',
          deliveryCity: row.delivery_city || '',
          deliveryBarangay: row.delivery_barangay || '',
          deliveryStreetAddress: row.delivery_street_address || '',
          deliveryFullAddress: row.delivery_full_address || '',
          paymentMethod: row.payment_method || 'cash_on_delivery',
          deliveryNotes: row.delivery_notes || '',
          cancellationReason: row.cancellation_reason || '',
          createdAt: row.order_created_at,
          items: [],
        });
      }

      const order = ordersMap.get(row.order_id);
      order.items.push({
        id: row.order_item_id,
        productId: row.product_id,
        productName: row.product_name,
        size: row.size,
        lengthCm: row.length_cm,
        quantity: row.quantity,
        productImagePath: row.product_image_path,
        traderId: row.trader_id,
      });
    }

    return res.status(200).json({ orders: Array.from(ordersMap.values()) });
  } catch {
    return res.status(500).json({ error: 'Could not fetch sales orders.' });
  }
}

export async function updateSalesOrderStatus(req, res) {
  const orderId = Number(req.params.orderId);
  const status = String(req.body?.status || '').trim().toLowerCase();

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'Invalid order ID.' });
  }

  if (!['to_ship', 'to_receive'].includes(status)) {
    return res.status(400).json({ error: 'status must be to_ship or to_receive.' });
  }

  try {
    const currentOrder = await findSalesOrderStatusByTraderId(req.auth.id, orderId);
    if (!currentOrder) {
      return res.status(404).json({ error: 'Order not found for your products.' });
    }

    const currentStatus = String(currentOrder.status || '').toLowerCase();

    if (status === 'to_ship' && currentStatus !== 'pending') {
      return res.status(400).json({ error: 'Only pending orders can be accepted to to_ship.' });
    }

    if (status === 'to_receive' && currentStatus !== 'to_ship') {
      return res.status(400).json({ error: 'Only to_ship orders can be updated to to_receive.' });
    }

    const affectedRows = await updateSalesOrderStatusByTraderId(req.auth.id, orderId, status);
    if (!affectedRows) {
      return res.status(404).json({ error: 'Order not found for your products.' });
    }

    return res.status(200).json({
      message: 'Order status updated successfully.',
      orderId,
      status,
    });
  } catch {
    return res.status(500).json({ error: 'Could not update sales order status.' });
  }
}

export async function cancelMyOrder(req, res) {
  const orderId = Number(req.params.orderId);
  const cancellationReason = String(req.body?.cancellationReason || '').trim();

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'Invalid order ID.' });
  }

  if (!cancellationReason) {
    return res.status(400).json({ error: 'cancellationReason is required.' });
  }

  try {
    const order = await findOrderByBuyerId(req.auth.id, orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const status = String(order.status || '').toLowerCase();
    if (status !== 'pending') {
      return res.status(400).json({ error: 'Order can only be cancelled before it is shipped.' });
    }

    const affectedRows = await updateOrderStatusByBuyerId(
      req.auth.id,
      orderId,
      'cancelled',
      cancellationReason
    );

    if (!affectedRows) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    return res.status(200).json({ message: 'Order cancelled successfully.' });
  } catch {
    return res.status(500).json({ error: 'Could not cancel order.' });
  }
}

export async function markMyOrderReceived(req, res) {
  const orderId = Number(req.params.orderId);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'Invalid order ID.' });
  }

  try {
    const order = await findOrderByBuyerId(req.auth.id, orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const status = String(order.status || '').toLowerCase();
    if (status !== 'to_receive') {
      return res.status(400).json({ error: 'Only to_receive orders can be completed.' });
    }

    const affectedRows = await updateOrderStatusByBuyerId(req.auth.id, orderId, 'completed');
    if (!affectedRows) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    return res.status(200).json({ message: 'Order marked as received. Transaction completed.' });
  } catch {
    return res.status(500).json({ error: 'Could not complete order.' });
  }
}

export async function listMyPaperUploads(req, res) {
  try {
    const rows = await findPaperUploadsByTraderId(req.auth.id);
    return res.status(200).json({ uploads: rows.map(sanitizePaperUpload) });
  } catch {
    return res.status(500).json({ error: 'Could not fetch paper uploads.' });
  }
}

export async function uploadTraderPaper(req, res) {
  const paperType = String(req.body?.paperType || '').trim().toLowerCase();
  const title = String(req.body?.title || '').trim();
  const description = String(req.body?.description || '').trim();

  if (!['to_cut', 'transport'].includes(paperType)) {
    return res.status(400).json({ error: 'paperType must be to_cut or transport.' });
  }

  if (!title) {
    return res.status(400).json({ error: 'title is required.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'paperFile is required.' });
  }

  try {
    const filePath = `/uploads/paper_docs/${req.file.filename}`;
    const createdId = await createPaperUpload({
      traderId: req.auth.id,
      paperType,
      title,
      description,
      filePath,
      originalFileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });

    return res.status(201).json({
      message: 'Paper uploaded successfully and is pending admin review.',
      uploadId: createdId,
    });
  } catch {
    return res.status(500).json({ error: 'Could not upload paper.' });
  }
}

export async function listMessageContacts(req, res) {
  try {
    await updateUserLastSeenById(req.auth.id);
    const rows = await listTraderMessageContacts(req.auth.id);
    return res.status(200).json({
      contacts: rows.map((row) => ({
        traderId: row.trader_id,
        traderName: row.trader_name,
        profileImagePath: row.profile_image_path || '',
        conversationId: row.conversation_id || null,
        lastMessage: row.last_message || '',
        lastSenderId: row.last_sender_id || null,
        lastMessageAt: row.last_message_at || null,
        unreadCount: Number(row.unread_count || 0),
        isOnline: Boolean(
          isTraderOnline(row.trader_id)
          || (row.last_seen_at && (Date.now() - new Date(row.last_seen_at).getTime()) <= PRESENCE_RECENT_WINDOW_MS)
        ),
        lastSeenAt: row.last_seen_at || null,
      })),
    });
  } catch {
    return res.status(200).json({ contacts: [] });
  }
}

async function broadcastPresenceUpdate(changedTraderId) {
  const partnerIds = await listConversationPartnerIds(changedTraderId);
  const uniquePartnerIds = Array.from(new Set(partnerIds));

  for (const partnerId of uniquePartnerIds) {
    pushTraderEvent(partnerId, 'chat-presence', {
      type: 'presence:update',
      traderId: Number(changedTraderId),
    });
  }
}

export function streamMessageEvents(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const currentTraderId = Number(req.auth.id);
  addTraderStreamClient(currentTraderId, res);

  updateUserLastSeenById(currentTraderId);
  broadcastPresenceUpdate(currentTraderId).catch(() => {});

  // Keep the connection alive for proxies that close idle streams.
  const keepAliveTimer = setInterval(() => {
    updateUserLastSeenById(currentTraderId).catch(() => {});
    res.write('event: heartbeat\n');
    res.write(`data: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAliveTimer);
    removeTraderStreamClient(currentTraderId, res);
    updateUserLastSeenById(currentTraderId).catch(() => {});
    broadcastPresenceUpdate(currentTraderId).catch(() => {});
  });
}

export async function listMessagesWithTrader(req, res) {
  const otherTraderId = Number(req.params.traderId);
  if (!Number.isInteger(otherTraderId) || otherTraderId <= 0) {
    return res.status(400).json({ error: 'Invalid trader ID.' });
  }

  if (otherTraderId === req.auth.id) {
    return res.status(400).json({ error: 'You cannot message yourself.' });
  }

  try {
    await updateUserLastSeenById(req.auth.id);
    const otherTrader = await findUserById(otherTraderId);
    if (!otherTrader) {
      return res.status(200).json({
        traderId: otherTraderId,
        messages: [],
      });
    }

    const rows = await listMessagesBetweenTraders(req.auth.id, otherTraderId);
    const callLogs = await listCallLogsBetweenTraders(req.auth.id, otherTraderId);
    console.info('[chat] listMessagesWithTrader', {
      currentTraderId: req.auth.id,
      otherTraderId,
      count: rows.length,
    });
    return res.status(200).json({
      traderId: otherTraderId,
      messages: rows.map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        receiverId: row.receiver_id,
        messageText: row.message_text,
        messageImagePath: row.message_image_path || '',
        replyToMessageId: row.reply_to_message_id || null,
        replyToMessageText: row.reply_to_message_text || '',
        replyToSenderId: row.reply_to_sender_id || null,
        isRead: Boolean(row.is_read),
        createdAt: row.created_at,
      })),
      callLogs: callLogs.map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        callerId: row.caller_id,
        calleeId: row.callee_id,
        callMode: row.call_mode,
        status: row.status,
        startedAt: row.started_at,
        answeredAt: row.answered_at,
        endedAt: row.ended_at,
        durationSeconds: Number(row.duration_seconds || 0),
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('[chat] listMessagesWithTrader failed', {
      currentTraderId: req.auth.id,
      otherTraderId,
      error: error.message,
    });
    return res.status(500).json({ error: 'Could not fetch messages.' });
  }
}

export async function sendMessageToTrader(req, res) {
  const otherTraderId = Number(req.params.traderId);
  const messageText = String(req.body?.messageText || '').trim();
  const messageImagePath = req.file ? `/uploads/messenger/${req.file.filename}` : '';
  const replyToMessageId = Number(req.body?.replyToMessageId);
  const safeReplyToMessageId = Number.isInteger(replyToMessageId) && replyToMessageId > 0
    ? replyToMessageId
    : null;

  if (!Number.isInteger(otherTraderId) || otherTraderId <= 0) {
    return res.status(400).json({ error: 'Invalid trader ID.' });
  }

  if (otherTraderId === req.auth.id) {
    return res.status(400).json({ error: 'You cannot message yourself.' });
  }

  if (!messageText && !messageImagePath) {
    return res.status(400).json({ error: 'messageText or messageImage is required.' });
  }

  if (messageText.length > 2000) {
    return res.status(400).json({ error: 'messageText must be 2000 characters or less.' });
  }

  try {
    await updateUserLastSeenById(req.auth.id);
    const otherTrader = await findUserById(otherTraderId);
    if (!otherTrader || otherTrader.role !== 'trader') {
      return res.status(404).json({ error: 'Trader not found.' });
    }

    const row = await createMessageBetweenTraders(
      req.auth.id,
      otherTraderId,
      messageText,
      safeReplyToMessageId,
      messageImagePath
    );
    const messagePayload = {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      messageText: row.message_text,
      messageImagePath: row.message_image_path || '',
      replyToMessageId: row.reply_to_message_id || null,
      replyToMessageText: row.reply_to_message_text || '',
      replyToSenderId: row.reply_to_sender_id || null,
      isRead: Boolean(row.is_read),
      createdAt: row.created_at,
    };

    pushTraderEvent(req.auth.id, 'chat-message', {
      type: 'message:new',
      partnerId: otherTraderId,
      message: messagePayload,
    });

    pushTraderEvent(otherTraderId, 'chat-message', {
      type: 'message:new',
      partnerId: req.auth.id,
      message: messagePayload,
    });

    return res.status(201).json({
      message: messagePayload,
    });
  } catch (error) {
    if (error.message === 'replyToMessageId is invalid for this conversation.') {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Could not send message.' });
  }
}

export async function heartbeatMessagePresence(req, res) {
  try {
    await updateUserLastSeenById(req.auth.id);
    return res.status(200).json({ ok: true, ts: new Date().toISOString() });
  } catch {
    return res.status(500).json({ error: 'Could not update presence.' });
  }
}

export async function sendCallSignalToTrader(req, res) {
  const otherTraderId = Number(req.params.traderId);
  const signalType = String(req.body?.signalType || '').trim().toLowerCase();
  const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
  const callMode = String(payload?.mode || 'audio').toLowerCase() === 'video' ? 'video' : 'audio';
  const requestedCallId = Number(payload?.callId);
  const callId = Number.isInteger(requestedCallId) && requestedCallId > 0 ? requestedCallId : null;
  const allowedSignalTypes = new Set(['call:invite', 'call:accept', 'call:decline', 'call:offer', 'call:answer', 'call:ice', 'call:end']);

  if (!Number.isInteger(otherTraderId) || otherTraderId <= 0) {
    return res.status(400).json({ error: 'Invalid trader ID.' });
  }

  if (otherTraderId === req.auth.id) {
    return res.status(400).json({ error: 'You cannot call yourself.' });
  }

  if (!allowedSignalTypes.has(signalType)) {
    return res.status(400).json({ error: 'Invalid call signal type.' });
  }

  try {
    await updateUserLastSeenById(req.auth.id);
    const otherTrader = await findUserById(otherTraderId);
    if (!otherTrader || otherTrader.role !== 'trader') {
      return res.status(404).json({ error: 'Trader not found.' });
    }

    let resolvedCallId = callId;
    if (signalType === 'call:invite') {
      resolvedCallId = await createOutgoingCallLog(req.auth.id, otherTraderId, callMode);
    } else if (signalType === 'call:accept' && resolvedCallId) {
      await markCallAccepted(resolvedCallId);
    } else if (signalType === 'call:decline' && resolvedCallId) {
      await markCallDeclined(resolvedCallId);
    } else if (signalType === 'call:end' && resolvedCallId) {
      await markCallEnded(resolvedCallId);
    }

    const eventPayload = {
      type: 'call:signal',
      signalType,
      fromTraderId: req.auth.id,
      toTraderId: otherTraderId,
      payload: {
        ...payload,
        mode: callMode,
        callId: resolvedCallId,
      },
      createdAt: new Date().toISOString(),
    };

    pushTraderEvent(otherTraderId, 'chat-call', eventPayload);
    pushTraderEvent(req.auth.id, 'chat-call', eventPayload);

    return res.status(200).json({
      ok: true,
      callId: resolvedCallId,
    });
  } catch {
    return res.status(500).json({ error: 'Could not send call signal.' });
  }
}
