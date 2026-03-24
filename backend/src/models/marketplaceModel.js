import { pool } from '../db.js';

export async function findMarketplaceRows() {
  const [rows] = await pool.execute(
    `
      SELECT
        u.id AS trader_id,
        u.full_name,
        u.profile_name,
        u.profile_description,
        u.profile_image_path,
        u.contact_number,
        u.business_address,
        p.id AS product_id,
        p.product_name,
        p.size,
        p.length_cm,
        p.stock_quantity,
        p.product_image_path,
        p.created_at AS product_created_at
      FROM users u
      LEFT JOIN products p ON p.trader_id = u.id
      WHERE u.role = 'trader'
      ORDER BY u.created_at DESC, p.created_at DESC
    `
  );

  return rows;
}

export async function findMarketplaceRowsByTraderId(traderId) {
  const [rows] = await pool.execute(
    `
      SELECT
        u.id AS trader_id,
        u.full_name,
        u.profile_name,
        u.profile_description,
        u.profile_image_path,
        u.contact_number,
        u.business_address,
        p.id AS product_id,
        p.product_name,
        p.size,
        p.length_cm,
        p.stock_quantity,
        p.product_image_path,
        p.created_at AS product_created_at
      FROM users u
      LEFT JOIN products p ON p.trader_id = u.id
      WHERE u.role = 'trader' AND u.id = ?
      ORDER BY u.created_at DESC, p.created_at DESC
    `,
    [traderId]
  );

  return rows;
}

export async function findProductById(productId) {
  const [rows] = await pool.execute(
    `
      SELECT id, trader_id, product_name, size, length_cm, stock_quantity, product_image_path
      FROM products
      WHERE id = ?
      LIMIT 1
    `,
    [productId]
  );

  return rows[0] || null;
}

export async function addToCart(buyerId, productId, quantity) {
  const [result] = await pool.execute(
    `
      INSERT INTO cart_items (buyer_id, product_id, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
    `,
    [buyerId, productId, quantity]
  );

  return result.affectedRows;
}

export async function listCartByBuyerId(buyerId) {
  const [rows] = await pool.execute(
    `
      SELECT
        ci.id,
        ci.quantity,
        ci.product_id,
        p.product_name,
        p.size,
        p.length_cm,
        p.stock_quantity,
        p.product_image_path,
        p.trader_id,
        COALESCE(NULLIF(u.profile_name, ''), u.full_name) AS trader_name
      FROM cart_items ci
      INNER JOIN products p ON p.id = ci.product_id
      INNER JOIN users u ON u.id = p.trader_id
      WHERE ci.buyer_id = ?
      ORDER BY ci.created_at DESC
    `,
    [buyerId]
  );

  return rows;
}

export async function removeCartItemById(buyerId, cartItemId) {
  const [result] = await pool.execute(
    `
      DELETE FROM cart_items
      WHERE id = ? AND buyer_id = ?
    `,
    [cartItemId, buyerId]
  );

  return result.affectedRows;
}

export async function placeOrderFromCart(buyerId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [cartRows] = await connection.execute(
      `
        SELECT
          ci.id,
          ci.quantity,
          p.id AS product_id,
          p.trader_id,
          p.product_name,
          p.size,
          p.length_cm,
          p.stock_quantity,
          p.product_image_path
        FROM cart_items ci
        INNER JOIN products p ON p.id = ci.product_id
        WHERE ci.buyer_id = ?
        FOR UPDATE
      `,
      [buyerId]
    );

    if (!cartRows.length) {
      throw new Error('Your cart is empty.');
    }

    for (const row of cartRows) {
      if (row.quantity > row.stock_quantity) {
        throw new Error(`Not enough stock for ${row.product_name}.`);
      }
    }

    const [orderResult] = await connection.execute(
      `
        INSERT INTO orders (buyer_id, status)
        VALUES (?, 'to_ship')
      `,
      [buyerId]
    );

    const orderId = orderResult.insertId;

    for (const row of cartRows) {
      await connection.execute(
        `
          INSERT INTO order_items (
            order_id,
            product_id,
            trader_id,
            product_name,
            size,
            length_cm,
            quantity,
            product_image_path
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          row.product_id,
          row.trader_id,
          row.product_name,
          row.size,
          row.length_cm,
          row.quantity,
          row.product_image_path,
        ]
      );

      await connection.execute(
        `
          UPDATE products
          SET stock_quantity = stock_quantity - ?
          WHERE id = ?
        `,
        [row.quantity, row.product_id]
      );
    }

    await connection.execute(
      `
        DELETE FROM cart_items
        WHERE buyer_id = ?
      `,
      [buyerId]
    );

    await connection.commit();
    return orderId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listOrdersByBuyerId(buyerId) {
  const [rows] = await pool.execute(
    `
      SELECT
        o.id AS order_id,
        o.status,
        o.created_at AS order_created_at,
        oi.id AS order_item_id,
        oi.product_id,
        oi.product_name,
        oi.size,
        oi.length_cm,
        oi.quantity,
        oi.product_image_path,
        oi.trader_id,
        COALESCE(NULLIF(u.profile_name, ''), u.full_name) AS trader_name
      FROM orders o
      INNER JOIN order_items oi ON oi.order_id = o.id
      INNER JOIN users u ON u.id = oi.trader_id
      WHERE o.buyer_id = ?
      ORDER BY o.created_at DESC, oi.id ASC
    `,
    [buyerId]
  );

  return rows;
}
