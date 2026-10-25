const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const multer = require('multer');
const { get, put, del } = require('@vercel/blob');
const pool = require('../config/db');

const evidenceDirectory = path.join(__dirname, '..', 'storage', 'bank-transaction-evidence');
const isVercel = Boolean(process.env.VERCEL);
if (!isVercel) fs.mkdirSync(evidenceDirectory, { recursive: true });

const allowedEvidenceTypes = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
};

const evidenceUpload = multer({
    storage: isVercel ? multer.memoryStorage() : multer.diskStorage({
        destination: evidenceDirectory,
        filename: (req, file, callback) => callback(null, `${randomUUID()}${allowedEvidenceTypes[file.mimetype] || ''}`)
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => {
        if (!allowedEvidenceTypes[file.mimetype]) return callback(new Error('Unsupported evidence file type'));
        callback(null, true);
    }
});

function handleEvidenceUpload(req, res, next) {
    evidenceUpload.single('evidence')(req, res, error => {
        if (error) {
            const code = error.code === 'LIMIT_FILE_SIZE' ? 'evidence_too_large' : 'invalid_evidence';
            return res.redirect(`/bank-accounts/${encodeURIComponent(req.params.id)}?error=${code}`);
        }
        next();
    });
}

function removeEvidence(file) {
    if (file?.path) fs.promises.unlink(file.path).catch(error => {
        if (error.code !== 'ENOENT') console.error('Failed to remove transaction evidence:', error);
    });
}

async function saveEvidence(file) {
    if (!file) return null;
    if (isVercel) {
        const pathname = `bank-transaction-evidence/${randomUUID()}${allowedEvidenceTypes[file.mimetype]}`;
        const blob = await put(pathname, file.buffer, {
            access: 'private',
            contentType: file.mimetype
        });
        return blob.pathname;
    }
    return file.filename;
}

async function removeStoredEvidence(file, pathname) {
    if (isVercel && pathname) {
        try {
            await del(pathname, { access: 'private' });
        } catch (error) {
            console.error('Failed to remove transaction evidence from Blob:', error);
        }
    }
    removeEvidence(file);
}

async function hasValidEvidenceSignature(file) {
    const handle = file.buffer ? null : await fs.promises.open(file.path, 'r');
    try {
        const header = Buffer.alloc(12);
        const bytesRead = file.buffer
            ? file.buffer.copy(header, 0, 0, header.length)
            : (await handle.read(header, 0, header.length, 0)).bytesRead;
        const bytes = header.subarray(0, bytesRead);
        switch (file.mimetype) {
            case 'application/pdf': return bytes.subarray(0, 5).toString() === '%PDF-';
            case 'image/jpeg': return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
            case 'image/png': return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
            case 'image/webp': return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
            case 'image/gif': return ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString());
            default: return false;
        }
    } finally {
        if (handle) await handle.close();
    }
}

const TRANSACTION_CATEGORIES = [
    'Sales',
    'Purchase',
    'Expense',
    'Transfer',
    'Bank Charges',
    'Tax',
    'Payroll',
    'Capital',
    'General'
];
const PAGE_SIZE = 25;

function getFilters(query) {
    const filters = {
        from_date: typeof query.from_date === 'string' ? query.from_date : '',
        to_date: typeof query.to_date === 'string' ? query.to_date : '',
        type: typeof query.type === 'string' ? query.type : '',
        category: typeof query.category === 'string' ? query.category : '',
        q: typeof query.q === 'string' ? query.q.trim() : ''
    };
    const conditions = [];
    const values = [];

    if (filters.from_date) {
        conditions.push('transaction_date >= ?');
        values.push(filters.from_date);
    }
    if (filters.to_date) {
        conditions.push('transaction_date <= ?');
        values.push(filters.to_date);
    }
    if (filters.type === 'IN' || filters.type === 'OUT') {
        conditions.push('type = ?');
        values.push(filters.type);
    }
    if (TRANSACTION_CATEGORIES.includes(filters.category)) {
        conditions.push('category = ?');
        values.push(filters.category);
    }
    if (filters.q) {
        conditions.push('(reference_no LIKE ? OR description LIKE ?)');
        values.push(`%${filters.q}%`, `%${filters.q}%`);
    }

    return {
        filters,
        where: conditions.length ? ` AND ${conditions.join(' AND ')}` : '',
        values
    };
}

function isValidDate(value) {
    if (value == null || value === '') return true;
    if (typeof value !== 'string') return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidDateRange(filters) {
    return isValidDate(filters.from_date) &&
        isValidDate(filters.to_date) &&
        (!filters.from_date || !filters.to_date || filters.from_date <= filters.to_date);
}

function csvCell(value) {
    let text = value == null ? '' : String(value);
    if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}

async function getAccountTransactions(accountId, query, includeAll = false) {
    const { filters, where, values } = getFilters(query);
    const [summaryRows] = await pool.query(
        `SELECT COUNT(*) AS totalTransactions,
                COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0) AS totalDeposits,
                COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) AS totalPayments
         FROM bank_transactions
         WHERE account_id = ?${where}`,
        [accountId, ...values]
    );

    const totalTransactions = Number(summaryRows[0].totalTransactions || 0);
    const pageCount = Math.max(1, Math.ceil(totalTransactions / PAGE_SIZE));
    const page = Math.min(Math.max(parseInt(query.page, 10) || 1, 1), pageCount);
    const [transactions] = await pool.query(
        `SELECT * FROM bank_transactions
         WHERE account_id = ?${where}
         ORDER BY transaction_date DESC, id DESC${includeAll ? '' : ' OFFSET ? ROWS FETCH NEXT ? ROWS ONLY'}`,
        includeAll
            ? [accountId, ...values]
            : [accountId, ...values, (page - 1) * PAGE_SIZE, PAGE_SIZE]
    );

    return { filters, summary: summaryRows[0], transactions, page, pageCount };
}

router.get('/', async (req, res) => {
    const search = typeof req.query.q === 'string' ? req.query.q : '';
    const [accounts] = await pool.query(
        `SELECT * FROM bank_accounts
         WHERE name LIKE ? OR bank_name LIKE ? OR account_number LIKE ? OR branch LIKE ?
         ORDER BY name ASC`,
        [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
    );
    res.render('bank-accounts/list', { accounts, search });
});

router.get('/new', (req, res) => {
    res.render('bank-accounts/form', { account: {}, action: '/bank-accounts', method: 'POST' });
});

router.post('/', async (req, res) => {
    const {
        name,
        bank_name,
        account_number,
        branch,
        account_type,
        opening_balance,
        notes
    } = req.body;

    const finalName = name || 'BOC Current Account';
    const finalBankName = bank_name || 'Bank of Ceylon';
    const finalAccountType = account_type || 'Current';
    const amount = Number(opening_balance || 0);

    await pool.query(
        `INSERT INTO bank_accounts (name, bank_name, account_number, branch, account_type, opening_balance, current_balance, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [finalName, finalBankName, account_number || null, branch || null, finalAccountType, amount, amount, notes || null]
    );

    res.redirect('/bank-accounts');
});

router.get('/:id/export.csv', async (req, res) => {
    const [accountRows] = await pool.query('SELECT id, name FROM bank_accounts WHERE id = ?', [req.params.id]);
    if (accountRows.length === 0) return res.redirect('/bank-accounts');

    const { filters } = getFilters(req.query);
    if (!isValidDateRange(filters)) {
        return res.status(400).send('Use a valid date range in YYYY-MM-DD format.');
    }
    const { transactions } = await getAccountTransactions(req.params.id, req.query, true);

    const rows = [
        ['Date', 'Type', 'Method', 'Bank', 'Account / Cheque', 'Category', 'Reference', 'Description', 'Amount (LKR)', 'Balance after (LKR)', 'Evidence'],
        ...transactions.map(tx => [
            tx.transaction_date ? new Date(tx.transaction_date).toISOString().slice(0, 10) : '',
            tx.type === 'IN' ? 'Deposit' : 'Payment',
            tx.payment_method || 'Cash',
            tx.transfer_bank_name || '',
            tx.payment_method === 'Bank Transfer'
                ? `${tx.transfer_account_name || ''} ${tx.transfer_account_number || ''}`.trim()
                : tx.payment_method === 'Cheque'
                    ? `${tx.cheque_number || ''} ${tx.cheque_payee || ''}`.trim()
                    : '',
            tx.category,
            tx.reference_no,
            tx.description,
            Number(tx.amount || 0).toFixed(2),
            Number(tx.balance_after || 0).toFixed(2),
            tx.evidence_original_name || ''
        ])
    ];
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bank-account-${accountRows[0].id}-statement.csv"`);
    res.send(`\uFEFF${csv}`);
});

router.get('/:id', async (req, res) => {
    const [accountRows] = await pool.query('SELECT * FROM bank_accounts WHERE id = ?', [req.params.id]);
    if (accountRows.length === 0) return res.redirect('/bank-accounts');
    const account = accountRows[0];
    const { filters: requestedFilters } = getFilters(req.query);
    if (!isValidDateRange(requestedFilters)) {
        return res.status(400).send('Use a valid date range in YYYY-MM-DD format.');
    }

    const { filters, summary, transactions, page, pageCount } =
        await getAccountTransactions(req.params.id, req.query);
    filters.page = page;

    const queryValues = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (key !== 'page' && value) queryValues.set(key, value);
    }

    res.render('bank-accounts/view', {
        account,
        transactions,
        filters,
        summary: {
            ...summary,
            totalDeposits: Number(summary.totalDeposits || 0),
            totalPayments: Number(summary.totalPayments || 0),
            netCashflow: Number(summary.totalDeposits || 0) - Number(summary.totalPayments || 0)
        },
        pageCount,
        paginationQuery: queryValues.toString(),
        transactionCategories: TRANSACTION_CATEGORIES,
        error: ({
            invalid_transaction: 'Enter a valid date, transaction type, category, payment method, and positive amount. Complete the required bank or cheque details.',
            invalid_evidence: 'Attach a PDF or image file (JPG, PNG, WEBP, or GIF).',
            evidence_too_large: 'Evidence files must be 10 MB or smaller.'
        })[req.query.error] || ''
    });
});

router.get('/:id/transactions/:transactionId/evidence', async (req, res) => {
    const [rows] = await pool.query(
        `SELECT evidence_filename, evidence_original_name, evidence_mime
         FROM bank_transactions WHERE id = ? AND account_id = ?`,
        [req.params.transactionId, req.params.id]
    );
    if (rows.length === 0 || !rows[0].evidence_filename) return res.status(404).send('Evidence not found.');

    const originalName = path.basename(rows[0].evidence_original_name || rows[0].evidence_filename);
    res.type(rows[0].evidence_mime || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${originalName.replace(/["\\\r\n]/g, '_')}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    if (isVercel) {
        const blob = await get(rows[0].evidence_filename, { access: 'private' });
        if (!blob) return res.status(404).send('Evidence file is unavailable.');
        res.type(blob.blob.contentType || rows[0].evidence_mime || 'application/octet-stream');
        return require('node:stream').Readable.fromWeb(blob.stream).pipe(res);
    }

    const filename = path.basename(rows[0].evidence_filename);
    const filePath = path.join(evidenceDirectory, filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('Evidence file is unavailable.');
    res.sendFile(filePath);
});

router.post('/:id/transactions', handleEvidenceUpload, async (req, res) => {
    const {
        transaction_date, type, category, payment_method, reference_no, description, amount,
        transfer_bank_name, transfer_account_name, transfer_account_number, transfer_branch,
        cheque_number, cheque_date, cheque_payee
    } = req.body;
    const value = Number(amount);
    const validType = type === 'DEPOSIT' || type === 'WITHDRAWAL';
    const validCategory = TRANSACTION_CATEGORIES.includes(category);
    const validPaymentMethod = ['Cash', 'Bank Transfer', 'Cheque', 'Card', 'Other'].includes(payment_method);
    const validAmount = Number.isFinite(value) && value > 0 && value <= 999999999999.99;
    const validReference = reference_no == null || reference_no === '' ||
        (typeof reference_no === 'string' && reference_no.length <= 100);
    const validDescription = description == null || description === '' ||
        (typeof description === 'string' && description.length <= 255);
    const validTransferDetails = payment_method !== 'Bank Transfer' || (
        typeof transfer_bank_name === 'string' && transfer_bank_name.trim().length > 0 && transfer_bank_name.length <= 150 &&
        typeof transfer_account_name === 'string' && transfer_account_name.trim().length > 0 && transfer_account_name.length <= 150 &&
        typeof transfer_account_number === 'string' && transfer_account_number.trim().length > 0 && transfer_account_number.length <= 100 &&
        (transfer_branch == null || transfer_branch.length <= 150)
    );
    const validChequeDetails = payment_method !== 'Cheque' || (
        typeof cheque_number === 'string' && cheque_number.trim().length > 0 && cheque_number.length <= 50 &&
        typeof transfer_bank_name === 'string' && transfer_bank_name.trim().length > 0 && transfer_bank_name.length <= 150 &&
        typeof cheque_payee === 'string' && cheque_payee.trim().length > 0 && cheque_payee.length <= 150 &&
        isValidDate(cheque_date) && Boolean(cheque_date)
    );

    if (!validType || !validCategory || !validPaymentMethod || !validAmount || !validReference || !validDescription ||
        !validTransferDetails || !validChequeDetails || !isValidDate(transaction_date)) {
        removeEvidence(req.file);
        return res.redirect(`/bank-accounts/${encodeURIComponent(req.params.id)}?error=invalid_transaction`);
    }
    if (req.file && !(await hasValidEvidenceSignature(req.file))) {
        removeEvidence(req.file);
        return res.redirect(`/bank-accounts/${encodeURIComponent(req.params.id)}?error=invalid_evidence`);
    }

    let connection;
    let transactionStarted = false;
    let storedEvidencePath = null;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [accountRows] = await connection.query(
            'SELECT current_balance FROM bank_accounts WITH (UPDLOCK, ROWLOCK) WHERE id = ?',
            [req.params.id]
        );

        if (accountRows.length === 0) {
            await connection.rollback();
            transactionStarted = false;
            removeEvidence(req.file);
            return res.redirect('/bank-accounts');
        }

        storedEvidencePath = await saveEvidence(req.file);
        const currentBalance = Number(accountRows[0].current_balance || 0);
        const transactionType = type === 'WITHDRAWAL' ? 'OUT' : 'IN';
        const newBalance = currentBalance + (transactionType === 'OUT' ? -value : value);

        await connection.query(
            `INSERT INTO bank_transactions (
                account_id, transaction_date, type, category, payment_method, reference_no, description,
                transfer_bank_name, transfer_account_name, transfer_account_number, transfer_branch,
                cheque_number, cheque_date, cheque_payee, evidence_filename, evidence_original_name,
                evidence_mime, amount, balance_after
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.params.id,
                transaction_date || new Date().toISOString().slice(0, 10),
                transactionType,
                category,
                payment_method,
                reference_no || null,
                description || 'Bank transaction',
                payment_method === 'Bank Transfer' || payment_method === 'Cheque' ? transfer_bank_name.trim() : null,
                payment_method === 'Bank Transfer' ? transfer_account_name.trim() : null,
                payment_method === 'Bank Transfer' ? transfer_account_number.trim() : null,
                payment_method === 'Bank Transfer' ? (transfer_branch.trim() || null) : null,
                payment_method === 'Cheque' ? cheque_number.trim() : null,
                payment_method === 'Cheque' ? cheque_date : null,
                payment_method === 'Cheque' ? cheque_payee.trim() : null,
                storedEvidencePath,
                req.file ? req.file.originalname.slice(0, 255) : null,
                req.file?.mimetype || null,
                value,
                newBalance
            ]
        );
        await connection.query(
            'UPDATE bank_accounts SET current_balance = ? WHERE id = ?',
            [newBalance, req.params.id]
        );

        await connection.commit();
        transactionStarted = false;
    } catch (err) {
        if (transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Failed to roll back bank transaction:', rollbackError);
            }
        }
        console.error('Failed to save bank transaction:', err);
        await removeStoredEvidence(req.file, storedEvidencePath);
        return res.status(500).send('Unable to save the bank transaction. Please try again.');
    } finally {
        if (connection) connection.release();
    }

    res.redirect(`/bank-accounts/${req.params.id}`);
});

router.get('/:id/edit', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM bank_accounts WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/bank-accounts');
    res.render('bank-accounts/form', {
        account: rows[0],
        action: `/bank-accounts/${req.params.id}?_method=PUT`,
        method: 'POST'
    });
});

router.put('/:id', async (req, res) => {
    const {
        name,
        bank_name,
        account_number,
        branch,
        account_type,
        opening_balance,
        notes
    } = req.body;

    await pool.query(
        `UPDATE bank_accounts
         SET name = ?, bank_name = ?, account_number = ?, branch = ?, account_type = ?, opening_balance = ?, notes = ?
         WHERE id = ?`,
        [
            name || 'BOC Current Account',
            bank_name || 'Bank of Ceylon',
            account_number || null,
            branch || null,
            account_type || 'Current',
            Number(opening_balance || 0),
            notes || null,
            req.params.id
        ]
    );

    res.redirect('/bank-accounts');
});

router.delete('/:id', async (req, res) => {
    await pool.query('DELETE FROM bank_accounts WHERE id = ?', [req.params.id]);
    res.redirect('/bank-accounts');
});

module.exports = router;
