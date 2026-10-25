const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// List
router.get('/', async (req, res) => {
  const search = req.query.q || '';
  const [rows] = await pool.query(
    `SELECT * FROM buyers WHERE name LIKE ? OR phone LIKE ? ORDER BY name ASC`,
    [`%${search}%`, `%${search}%`]
  );
  res.render('buyers/list', { buyers: rows, search });
});

// New form
router.get('/new', (req, res) => {
  res.render('buyers/form', { buyer: {}, action: '/buyers', method: 'POST' });
});

// Create
router.post('/', async (req, res) => {
  const { name, phone, email, address, nic, notes } = req.body;
  await pool.query(
    'INSERT INTO buyers (name, phone, email, address, nic, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [name, phone, email, address, nic, notes]
  );
  res.redirect('/buyers');
});

// Edit form
router.get('/:id/edit', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM buyers WHERE id = ?', [req.params.id]);
  if (rows.length === 0) return res.redirect('/buyers');
  res.render('buyers/form', { buyer: rows[0], action: `/buyers/${req.params.id}?_method=PUT`, method: 'POST' });
});

// Update
router.put('/:id', async (req, res) => {
  const { name, phone, email, address, nic, notes } = req.body;
  await pool.query(
    'UPDATE buyers SET name = ?, phone = ?, email = ?, address = ?, nic = ?, notes = ? WHERE id = ?',
    [name, phone, email, address, nic, notes, req.params.id]
  );
  res.redirect('/buyers');
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM buyers WHERE id = ?', [req.params.id]);
  } catch (err) {
    // likely has related sales
  }
  res.redirect('/buyers');
});

// View profile with sales history
router.get('/:id', async (req, res) => {
  const [buyerRows] = await pool.query('SELECT * FROM buyers WHERE id = ?', [req.params.id]);
  if (buyerRows.length === 0) return res.redirect('/buyers');
  const [sales] = await pool.query(
    'SELECT * FROM sales WHERE buyer_id = ? ORDER BY sale_date DESC',
    [req.params.id]
  );
  res.render('buyers/view', { buyer: buyerRows[0], sales });
});

module.exports = router;
