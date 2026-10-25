require('dotenv').config();
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');

const { requireLogin, requireSuperAdmin } = require('./middleware/auth');
const SqlSessionStore = require('./config/session-store');

const app = express();
const sessionSecret = process.env.SESSION_SECRET || (process.env.VERCEL ? '' : 'devinda_secret');
if (!sessionSecret) throw new Error('Set SESSION_SECRET in the Vercel project environment.');
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: sessionSecret,
  store: process.env.VERCEL ? new SqlSessionStore() : undefined,
  proxy: Boolean(process.env.VERCEL),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8,
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(process.env.VERCEL)
  }
}));

// Make current user + company name available in all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.fullName || null;
  res.locals.currentUserRole = req.session.role || 'admin';
  res.locals.isSuperAdmin = Boolean(req.session.isSuperAdmin);
  res.locals.companyName = process.env.COMPANY_NAME || 'Devinda Enterprises (PVT) LTD';
  res.locals.currentPath = req.path;
  next();
});

// ---- Public routes ----
app.use('/', require('./routes/auth'));

// ---- Protected routes ----
app.use('/', requireLogin, require('./routes/dashboard'));
app.use('/sellers', requireLogin, require('./routes/sellers'));
app.use('/buyers', requireLogin, require('./routes/buyers'));
app.use('/products', requireLogin, require('./routes/products'));
app.use('/employees', requireLogin, requireSuperAdmin, require('./routes/employees'));
app.use('/directors', requireLogin, requireSuperAdmin, require('./routes/directors'));
app.use('/shareholders', requireLogin, requireSuperAdmin, require('./routes/shareholders'));
app.use('/assets', requireLogin, require('./routes/assets'));
app.use('/bank-management', requireLogin, require('./routes/bankManagement'));
app.use('/bank-accounts', requireLogin, require('./routes/bankAccounts'));
app.use('/cheques', requireLogin, require('./routes/cheques'));
app.use('/bank-facilities', requireLogin, require('./routes/bankFacilities'));
app.use('/purchases', requireLogin, require('./routes/purchases'));
app.use('/sales', requireLogin, require('./routes/sales'));
app.use('/invoices', requireLogin, require('./routes/invoices'));

// 404
app.use((req, res) => {
  res.status(404).send('Page not found');
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Devinda Enterprises system listening on ${HOST}:${PORT}`);
    console.log(`On this PC, open http://localhost:${PORT}`);
  });
}

module.exports = app;
