const express = require('express');
const router = express.Router();
const path = require('path');
const PDFDocument = require('pdfkit');
const pool = require('../config/db');

const COMPANY_NAME = process.env.COMPANY_NAME || 'Devinda Enterprises (PVT) LTD';
const COMPANY_ADDRESS = process.env.COMPANY_ADDRESS || '';
const COMPANY_EMAIL = process.env.COMPANY_EMAIL || '';
const COMPANY_PHONE = process.env.COMPANY_PHONE || '';
const COMPANY_REGISTRATION_NUMBER = process.env.COMPANY_REGISTRATION_NUMBER || '';
const LOGO_PATH = path.join(__dirname, '..', 'public', 'images', 'logo.png');

// GET /invoices/:saleId  -> streams a PDF invoice for a sale
router.get('/:saleId', async (req, res) => {
  const [saleRows] = await pool.query(
    `SELECT sa.*, b.name AS buyer_name, b.phone AS buyer_phone, b.address AS buyer_address
     FROM sales sa LEFT JOIN buyers b ON sa.buyer_id = b.id WHERE sa.id = ?`,
    [req.params.saleId]
  );
  if (saleRows.length === 0) return res.status(404).send('Invoice not found');
  const sale = saleRows[0];

  const [items] = await pool.query(
    `SELECT si.*, p.name AS product_name, p.unit FROM sale_items si
     JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`,
    [req.params.saleId]
  );

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=Invoice-${sale.invoice_no}.pdf`);
  doc.pipe(res);

  // ---- Header: logo + company info ----
  try {
    doc.image(LOGO_PATH, 50, 35, { width: 105 });
  } catch (e) {
    // logo missing - continue without it
  }
  //icon for company registration number, telephone, email, and address
  doc
    .fontSize(18)
    .fillColor('#0d2452')
    .text(COMPANY_NAME, 175, 50)
    .fontSize(9)
    .fillColor('#333333')
    .text(COMPANY_ADDRESS, 175, 72)
    .text(`Icon(mail): ${COMPANY_EMAIL}`, 175, 85)
    .text(`Icon(phone): ${COMPANY_PHONE}`, 175, 98)
    .text(`Reg. No: ${COMPANY_REGISTRATION_NUMBER}`, 175, 111);

  doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#0d2452').stroke();

  try {
    doc.opacity(0.07).image(LOGO_PATH, 155, 330, { width: 285 });
    doc.opacity(1);
  } catch (e) {
    // watermark is optional when the logo file is unavailable
  }

  // ---- Invoice title & meta ----
  doc
    .fontSize(16)
    .fillColor('#0d2452')
    .text('SALES INVOICE', 50, 135);

  doc
    .fontSize(10)
    .fillColor('#000000')
    .text(`Invoice No: ${sale.invoice_no}`, 400, 135, { align: 'right', width: 145 })
    .text(`Date: ${new Date(sale.sale_date).toLocaleDateString('en-GB')}`, 400, 150, { align: 'right', width: 145 })
    .text(`Payment: ${sale.payment_status}`, 400, 165, { align: 'right', width: 145 })
    .text(`Method: ${sale.payment_method || 'Cash'}`, 400, 180, { align: 'right', width: 145 });

  // ---- Buyer info ----
  doc
    .fontSize(11)
    .fillColor('#0d2452')
    .text('Bill To:', 50, 165);
  doc
    .fontSize(10)
    .fillColor('#000000')
    .text(sale.buyer_name || 'Walk-in Customer', 50, 180)
    .text(sale.buyer_phone || '', 50, 194)
    .text(sale.buyer_address || '', 50, 208);

  // ---- Items table ----
  let y = 250;
  doc.fontSize(10).fillColor('#ffffff');
  doc.rect(50, y, 495, 20).fill('#0d2452');
  doc.fillColor('#ffffff').text('Item', 58, y + 6);
  doc.text('Qty', 300, y + 6, { width: 60, align: 'right' });
  doc.text('Unit Price', 360, y + 6, { width: 90, align: 'right' });
  doc.text('Subtotal', 455, y + 6, { width: 82, align: 'right' });

  y += 20;
  doc.fillColor('#000000');
  items.forEach((item, i) => {
    const rowHeight = 20;
    if (i % 2 === 1) {
      doc.rect(50, y, 495, rowHeight).fill('#f2f4f8');
      doc.fillColor('#000000');
    }
    doc.fontSize(9.5);
    doc.text(`${item.product_name} (${item.unit})`, 58, y + 5, { width: 235 });
    doc.text(Number(item.quantity).toFixed(2), 300, y + 5, { width: 60, align: 'right' });
    doc.text(Number(item.unit_price).toFixed(2), 360, y + 5, { width: 90, align: 'right' });
    doc.text(Number(item.subtotal).toFixed(2), 455, y + 5, { width: 82, align: 'right' });
    y += rowHeight;
  });

  doc.moveTo(50, y).lineTo(545, y).strokeColor('#cccccc').stroke();
  y += 10;

  // ---- Totals ----
  const totalsX = 360;
  const discountAmount = Number(sale.discount_amount || 0);
  const subtotalAmount = Number(sale.total_amount || 0) + discountAmount;

  doc.fontSize(10);
  doc.text('Subtotal:', totalsX, y, { width: 90, align: 'right' });
  doc.text(`LKR ${subtotalAmount.toFixed(2)}`, 455, y, { width: 82, align: 'right' });
  y += 16;
  doc.text('Discount:', totalsX, y, { width: 90, align: 'right' });
  doc.text(`LKR ${discountAmount.toFixed(2)}`, 455, y, { width: 82, align: 'right' });
  y += 16;
  doc.text('Total Amount:', totalsX, y, { width: 90, align: 'right' });
  doc.text(`LKR ${Number(sale.total_amount).toFixed(2)}`, 455, y, { width: 82, align: 'right' });
  y += 16;
  doc.text('Paid Amount:', totalsX, y, { width: 90, align: 'right' });
  doc.text(`LKR ${Number(sale.paid_amount).toFixed(2)}`, 455, y, { width: 82, align: 'right' });
  y += 16;
  doc.fontSize(11).fillColor('#0d2452');
  doc.text('Balance Due:', totalsX, y, { width: 90, align: 'right' });
  doc.text(`LKR ${Number(sale.balance).toFixed(2)}`, 455, y, { width: 82, align: 'right' });

  // ---- Notes & footer ----
  y += 40;
  if (sale.notes) {
    doc.fontSize(9).fillColor('#333333').text(`Notes: ${sale.notes}`, 50, y, { width: 495 });
    y += 30;
  }

  doc
    .fontSize(9)
    .fillColor('#888888')
    .text('This is a computer-generated invoice and does not require a signature.Thank you for your business!', 50, 730, { align: 'center', width: 495, style: 'italic' });

  doc.end();
});

module.exports = router;
