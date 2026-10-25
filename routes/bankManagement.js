const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
    const [accounts] = await pool.query(
        `SELECT * FROM bank_accounts ORDER BY name ASC`
    );

    const [[{ totalAccounts }]] = await pool.query('SELECT COUNT(*) AS totalAccounts FROM bank_accounts');
    const [[{ totalCheques }]] = await pool.query('SELECT COUNT(*) AS totalCheques FROM cheques');
    const [[{ totalFacilities }]] = await pool.query('SELECT COUNT(*) AS totalFacilities FROM bank_facilities');

    const [[{ totalAvailableBalance }]] = await pool.query(
        'SELECT COALESCE(SUM(current_balance), 0) AS totalAvailableBalance FROM bank_accounts'
    );

    const [[{ totalOutstandingFacilities }]] = await pool.query(
        'SELECT COALESCE(SUM(outstanding_amount), 0) AS totalOutstandingFacilities FROM bank_facilities WHERE status != ? OR status IS NULL',
        ['Closed']
    );

    const [pendingCheques] = await pool.query(
        `SELECT c.*, a.name AS account_name
     FROM cheques c
     LEFT JOIN bank_accounts a ON a.id = c.account_id
     WHERE c.status IN ('Pending', 'Deposited')
     ORDER BY c.issue_date DESC, c.id DESC
     OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`
    );

    const [facilitySummary] = await pool.query(
        `SELECT f.*, a.name AS account_name
     FROM bank_facilities f
     LEFT JOIN bank_accounts a ON a.id = f.account_id
     ORDER BY f.outstanding_amount DESC, f.id DESC
     OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`
    );

    const [recentTransactions] = await pool.query(
        `SELECT bt.*, ba.name AS account_name
     FROM bank_transactions bt
     LEFT JOIN bank_accounts ba ON ba.id = bt.account_id
     ORDER BY bt.transaction_date DESC, bt.id DESC
     OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`
    );

    res.render('bank-management', {
        accounts,
        totalAccounts,
        totalCheques,
        totalFacilities,
        totalAvailableBalance,
        totalOutstandingFacilities,
        pendingCheques,
        facilitySummary,
        recentTransactions
    });
});

module.exports = router;
