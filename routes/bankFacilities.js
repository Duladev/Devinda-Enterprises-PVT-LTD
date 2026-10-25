const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
    const search = req.query.q || '';
    const [rows] = await pool.query(
        `SELECT f.*, a.name AS account_name
     FROM bank_facilities f
     LEFT JOIN bank_accounts a ON a.id = f.account_id
     WHERE f.name LIKE ? OR f.provider LIKE ? OR f.facility_type LIKE ? OR a.name LIKE ?
     ORDER BY f.start_date DESC, f.id DESC`,
        [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
    );
    res.render('bank-facilities/list', { facilities: rows, search });
});

router.get('/new', async (req, res) => {
    const [accounts] = await pool.query('SELECT * FROM bank_accounts ORDER BY name ASC');
    res.render('bank-facilities/form', { facility: {}, accounts, action: '/bank-facilities', method: 'POST' });
});

router.post('/', async (req, res) => {
    const {
        account_id,
        name,
        facility_type,
        provider,
        principal_amount,
        outstanding_amount,
        interest_rate,
        start_date,
        end_date,
        installment_amount,
        status,
        notes
    } = req.body;

    await pool.query(
        `INSERT INTO bank_facilities (account_id, name, facility_type, provider, principal_amount, outstanding_amount, interest_rate, start_date, end_date, installment_amount, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [account_id || null, name, facility_type || 'Loan', provider || null, Number(principal_amount || 0), Number(outstanding_amount || 0), Number(interest_rate || 0), start_date || null, end_date || null, Number(installment_amount || 0), status || 'Active', notes || null]
    );

    res.redirect('/bank-facilities');
});
router.get('/:id', async (req, res) => {
    const [rows] = await pool.query(
        `SELECT f.*, a.name AS account_name, a.bank_name AS account_bank_name
     FROM bank_facilities f
     LEFT JOIN bank_accounts a ON a.id = f.account_id
     WHERE f.id = ?`,
        [req.params.id]
    );

    if (rows.length === 0) return res.redirect('/bank-facilities');

    const facility = rows[0];
    res.render('bank-facilities/view', { facility });
});
router.get('/:id/edit', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM bank_facilities WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/bank-facilities');

    const [accounts] = await pool.query('SELECT * FROM bank_accounts ORDER BY name ASC');
    res.render('bank-facilities/form', {
        facility: rows[0],
        accounts,
        action: `/bank-facilities/${req.params.id}?_method=PUT`,
        method: 'POST'
    });
});

router.put('/:id', async (req, res) => {
    const {
        account_id,
        name,
        facility_type,
        provider,
        principal_amount,
        outstanding_amount,
        interest_rate,
        start_date,
        end_date,
        installment_amount,
        status,
        notes
    } = req.body;

    await pool.query(
        `UPDATE bank_facilities
     SET account_id = ?, name = ?, facility_type = ?, provider = ?, principal_amount = ?, outstanding_amount = ?, interest_rate = ?, start_date = ?, end_date = ?, installment_amount = ?, status = ?, notes = ?
     WHERE id = ?`,
        [account_id || null, name, facility_type || 'Loan', provider || null, Number(principal_amount || 0), Number(outstanding_amount || 0), Number(interest_rate || 0), start_date || null, end_date || null, Number(installment_amount || 0), status || 'Active', notes || null, req.params.id]
    );

    res.redirect('/bank-facilities');
});

router.delete('/:id', async (req, res) => {
    await pool.query('DELETE FROM bank_facilities WHERE id = ?', [req.params.id]);
    res.redirect('/bank-facilities');
});

module.exports = router;
