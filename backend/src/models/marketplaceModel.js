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
        u.gcash_qr_path,
        u.contact_number,
        u.business_address,
        p.id AS product_id,
        p.product_name,
        p.size,
        p.length_cm,
        p.unit_price,
        p.stock_quantity,
        p.product_image_path,
        p.created_at AS product_created_at,
        COALESCE(pm.total_sold_quantity, 0) AS total_sold_quantity,
        pm.average_rating,
        COALESCE(pm.rating_count, 0) AS rating_count
      FROM users u
      LEFT JOIN products p ON p.trader_id = u.id
      LEFT JOIN (
        SELECT
          oi.product_id,
          SUM(CASE WHEN o.status = 'completed' THEN oi.quantity ELSE 0 END) AS total_sold_quantity,
          AVG(CASE WHEN o.status = 'completed' AND o.buyer_rating BETWEEN 1 AND 5 THEN o.buyer_rating END) AS average_rating,
          SUM(CASE WHEN o.status = 'completed' AND o.buyer_rating BETWEEN 1 AND 5 THEN 1 ELSE 0 END) AS rating_count
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        GROUP BY oi.product_id
      ) pm ON pm.product_id = p.id
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
        u.gcash_qr_path,
        u.contact_number,
        u.business_address,
        p.id AS product_id,
        p.product_name,
        p.size,
        p.length_cm,
        p.unit_price,
        p.stock_quantity,
        p.product_image_path,
        p.created_at AS product_created_at,
        COALESCE(pm.total_sold_quantity, 0) AS total_sold_quantity,
        pm.average_rating,
        COALESCE(pm.rating_count, 0) AS rating_count
      FROM users u
      LEFT JOIN products p ON p.trader_id = u.id
      LEFT JOIN (
        SELECT
          oi.product_id,
          SUM(CASE WHEN o.status = 'completed' THEN oi.quantity ELSE 0 END) AS total_sold_quantity,
          AVG(CASE WHEN o.status = 'completed' AND o.buyer_rating BETWEEN 1 AND 5 THEN o.buyer_rating END) AS average_rating,
          SUM(CASE WHEN o.status = 'completed' AND o.buyer_rating BETWEEN 1 AND 5 THEN 1 ELSE 0 END) AS rating_count
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        GROUP BY oi.product_id
      ) pm ON pm.product_id = p.id
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
         , unit_price
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
      ON DUPLICATE KEY UPDATE
        quantity = quantity + VALUES(quantity),
        id = LAST_INSERT_ID(id)
    `,
    [buyerId, productId, quantity]
  );

  return {
    affectedRows: result.affectedRows,
    cartItemId: Number(result.insertId || 0),
  };
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
        p.unit_price,
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

export async function findCartItemById(buyerId, cartItemId) {
  const [rows] = await pool.execute(
    `
      SELECT
        ci.id,
        ci.quantity,
        p.id AS product_id,
        p.product_name,
        p.stock_quantity
      FROM cart_items ci
      INNER JOIN products p ON p.id = ci.product_id
      WHERE ci.id = ? AND ci.buyer_id = ?
      LIMIT 1
    `,
    [cartItemId, buyerId]
  );

  return rows[0] || null;
}

export async function updateCartItemQuantityById(buyerId, cartItemId, quantity) {
  const [result] = await pool.execute(
    `
      UPDATE cart_items
      SET quantity = ?
      WHERE id = ? AND buyer_id = ?
    `,
    [quantity, cartItemId, buyerId]
  );

  return result.affectedRows;
}

export async function placeOrderFromCart(buyerId, checkoutDetails, selectedCartItemIds = []) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const normalizedSelectedIds = [...new Set(
      selectedCartItemIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )];

    if (!normalizedSelectedIds.length) {
      throw new Error('Please select at least one cart item to checkout.');
    }

    const selectedPlaceholders = normalizedSelectedIds.map(() => '?').join(', ');

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
          p.unit_price,
          p.stock_quantity,
          p.product_image_path
        FROM cart_items ci
        INNER JOIN products p ON p.id = ci.product_id
        WHERE ci.buyer_id = ?
          AND ci.id IN (${selectedPlaceholders})
        FOR UPDATE
      `,
      [buyerId, ...normalizedSelectedIds]
    );

    if (!cartRows.length) {
      throw new Error('No valid selected cart items were found.');
    }

    if (cartRows.length !== normalizedSelectedIds.length) {
      throw new Error('Some selected cart items are no longer available. Please refresh your cart.');
    }

    for (const row of cartRows) {
      if (row.quantity > row.stock_quantity) {
        throw new Error(`Not enough stock for ${row.product_name}.`);
      }
    }

    const [orderResult] = await connection.execute(
      `
        INSERT INTO orders (
          buyer_id,
          status,
          customer_full_name,
          customer_contact_number,
          delivery_region,
          delivery_province,
          delivery_city,
          delivery_barangay,
          delivery_street_address,
          delivery_full_address,
          payment_method,
          payment_status,
          payment_receipt_path,
          payment_submitted_at,
          delivery_notes
        )
        VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        buyerId,
        checkoutDetails.fullName,
        checkoutDetails.contactNumber,
        checkoutDetails.regionName,
        checkoutDetails.provinceName,
        checkoutDetails.cityName,
        checkoutDetails.barangayName,
        checkoutDetails.streetAddress,
        checkoutDetails.fullAddress,
        checkoutDetails.paymentMethod,
        checkoutDetails.paymentStatus,
        checkoutDetails.paymentReceiptPath,
        checkoutDetails.paymentSubmittedAt,
        checkoutDetails.deliveryNotes,
      ]
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
            unit_price,
            quantity,
            line_total,
            product_image_path
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          row.product_id,
          row.trader_id,
          row.product_name,
          row.size,
          row.length_cm,
          row.unit_price,
          row.quantity,
          Number((Number(row.unit_price || 0) * Number(row.quantity || 0)).toFixed(2)),
          row.product_image_path,
        ]
      );

      const [stockUpdateResult] = await connection.execute(
        `
          UPDATE products
          SET stock_quantity = stock_quantity - ?
          WHERE id = ? AND stock_quantity >= ?
        `,
        [row.quantity, row.product_id, row.quantity]
      );

      if (!stockUpdateResult.affectedRows) {
        throw new Error(`Not enough stock for ${row.product_name}.`);
      }
    }

    await connection.execute(
      `
        DELETE FROM cart_items
        WHERE buyer_id = ?
          AND id IN (${selectedPlaceholders})
      `,
      [buyerId, ...normalizedSelectedIds]
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
        o.dispatch_date,
        o.customer_full_name,
        o.customer_contact_number,
        o.delivery_region,
        o.delivery_province,
        o.delivery_city,
        o.delivery_barangay,
        o.delivery_street_address,
        o.delivery_full_address,
        o.payment_method,
        o.payment_status,
        o.payment_receipt_path,
        o.payment_submitted_at,
        o.payment_verified_at,
        o.payment_verified_by,
        o.delivery_notes,
        o.cancellation_reason,
        o.buyer_rating,
        o.buyer_review,
        o.buyer_rated_at,
        o.updated_at AS order_updated_at,
        o.created_at AS order_created_at,
        oi.id AS order_item_id,
        oi.product_id,
        oi.product_name,
        oi.size,
        oi.length_cm,
        oi.unit_price,
        oi.quantity,
        oi.line_total,
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

export async function listSalesOrderItemsByTraderId(traderId) {
  const [rows] = await pool.execute(
    `
      SELECT
        o.id AS order_id,
        o.status,
        o.dispatch_date,
        o.customer_full_name,
        o.customer_contact_number,
        o.delivery_region,
        o.delivery_province,
        o.delivery_city,
        o.delivery_barangay,
        o.delivery_street_address,
        o.delivery_full_address,
        o.payment_method,
        o.payment_status,
        o.payment_receipt_path,
        o.payment_submitted_at,
        o.payment_verified_at,
        o.payment_verified_by,
        o.delivery_notes,
        o.cancellation_reason,
        o.buyer_rating,
        o.buyer_review,
        o.buyer_rated_at,
        o.updated_at AS order_updated_at,
        o.created_at AS order_created_at,
        oi.id AS order_item_id,
        oi.product_id,
        oi.product_name,
        oi.size,
        oi.length_cm,
        oi.unit_price,
        oi.quantity,
        oi.line_total,
        oi.product_image_path,
        oi.trader_id,
        COALESCE(NULLIF(buyer.profile_name, ''), buyer.full_name) AS buyer_name
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      INNER JOIN users buyer ON buyer.id = o.buyer_id
      WHERE oi.trader_id = ?
      ORDER BY o.created_at DESC, oi.id ASC
    `,
    [traderId]
  );

  return rows;
}

export async function findSalesOrderStatusByTraderId(traderId, orderId) {
  const [rows] = await pool.execute(
    `
      SELECT o.id AS order_id, o.status, o.payment_method, o.payment_status, o.payment_receipt_path
      FROM orders o
      INNER JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id = ? AND oi.trader_id = ?
      LIMIT 1
    `,
    [orderId, traderId]
  );

  return rows[0] || null;
}

export async function updateSalesOrderStatusByTraderId(traderId, orderId, status) {
  const [result] = await pool.execute(
    `
      UPDATE orders o
      INNER JOIN order_items oi ON oi.order_id = o.id
      SET
        o.status = ?,
        o.payment_status = CASE
          WHEN ? = 'to_ship' AND o.payment_method = 'gcash' THEN 'verified'
          ELSE o.payment_status
        END,
        o.payment_verified_at = CASE
          WHEN ? = 'to_ship' AND o.payment_method = 'gcash' THEN NOW()
          ELSE o.payment_verified_at
        END,
        o.payment_verified_by = CASE
          WHEN ? = 'to_ship' AND o.payment_method = 'gcash' THEN ?
          ELSE o.payment_verified_by
        END,
        o.dispatch_date = CASE
          WHEN ? = 'to_ship' THEN COALESCE(o.dispatch_date, NOW())
          ELSE o.dispatch_date
        END
      WHERE o.id = ? AND oi.trader_id = ?
    `,
    [status, status, status, status, traderId, status, orderId, traderId]
  );

  return result.affectedRows;
}

export async function findOrderByBuyerId(buyerId, orderId) {
  const [rows] = await pool.execute(
    `
      SELECT id, status, cancellation_reason
      FROM orders
      WHERE id = ? AND buyer_id = ?
      LIMIT 1
    `,
    [orderId, buyerId]
  );

  return rows[0] || null;
}

export async function updateOrderStatusByBuyerId(buyerId, orderId, status, cancellationReason = null) {
  const [result] = await pool.execute(
    `
      UPDATE orders
      SET
        status = ?,
        cancellation_reason = CASE
          WHEN ? = 'cancelled' THEN ?
          ELSE cancellation_reason
        END
      WHERE id = ? AND buyer_id = ?
    `,
    [status, status, cancellationReason, orderId, buyerId]
  );

  return result.affectedRows;
}

export async function completeOrderWithRatingByBuyerId(buyerId, orderId, rating, review = null) {
  const [result] = await pool.execute(
    `
      UPDATE orders
      SET
        status = 'completed',
        buyer_rating = ?,
        buyer_review = ?,
        buyer_rated_at = NOW()
      WHERE id = ? AND buyer_id = ?
    `,
    [rating, review, orderId, buyerId]
  );

  return result.affectedRows;
}
