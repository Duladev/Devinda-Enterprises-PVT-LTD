const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { generateDocNumber, adjustStock } = require('../config/helpers');

// List
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT sa.*, b.name AS buyer_name FROM sales sa
     LEFT JOIN buyers b ON sa.buyer_id = b.id
     ORDER BY sa.sale_date DESC, sa.id DESC`
  );
  res.render('sales/list', { sales: rows });
});

// New form
router.get('/new', async (req, res) => {
  const [buyers] = await pool.query('SELECT * FROM buyers ORDER BY name ASC');
  const [products] = await pool.query('SELECT * FROM products ORDER BY name ASC');
  res.render('sales/form', { buyers, products, today: new Date().toISOString().slice(0, 10) });
});

// Create
router.post('/', async (req, res) => {
  const { buyer_id, sale_date, paid_amount, payment_method, notes, discount_amount } = req.body;
  let { product_id, quantity, unit_price } = req.body;

  if (!Array.isArray(product_id)) product_id = [product_id];
  if (!Array.isArray(quantity)) quantity = [quantity];
  if (!Array.isArray(unit_price)) unit_price = [unit_price];

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const invoiceNo = await generateDocNumber('INV', 'sales', 'invoice_no');

    let grossTotal = 0;
    const items = [];
    for (let i = 0; i < product_id.length; i++) {
      if (!product_id[i] || !quantity[i]) continue;
      const qty = parseFloat(quantity[i]);
      const price = parseFloat(unit_price[i]);
      const subtotal = qty * price;
      grossTotal += subtotal;
      items.push({ product_id: product_id[i], quantity: qty, unit_price: price, subtotal });
    }

    const discount = Math.max(parseFloat(discount_amount) || 0, 0);
    const totalAmount = Math.max(grossTotal - discount, 0);
    const paid = parseFloat(paid_amount) || 0;
    const balance = totalAmount - paid;
    let paymentStatus = 'Unpaid';
    if (paid >= totalAmount && totalAmount > 0) paymentStatus = 'Paid';
    else if (paid > 0) paymentStatus = 'Partial';

    const [result] = await connection.query(
      `INSERT INTO sales (invoice_no, buyer_id, sale_date, total_amount, discount_amount, paid_amount, balance, payment_method, payment_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoiceNo, buyer_id || null, sale_date, totalAmount, discount, paid, balance, payment_method || 'Cash', paymentStatus, notes]
    );
    const saleId = result.insertId;

    for (const item of items) {
      await connection.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [saleId, item.product_id, item.quantity, item.unit_price, item.subtotal]
      );
      await adjustStock(connection, item.product_id, 'OUT', item.quantity, 'SALE', saleId);
    }

    await connection.commit();
    res.redirect(`/sales/${saleId}`);
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).send('Error creating sale: ' + err.message);
  } finally {
    connection.release();
  }
});

// View one sale / invoice preview
router.get('/:id', async (req, res) => {
  const [saleRows] = await pool.query(
    `SELECT sa.*, b.name AS buyer_name, b.phone AS buyer_phone, b.email AS buyer_email, b.address AS buyer_address
     FROM sales sa LEFT JOIN buyers b ON sa.buyer_id = b.id WHERE sa.id = ?`,
    [req.params.id]
  );
  if (saleRows.length === 0) return res.redirect('/sales');
  const [items] = await pool.query(
    `SELECT si.*, p.name AS product_name, p.unit FROM sale_items si
     JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`,
    [req.params.id]
  );
  res.render('sales/view', { sale: saleRows[0], items, appUrl: `${req.protocol}://${req.get('host')}` });
});

// Delete a sale (reverses stock back in)
router.delete('/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [items] = await connection.query('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);
    for (const item of items) {
      await adjustStock(connection, item.product_id, 'IN', item.quantity, 'SALE_DELETE', req.params.id);
    }
    await connection.query('DELETE FROM sales WHERE id = ?', [req.params.id]);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    console.error(err);
  } finally {
    connection.release();
  }
  res.redirect('/sales');
});

module.exports = router;
