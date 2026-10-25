const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// List assets
router.get('/', async (req, res) => {
    const search = req.query.q || '';
    const [rows] = await pool.query(
        `SELECT * FROM assets
     WHERE name LIKE ? OR category LIKE ? OR location LIKE ? OR serial_no LIKE ? OR acquisition_type LIKE ? OR finance_provider LIKE ?
     ORDER BY name ASC`,
        [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
    );

    const assets = rows.map(asset => ({
        ...asset,
        totalPaid: Number(asset.down_payment || 0) + Number(asset.months_paid || 0) * Number(asset.installment_amount || 0),
        remainingBalance: asset.acquisition_type === 'Installment'
            ? Number((Number(asset.purchase_cost || 0) - Number(asset.down_payment || 0) - Number(asset.months_paid || 0) * Number(asset.installment_amount || 0)).toFixed(2))
            : Number(asset.purchase_cost || 0)
    }));

    res.render('assets/list', { assets, search });
});

// New form
router.get('/new', (req, res) => {
    res.render('assets/form', { asset: {}, action: '/assets', method: 'POST' });
});

// Create
router.post('/', async (req, res) => {
    const {
        name,
        category,
        acquisition_type,
        supplier,
        finance_provider,
        serial_no,
        purchase_date,
        lease_start_date,
        lease_end_date,
        purchase_cost,
        down_payment,
        installment_amount,
        installment_period_months,
        months_paid,
        monthly_rental,
        current_value,
        location,
        status,
        notes
    } = req.body;

    const finalType = acquisition_type || 'Purchase';
    const finalStatus = status || (finalType === 'Lease' ? 'Leased' : finalType === 'Installment' ? 'Installment' : 'Active');

    await pool.query(
        `INSERT INTO assets (
      name, category, acquisition_type, supplier, finance_provider, serial_no,
      purchase_date, lease_start_date, lease_end_date, purchase_cost, down_payment,
      installment_amount, installment_period_months, months_paid, monthly_rental,
      current_value, location, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            name,
            category || 'Equipment',
            finalType,
            supplier || null,
            finance_provider || null,
            serial_no || null,
            purchase_date || null,
            lease_start_date || null,
            lease_end_date || null,
            purchase_cost || 0,
            down_payment || 0,
            installment_amount || 0,
            installment_period_months || 0,
            months_paid || 0,
            monthly_rental || 0,
            current_value || 0,
            location || null,
            finalStatus,
            notes || null
        ]
    );

    res.redirect('/assets');
});

// Edit form
router.get('/:id/edit', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM assets WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/assets');
    res.render('assets/form', {
        asset: rows[0],
        action: `/assets/${req.params.id}?_method=PUT`,
        method: 'POST'
    });
});

// Update
router.put('/:id', async (req, res) => {
    const {
        name,
        category,
        acquisition_type,
        supplier,
        finance_provider,
        serial_no,
        purchase_date,
        lease_start_date,
        lease_end_date,
        purchase_cost,
        down_payment,
        installment_amount,
        installment_period_months,
        months_paid,
        monthly_rental,
        current_value,
        location,
        status,
        notes
    } = req.body;

    const finalType = acquisition_type || 'Purchase';
    const finalStatus = status || (finalType === 'Lease' ? 'Leased' : finalType === 'Installment' ? 'Installment' : 'Active');

    await pool.query(
        `UPDATE assets
     SET name = ?, category = ?, acquisition_type = ?, supplier = ?, finance_provider = ?, serial_no = ?,
         purchase_date = ?, lease_start_date = ?, lease_end_date = ?, purchase_cost = ?, down_payment = ?,
         installment_amount = ?, installment_period_months = ?, months_paid = ?, monthly_rental = ?,
         current_value = ?, location = ?, status = ?, notes = ?
     WHERE id = ?`,
        [
            name,
            category || 'Equipment',
            finalType,
            supplier || null,
            finance_provider || null,
            serial_no || null,
            purchase_date || null,
            lease_start_date || null,
            lease_end_date || null,
            purchase_cost || 0,
            down_payment || 0,
            installment_amount || 0,
            installment_period_months || 0,
            months_paid || 0,
            monthly_rental || 0,
            current_value || 0,
            location || null,
            finalStatus,
            notes || null,
            req.params.id
        ]
    );

    res.redirect('/assets');
});

// Delete
router.delete('/:id', async (req, res) => {
    await pool.query('DELETE FROM assets WHERE id = ?', [req.params.id]);
    res.redirect('/assets');
});

module.exports = router;
