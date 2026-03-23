import { pool } from '../db.js';

export async function createProduct(payload) {
  const [result] = await pool.execute(
    `
      INSERT INTO products (
        trader_id,
        product_name,
        size,
        length_cm,
        stock_quantity,
        product_image_path
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      payload.traderId,
      String(payload.productName || '').trim(),
      payload.size,
      payload.lengthCm,
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

export function sanitizeProduct(product) {
  return {
    id: product.id,
    traderId: product.trader_id,
    productName: product.product_name,
    size: product.size,
    lengthCm: product.length_cm,
    stockQuantity: product.stock_quantity,
    productImagePath: product.product_image_path,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}
