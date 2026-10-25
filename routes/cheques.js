const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
    const search = req.query.q || '';
    const [rows] = await pool.query(
        `SELECT c.*, a.name AS account_name
     FROM cheques c
     LEFT JOIN bank_accounts a ON a.id = c.account_id
     WHERE c.cheque_no LIKE ? OR c.payee LIKE ? OR c.bank_name LIKE ? OR a.name LIKE ?
     ORDER BY c.issue_date DESC, c.id DESC`,
        [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
    );
    res.render('cheques/list', { cheques: rows, search });
});

router.get('/new', async (req, res) => {
    const [accounts] = await pool.query('SELECT * FROM bank_accounts ORDER BY name ASC');
    res.render('cheques/form', { cheque: {}, accounts, action: '/cheques', method: 'POST' });
});

router.post('/', async (req, res) => {
    const {
        account_id,
        cheque_no,
        payee,
        amount,
        issue_date,
        due_date,
        cheque_type,
        status,
        bank_name,
        branch,
        notes
    } = req.body;

    await pool.query(
        `INSERT INTO cheques (account_id, cheque_no, payee, amount, issue_date, due_date, cheque_type, status, bank_name, branch, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [account_id || null, cheque_no, payee, Number(amount || 0), issue_date || null, due_date || null, cheque_type || 'Issued', status || 'Pending', bank_name || null, branch || null, notes || null]
    );

    res.redirect('/cheques');
});

router.get('/:id/edit', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM cheques WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/cheques');

    const [accounts] = await pool.query('SELECT * FROM bank_accounts ORDER BY name ASC');
    res.render('cheques/form', {
        cheque: rows[0],
        accounts,
        action: `/cheques/${req.params.id}?_method=PUT`,
        method: 'POST'
    });
});

router.put('/:id', async (req, res) => {
    const {
        account_id,
        cheque_no,
        payee,
        amount,
        issue_date,
        due_date,
        cheque_type,
        status,
        bank_name,
        branch,
        notes
    } = req.body;

    await pool.query(
        `UPDATE cheques
     SET account_id = ?, cheque_no = ?, payee = ?, amount = ?, issue_date = ?, due_date = ?, cheque_type = ?, status = ?, bank_name = ?, branch = ?, notes = ?
     WHERE id = ?`,
        [account_id || null, cheque_no, payee, Number(amount || 0), issue_date || null, due_date || null, cheque_type || 'Issued', status || 'Pending', bank_name || null, branch || null, notes || null, req.params.id]
    );

    res.redirect('/cheques');
});

router.delete('/:id', async (req, res) => {
    await pool.query('DELETE FROM cheques WHERE id = ?', [req.params.id]);
    res.redirect('/cheques');
});

module.exports = router;
