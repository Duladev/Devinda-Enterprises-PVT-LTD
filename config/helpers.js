const pool = require('./db');

// Generate a document number like INV-20260906-0001 or PUR-20260906-0001
async function generateDocNumber(prefix, table, column) {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${column} LIKE ?`,
    [`${prefix}-${datePart}-%`]
  );
  const seq = String(rows[0].cnt + 1).padStart(4, '0');
  return `${prefix}-${datePart}-${seq}`;
}

// Adjust stock for a product and log the transaction.
// type: 'IN' | 'OUT' | 'ADJUST'
async function adjustStock(connection, productId, type, quantity, refType, refId) {
  const qty = parseFloat(quantity);
  const change = type === 'OUT' ? -qty : qty;

  await connection.query(
    'UPDATE products SET current_stock = current_stock + ? WHERE id = ?',
    [change, productId]
  );

  const [rows] = await connection.query('SELECT current_stock FROM products WHERE id = ?', [productId]);
  const balanceAfter = rows[0] ? rows[0].current_stock : null;

  await connection.query(
    `INSERT INTO stock_transactions (product_id, type, quantity, ref_type, ref_id, balance_after)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [productId, type, qty, refType, refId, balanceAfter]
  );
}

function money(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = { generateDocNumber, adjustStock, money };
