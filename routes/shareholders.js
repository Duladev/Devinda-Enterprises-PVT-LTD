const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// List
router.get('/', async (req, res) => {
    const search = req.query.q || '';
    const [rows] = await pool.query(
        `SELECT * FROM shareholders
     WHERE name LIKE ? OR share_type LIKE ? OR phone LIKE ? OR email LIKE ? OR nic LIKE ?
     ORDER BY name ASC`,
        [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
    );
    res.render('shareholders/list', { shareholders: rows, search });
});

// New form
router.get('/new', (req, res) => {
    res.render('shareholders/form', { shareholder: {}, action: '/shareholders', method: 'POST' });
});

// Create
router.post('/', async (req, res) => {
    const {
        name,
        share_type,
        shares,
        share_percentage,
        phone,
        email,
        nic,
        address,
        status,
        notes
    } = req.body;

    await pool.query(
        `INSERT INTO shareholders (name, share_type, shares, share_percentage, phone, email, nic, address, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, share_type || 'Individual', shares || 0, share_percentage || 0, phone, email, nic, address, status || 'Active', notes]
    );

    res.redirect('/shareholders');
});

// Edit form
router.get('/:id/edit', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM shareholders WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/shareholders');
    res.render('shareholders/form', {
        shareholder: rows[0],
        action: `/shareholders/${req.params.id}?_method=PUT`,
        method: 'POST'
    });
});

// Update
router.put('/:id', async (req, res) => {
    const {
        name,
        share_type,
        shares,
        share_percentage,
        phone,
        email,
        nic,
        address,
        status,
        notes
    } = req.body;

    await pool.query(
        `UPDATE shareholders
     SET name = ?, share_type = ?, shares = ?, share_percentage = ?, phone = ?, email = ?, nic = ?, address = ?, status = ?, notes = ?
     WHERE id = ?`,
        [name, share_type || 'Individual', shares || 0, share_percentage || 0, phone, email, nic, address, status || 'Active', notes, req.params.id]
    );

    res.redirect('/shareholders');
});

// Delete
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM shareholders WHERE id = ?', [req.params.id]);
    } catch (err) {
        // no-op: keep redirect behavior consistent
    }
    res.redirect('/shareholders');
});

// View profile
router.get('/:id', async (req, res) => {
    const [shareholderRows] = await pool.query('SELECT * FROM shareholders WHERE id = ?', [req.params.id]);
    if (shareholderRows.length === 0) return res.redirect('/shareholders');
    res.render('shareholders/view', { shareholder: shareholderRows[0] });
});

module.exports = router;
