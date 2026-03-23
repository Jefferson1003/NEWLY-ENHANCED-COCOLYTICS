import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import {
  addToCart,
  findMarketplaceRows,
  findProductById,
  listCartByBuyerId,
  listOrdersByBuyerId,
  placeOrderFromCart,
  removeCartItemById,
} from '../models/marketplaceModel.js';
import { createProduct, findProductsByTraderId, sanitizeProduct } from '../models/productModel.js';
import { findUserById, sanitizeUser, updateTraderProfileById } from '../models/userModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../../frontend/public/uploads/products_img');

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

export async function listMarketplace(req, res) {
  try {
    const rows = await findMarketplaceRows();
    const tradersMap = new Map();

    for (const row of rows) {
      if (!tradersMap.has(row.trader_id)) {
        tradersMap.set(row.trader_id, {
          traderId: row.trader_id,
          name: row.profile_name || row.full_name,
          description: row.profile_description || '',
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

    const traders = Array.from(tradersMap.values());
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

    await addToCart(req.auth.id, productId, quantity);
    return res.status(200).json({ message: 'Product added to cart.' });
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

export async function placeOrder(req, res) {
  try {
    const orderId = await placeOrderFromCart(req.auth.id);
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
