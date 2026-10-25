const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const path = require('path');
const pool = require('../config/db');
const { generateDocNumber, adjustStock } = require('../config/helpers');

const COMPANY_NAME = process.env.COMPANY_NAME || 'Devinda Enterprises (PVT) LTD';
const COMPANY_ADDRESS = process.env.COMPANY_ADDRESS || '';
const COMPANY_PHONE = process.env.COMPANY_PHONE || '';
const COMPANY_EMAIL = process.env.COMPANY_EMAIL || '';
const LOGO_PATH = path.join(__dirname, '..', 'public', 'images', 'logo.png');

// List
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.*, s.name AS seller_name FROM purchases p
     LEFT JOIN sellers s ON p.seller_id = s.id
     ORDER BY p.purchase_date DESC, p.id DESC`
  );
  res.render('purchases/list', { purchases: rows });
});

// New form
router.get('/new', async (req, res) => {
  const [sellers] = await pool.query('SELECT * FROM sellers ORDER BY name ASC');
  const [products] = await pool.query('SELECT * FROM products ORDER BY name ASC');
  res.render('purchases/form', { sellers, products, today: new Date().toISOString().slice(0, 10) });
});

// Create
router.post('/', async (req, res) => {
  const { seller_id, purchase_date, paid_amount, payment_method, notes, discount_amount } = req.body;
  let { product_id, quantity, unit_price } = req.body;

  // Normalize to arrays (in case only one item was submitted)
  if (!Array.isArray(product_id)) product_id = [product_id];
  if (!Array.isArray(quantity)) quantity = [quantity];
  if (!Array.isArray(unit_price)) unit_price = [unit_price];

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const purchaseNo = await generateDocNumber('PUR', 'purchases', 'purchase_no');

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

    const [result] = await connection.query(
      `INSERT INTO purchases (purchase_no, seller_id, purchase_date, total_amount, discount_amount, paid_amount, balance, payment_method, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [purchaseNo, seller_id || null, purchase_date, totalAmount, discount, paid, balance, payment_method || 'Cash', notes]
    );
    const purchaseId = result.insertId;

    for (const item of items) {
      await connection.query(
        `INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [purchaseId, item.product_id, item.quantity, item.unit_price, item.subtotal]
      );
      await adjustStock(connection, item.product_id, 'IN', item.quantity, 'PURCHASE', purchaseId);
    }

    await connection.commit();
    res.redirect(`/purchases/${purchaseId}`);
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).send('Error creating purchase: ' + err.message);
  } finally {
    connection.release();
  }
});

// Printable purchase order for sending to the seller.
router.get('/:id/pdf', async (req, res) => {
  const [purchaseRows] = await pool.query(
    `SELECT p.*, s.name AS seller_name, s.phone AS seller_phone, s.email AS seller_email, s.address AS seller_address
     FROM purchases p LEFT JOIN sellers s ON p.seller_id = s.id WHERE p.id = ?`, [req.params.id]
  );
  if (purchaseRows.length === 0) return res.status(404).send('Purchase order not found');
  const purchase = purchaseRows[0];
  const [items] = await pool.query(
    `SELECT pi.*, pr.name AS product_name, pr.unit FROM purchase_items pi
     JOIN products pr ON pi.product_id = pr.id WHERE pi.purchase_id = ?`, [req.params.id]
  );
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=Purchase-Order-${purchase.purchase_no}.pdf`);
  doc.pipe(res);
  try { doc.image(LOGO_PATH, 50, 45, { width: 70 }); } catch (e) { /* optional logo */ }
  doc.fontSize(18).fillColor('#0d2452').text(COMPANY_NAME, 140, 50)
    .fontSize(9).fillColor('#333333').text(COMPANY_ADDRESS, 140, 72)
    .text(`${COMPANY_PHONE}   ${COMPANY_EMAIL}`, 140, 86);
  doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#0d2452').stroke();
  try {
    doc.opacity(0.07).image(LOGO_PATH, 155, 330, { width: 285 });
    doc.opacity(1);
  } catch (e) {
    // watermark is optional when the logo file is unavailable
  }
  doc.fontSize(16).fillColor('#0d2452').text('PURCHASE ORDER', 50, 135)
    .fontSize(10).fillColor('#000000')
    .text(`Order No: ${purchase.purchase_no}`, 400, 135, { align: 'right', width: 145 })
    .text(`Date: ${new Date(purchase.purchase_date).toLocaleDateString('en-GB')}`, 400, 150, { align: 'right', width: 145 });
  doc.fontSize(11).fillColor('#0d2452').text('Supplier:', 50, 165)
    .fontSize(10).fillColor('#000000').text(purchase.seller_name || 'Supplier', 50, 180)
    .text(purchase.seller_phone || '', 50, 194).text(purchase.seller_address || '', 50, 208);
  let y = 250;
  doc.fontSize(10).fillColor('#ffffff').rect(50, y, 495, 20).fill('#0d2452');
  doc.fillColor('#ffffff').text('Item', 58, y + 6).text('Qty', 300, y + 6, { width: 60, align: 'right' })
    .text('Unit Price', 360, y + 6, { width: 90, align: 'right' }).text('Subtotal', 455, y + 6, { width: 82, align: 'right' });
  y += 20; doc.fillColor('#000000');
  items.forEach((item, index) => {
    if (index % 2 === 1) { doc.rect(50, y, 495, 20).fill('#f2f4f8'); doc.fillColor('#000000'); }
    doc.fontSize(9.5).text(`${item.product_name} (${item.unit})`, 58, y + 5, { width: 235 })
      .text(Number(item.quantity).toFixed(2), 300, y + 5, { width: 60, align: 'right' })
      .text(Number(item.unit_price).toFixed(2), 360, y + 5, { width: 90, align: 'right' })
      .text(Number(item.subtotal).toFixed(2), 455, y + 5, { width: 82, align: 'right' });
    y += 20;
  });
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#cccccc').stroke(); y += 10;
  doc.fontSize(10).text('Total Amount:', 360, y, { width: 90, align: 'right' })
    .text(`LKR ${Number(purchase.total_amount).toFixed(2)}`, 455, y, { width: 82, align: 'right' });
  y += 16; doc.text('Payment Method:', 360, y, { width: 90, align: 'right' })
    .text(purchase.payment_method || 'Cash', 455, y, { width: 82, align: 'right' });
  if (purchase.notes) doc.fontSize(9).fillColor('#333333').text(`Notes: ${purchase.notes}`, 50, y + 35, { width: 495 });
  doc.fontSize(9).fillColor('#888888').text('Thank you for your business!', 50, 730, { align: 'center', width: 495 });
  doc.end();
});

// View one purchase
router.get('/:id', async (req, res) => {
  const [purchaseRows] = await pool.query(
    `SELECT p.*, s.name AS seller_name, s.phone AS seller_phone, s.email AS seller_email, s.address AS seller_address
     FROM purchases p LEFT JOIN sellers s ON p.seller_id = s.id WHERE p.id = ?`,
    [req.params.id]
  );
  if (purchaseRows.length === 0) return res.redirect('/purchases');
  const [items] = await pool.query(
    `SELECT pi.*, pr.name AS product_name, pr.unit FROM purchase_items pi
     JOIN products pr ON pi.product_id = pr.id WHERE pi.purchase_id = ?`,
    [req.params.id]
  );
  res.render('purchases/view', { purchase: purchaseRows[0], items, appUrl: `${req.protocol}://${req.get('host')}` });
});

// Delete a purchase (reverses stock)
router.delete('/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [items] = await connection.query('SELECT * FROM purchase_items WHERE purchase_id = ?', [req.params.id]);
    for (const item of items) {
      await adjustStock(connection, item.product_id, 'OUT', item.quantity, 'PURCHASE_DELETE', req.params.id);
    }
    await connection.query('DELETE FROM purchases WHERE id = ?', [req.params.id]);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    console.error(err);
  } finally {
    connection.release();
  }
  res.redirect('/purchases');
});

module.exports = router;
