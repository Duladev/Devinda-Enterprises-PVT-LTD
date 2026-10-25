const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// List
router.get('/', async (req, res) => {
    const search = req.query.q || '';
    const [rows] = await pool.query(
        `SELECT * FROM directors
     WHERE name LIKE ? OR designation LIKE ? OR phone LIKE ? OR email LIKE ? OR nic LIKE ?
     ORDER BY name ASC`,
        [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
    );
    res.render('directors/list', { directors: rows, search });
});

// New form
router.get('/new', (req, res) => {
    res.render('directors/form', { director: {}, action: '/directors', method: 'POST' });
});

// Create
router.post('/', async (req, res) => {
    const {
        name,
        designation,
        phone,
        email,
        nic,
        address,
        appointment_date,
        status,
        notes
    } = req.body;

    await pool.query(
        `INSERT INTO directors (name, designation, phone, email, nic, address, appointment_date, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, designation, phone, email, nic, address, appointment_date || null, status || 'Active', notes]
    );

    res.redirect('/directors');
});

// Edit form
router.get('/:id/edit', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM directors WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/directors');
    res.render('directors/form', {
        director: rows[0],
        action: `/directors/${req.params.id}?_method=PUT`,
        method: 'POST'
    });
});

// Update
router.put('/:id', async (req, res) => {
    const {
        name,
        designation,
        phone,
        email,
        nic,
        address,
        appointment_date,
        status,
        notes
    } = req.body;

    await pool.query(
        `UPDATE directors
     SET name = ?, designation = ?, phone = ?, email = ?, nic = ?, address = ?, appointment_date = ?, status = ?, notes = ?
     WHERE id = ?`,
        [name, designation, phone, email, nic, address, appointment_date || null, status || 'Active', notes, req.params.id]
    );

    res.redirect('/directors');
});

// Delete
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM directors WHERE id = ?', [req.params.id]);
    } catch (err) {
        // no-op: keep redirect behavior consistent
    }
    res.redirect('/directors');
});

// View profile
router.get('/:id', async (req, res) => {
    const [directorRows] = await pool.query('SELECT * FROM directors WHERE id = ?', [req.params.id]);
    if (directorRows.length === 0) return res.redirect('/directors');
    res.render('directors/view', { director: directorRows[0] });
});

module.exports = router;
