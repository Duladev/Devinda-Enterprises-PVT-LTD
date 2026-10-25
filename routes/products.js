const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// List (inventory view)
router.get('/', async (req, res) => {
  const search = req.query.q || '';
  const [rows] = await pool.query(
    `SELECT * FROM products WHERE name LIKE ? ORDER BY name ASC`,
    [`%${search}%`]
  );
  res.render('products/list', { products: rows, search });
});

// New form
router.get('/new', (req, res) => {
  res.render('products/form', { product: {}, action: '/products', method: 'POST' });
});

// Create
router.post('/', async (req, res) => {
  const { name, category, unit, current_stock, reorder_level, cost_price, selling_price } = req.body;
  await pool.query(
    `INSERT INTO products (name, category, unit, current_stock, reorder_level, cost_price, selling_price)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, category, unit, current_stock || 0, reorder_level || 0, cost_price || 0, selling_price || 0]
  );
  res.redirect('/products');
});

// Edit form
router.get('/:id/edit', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (rows.length === 0) return res.redirect('/products');
  res.render('products/form', { product: rows[0], action: `/products/${req.params.id}?_method=PUT`, method: 'POST' });
});

// Update (note: current_stock is NOT editable here directly - use purchases/sales/stock adjustment)
router.put('/:id', async (req, res) => {
  const { name, category, unit, reorder_level, cost_price, selling_price } = req.body;
  await pool.query(
    `UPDATE products SET name = ?, category = ?, unit = ?, reorder_level = ?, cost_price = ?, selling_price = ?
     WHERE id = ?`,
    [name, category, unit, reorder_level || 0, cost_price || 0, selling_price || 0, req.params.id]
  );
  res.redirect('/products');
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
  } catch (err) {
    // likely referenced in purchase/sale items
  }
  res.redirect('/products');
});

// Manual stock adjustment (e.g. correcting spoilage, counting errors)
router.post('/:id/adjust', async (req, res) => {
  const { adjust_type, quantity, reason } = req.body; // adjust_type: 'add' | 'remove'
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { adjustStock } = require('../config/helpers');
    const type = adjust_type === 'remove' ? 'OUT' : 'IN';
    await adjustStock(connection, req.params.id, type, quantity, 'ADJUSTMENT', null);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    console.error(err);
  } finally {
    connection.release();
  }
  res.redirect('/products');
});

// View stock transaction history for one product
router.get('/:id/history', async (req, res) => {
  const [productRows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (productRows.length === 0) return res.redirect('/products');
  const [transactions] = await pool.query(
    'SELECT * FROM stock_transactions WHERE product_id = ? ORDER BY created_at DESC',
    [req.params.id]
  );
  res.render('products/history', { product: productRows[0], transactions });
});

module.exports = router;
