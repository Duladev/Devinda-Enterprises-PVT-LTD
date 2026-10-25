const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
  const [[{ totalProducts }]] = await pool.query('SELECT COUNT(*) AS totalProducts FROM products');
  const [[{ totalAssets }]] = await pool.query('SELECT COUNT(*) AS totalAssets FROM assets');
  const [[{ totalBuyers }]] = await pool.query('SELECT COUNT(*) AS totalBuyers FROM buyers');
  const [[{ totalSellers }]] = await pool.query('SELECT COUNT(*) AS totalSellers FROM sellers');
  const [[{ totalEmployees }]] = await pool.query('SELECT COUNT(*) AS totalEmployees FROM employees');
  const [[{ totalDirectors }]] = await pool.query('SELECT COUNT(*) AS totalDirectors FROM directors');
  const [[{ totalShareholders }]] = await pool.query('SELECT COUNT(*) AS totalShareholders FROM shareholders');

  const [[{ salesToday }]] = await pool.query(
    `SELECT COALESCE(SUM(total_amount),0) AS salesToday FROM sales WHERE sale_date = CAST(GETDATE() AS DATE)`
  );
  const [[{ salesThisMonth }]] = await pool.query(
    `SELECT COALESCE(SUM(total_amount),0) AS salesThisMonth FROM sales
    WHERE MONTH(sale_date) = MONTH(GETDATE()) AND YEAR(sale_date) = YEAR(GETDATE())`
  );
  const [[{ outstandingBalance, outstandingInvoices }]] = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN total_amount > paid_amount THEN total_amount - paid_amount ELSE 0 END), 0) AS outstandingBalance,
       COALESCE(SUM(CASE WHEN total_amount > paid_amount THEN 1 ELSE 0 END), 0) AS outstandingInvoices
     FROM sales`
  );
  const [[{ purchasesThisMonth }]] = await pool.query(
    `SELECT COALESCE(SUM(total_amount),0) AS purchasesThisMonth FROM purchases
    WHERE MONTH(purchase_date) = MONTH(GETDATE()) AND YEAR(purchase_date) = YEAR(GETDATE())`
  );

  const [lowStock] = await pool.query(
    `SELECT TOP 10 * FROM products WHERE current_stock <= reorder_level ORDER BY current_stock ASC`
  );

  const [recentSales] = await pool.query(
    `SELECT sa.*, b.name AS buyer_name FROM sales sa
     LEFT JOIN buyers b ON sa.buyer_id = b.id
    ORDER BY sa.created_at DESC OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY`
  );

  res.render('dashboard', {
    totalProducts, totalAssets, totalBuyers, totalSellers,
    totalEmployees, totalDirectors, totalShareholders,
    salesToday, salesThisMonth, outstandingBalance, outstandingInvoices, purchasesThisMonth,
    lowStock, recentSales
  });
});

module.exports = router;
