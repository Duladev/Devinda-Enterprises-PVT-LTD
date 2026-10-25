const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// List
router.get('/', async (req, res) => {
  const search = req.query.q || '';
  const [rows] = await pool.query(
    `SELECT * FROM sellers WHERE name LIKE ? OR phone LIKE ? ORDER BY name ASC`,
    [`%${search}%`, `%${search}%`]
  );
  res.render('sellers/list', { sellers: rows, search });
});

// New form
router.get('/new', (req, res) => {
  res.render('sellers/form', { seller: {}, action: '/sellers', method: 'POST' });
});

// Create
router.post('/', async (req, res) => {
  const { name, phone, email, address, nic, notes } = req.body;
  await pool.query(
    'INSERT INTO sellers (name, phone, email, address, nic, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [name, phone, email, address, nic, notes]
  );
  res.redirect('/sellers');
});

// Edit form
router.get('/:id/edit', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM sellers WHERE id = ?', [req.params.id]);
  if (rows.length === 0) return res.redirect('/sellers');
  res.render('sellers/form', { seller: rows[0], action: `/sellers/${req.params.id}?_method=PUT`, method: 'POST' });
});

// Update
router.put('/:id', async (req, res) => {
  const { name, phone, email, address, nic, notes } = req.body;
  await pool.query(
    'UPDATE sellers SET name = ?, phone = ?, email = ?, address = ?, nic = ?, notes = ? WHERE id = ?',
    [name, phone, email, address, nic, notes, req.params.id]
  );
  res.redirect('/sellers');
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM sellers WHERE id = ?', [req.params.id]);
  } catch (err) {
    // likely has related purchases
  }
  res.redirect('/sellers');
});

// View profile with purchase history
router.get('/:id', async (req, res) => {
  const [sellerRows] = await pool.query('SELECT * FROM sellers WHERE id = ?', [req.params.id]);
  if (sellerRows.length === 0) return res.redirect('/sellers');
  const [purchases] = await pool.query(
    'SELECT * FROM purchases WHERE seller_id = ? ORDER BY purchase_date DESC',
    [req.params.id]
  );
  res.render('sellers/view', { seller: sellerRows[0], purchases });
});

module.exports = router;
