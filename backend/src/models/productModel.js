import { pool } from '../db.js';

export async function createProduct(payload) {
  const [result] = await pool.execute(
    `
      INSERT INTO products (
        trader_id,
        product_name,
        size,
        length_cm,
        unit_price,
        stock_quantity,
        product_image_path
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.traderId,
      String(payload.productName || '').trim(),
      payload.size,
      payload.lengthCm,
      payload.productPrice,
      payload.stockQuantity,
      payload.productImagePath || null,
    ]
  );

  return result.insertId;
}

export async function findProductsByTraderId(traderId) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        trader_id,
        product_name,
        size,
        length_cm,
        unit_price,
        stock_quantity,
        product_image_path,
        created_at,
        updated_at
      FROM products
      WHERE trader_id = ?
      ORDER BY created_at DESC
    `,
    [traderId]
  );

  return rows;
}

export async function findProductByIdAndTraderId(productId, traderId) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        trader_id,
        product_name,
        size,
        length_cm,
        unit_price,
        stock_quantity,
        product_image_path,
        created_at,
        updated_at
      FROM products
      WHERE id = ? AND trader_id = ?
      LIMIT 1
    `,
    [productId, traderId]
  );

  return rows[0] || null;
}

export async function updateProductByIdAndTraderId(productId, traderId, payload) {
  const [result] = await pool.execute(
    `
      UPDATE products
      SET
        product_name = ?,
        size = ?,
        length_cm = ?,
        unit_price = ?,
        stock_quantity = ?,
        product_image_path = COALESCE(?, product_image_path)
      WHERE id = ? AND trader_id = ?
    `,
    [
      String(payload.productName || '').trim(),
      payload.size,
      payload.lengthCm,
      payload.productPrice,
      payload.stockQuantity,
      payload.productImagePath || null,
      productId,
      traderId,
    ]
  );

  return result.affectedRows;
}

export function sanitizeProduct(product) {
  return {
    id: product.id,
    traderId: product.trader_id,
    productName: product.product_name,
    size: product.size,
    lengthCm: product.length_cm,
    productPrice: Number(product.unit_price || 0),
    stockQuantity: product.stock_quantity,
    productImagePath: product.product_image_path,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}
