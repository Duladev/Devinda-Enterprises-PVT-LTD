const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// List
router.get('/', async (req, res) => {
    const search = req.query.q || '';
    const [rows] = await pool.query(
        `SELECT * FROM employees 
     WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR nic LIKE ?
     ORDER BY name ASC`,
        [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
    );
    res.render('employees/list', { employees: rows, search });
});

// New form
router.get('/new', (req, res) => {
    res.render('employees/form', { employee: {}, action: '/employees', method: 'POST' });
});

// Create
router.post('/', async (req, res) => {
    const {
        name,
        position,
        phone,
        email,
        nic,
        address,
        join_date,
        salary,
        status,
        notes
    } = req.body;

    await pool.query(
        `INSERT INTO employees (name, position, phone, email, nic, address, join_date, salary, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, position, phone, email, nic, address, join_date || null, salary || 0, status || 'Active', notes]
    );

    res.redirect('/employees');
});

// Edit form
router.get('/:id/edit', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM employees WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/employees');
    res.render('employees/form', {
        employee: rows[0],
        action: `/employees/${req.params.id}?_method=PUT`,
        method: 'POST'
    });
});

// Update
router.put('/:id', async (req, res) => {
    const {
        name,
        position,
        phone,
        email,
        nic,
        address,
        join_date,
        salary,
        status,
        notes
    } = req.body;

    await pool.query(
        `UPDATE employees
     SET name = ?, position = ?, phone = ?, email = ?, nic = ?, address = ?, join_date = ?, salary = ?, status = ?, notes = ?
     WHERE id = ?`,
        [name, position, phone, email, nic, address, join_date || null, salary || 0, status || 'Active', notes, req.params.id]
    );

    res.redirect('/employees');
});

// Delete
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM employees WHERE id = ?', [req.params.id]);
    } catch (err) {
        // no-op: keep redirect behavior consistent
    }
    res.redirect('/employees');
});

// View profile
router.get('/:id', async (req, res) => {
    const [employeeRows] = await pool.query('SELECT * FROM employees WHERE id = ?', [req.params.id]);
    if (employeeRows.length === 0) return res.redirect('/employees');
    res.render('employees/view', { employee: employeeRows[0] });
});

module.exports = router;
