# Devinda Enterprises (PVT) LTD - Business Management System

A web app to manage your dry fish / fish trading business: sellers, buyers,
inventory, purchases, sales, and PDF invoice generation.

Built with **Node.js + Express + SQL Server + EJS**. Run locally or deploy to Vercel.

---

## 1. What you need installed first

1. **Node.js** (v18 or newer) — download from https://nodejs.org (choose the LTS version)
2. **SQL Server** (Express or Developer edition) and **SQL Server Management Studio (SSMS)**
   - During install, enable SQL Server authentication and set a password for the `sa` login.

Check they're installed by opening a terminal / command prompt and running:
```
node -v
sqlcmd -?
```

---

## 2. Set up the database

1. Open SSMS and connect to your SQL Server instance, for example `localhost` or `localhost\\SQLEXPRESS`.
2. Open `database/schema.sql`, select **Execute**, and let it create the `devinda_enterprises` database and tables.
3. In SSMS, make sure SQL Server Authentication is enabled if you use the `sa` login.

---

## 3. Configure the app

1. Copy `.env.example` to a new file named `.env`:
   ```
   cp .env.example .env
   ```
   (On Windows, just duplicate the file and rename it to `.env`)
2. Open `.env` in a text editor and fill in:
   - `DB_SERVER` = your SQL Server host or instance (for example `localhost\\SQLEXPRESS`)
   - `DB_USER` and `DB_PASSWORD` = your SQL Server login details
   - `COMPANY_NAME`, `COMPANY_ADDRESS`, `COMPANY_PHONE`, `COMPANY_EMAIL` — used on printed invoices

---

## 4. Install and run

In the project folder, run:
```
npm install
npm run seed
npm start
```

- `npm install` downloads all required packages (one-time, needs internet).
- `npm run seed` creates your first login user:
  - **Username:** `admin`
  - **Password:** `admin123`
  - (You can change this password later by editing `database/seed.js` and re-running `npm run seed`, or by adding a "change password" feature.)
- `npm start` starts the app.

Then open your browser and go to:
```
http://localhost:3000
```

To keep it running in the background on a shop PC, you can use a tool like
[pm2](https://www.npmjs.com/package/pm2) (`npm install -g pm2` then `pm2 start server.js`).

---

## 5. Using the system

- **Dashboard** — daily/monthly sales, outstanding balances, low stock alerts.
- **Sellers** — people/businesses you buy fish from.
- **Buyers** — customers you sell fish to.
- **Inventory (Products)** — add your dry fish / fresh fish items, set reorder levels,
  cost & selling prices. Stock updates automatically when you record a purchase or sale.
  You can also manually adjust stock (e.g. for spoilage) from the inventory page.
- **Purchases** — record stock coming IN from a seller. Increases inventory automatically.
- **Sales** — record stock going OUT to a buyer. Decreases inventory automatically and
  creates an invoice. Click the PDF icon to view/print/save the invoice with your logo.
- **Bank Management** — review account balances, recent transactions, cheques, and bank facilities.
- **Bank Accounts** — maintain current-account cashflow by recording deposits and payments
  with business categories, dates, references, and descriptions. Filter the ledger by
  period or transaction details, review period totals, and export a filtered account
  statement as CSV for reconciliation.

---

## 6. Accessing from other computers on your shop's WiFi/network

The app listens on all network interfaces by default. To use it from another
computer on the same Wi-Fi or wired network:

1. Start the app on the PC that will host it with `npm start` and keep it running.
2. On that PC, run `ipconfig` and find its IPv4 address for the active Wi-Fi or
   Ethernet adapter (for example, `192.168.1.10`).
3. Allow incoming TCP connections on port `3000` in that PC's firewall. Keep the
   network profile private; do not expose the port to public networks.
4. On the other computer, connected to the same network, open:
   ```
   http://192.168.1.10:3000
   ```

The host PC must remain on and connected to the network. The app uses the SQL
Server configured in `.env`, so that database must also be reachable from the
host PC. This setup is for a trusted local network, not access over the public
internet.

---

## 7. Deploy with GitHub and Vercel

1. Create a **private** GitHub repository named `devinda-enterprises` and push this project folder as its own repository. Do not push the parent Downloads folder.
2. In Vercel, import that GitHub repository. Set the project root to this folder; Vercel detects the Express app from `server.js`.
3. Create an Azure SQL Database (the free offer depends on account and region availability). Connect to that database in SSMS, then run `database/schema.sql`; if Azure SQL rejects the `CREATE DATABASE` or `USE` preamble, skip those initial statements because the database is already selected.
4. Add these Vercel environment variables: `DB_SERVER`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_ENCRYPT=true`, `DB_TRUST_SERVER_CERTIFICATE=false`, `SESSION_SECRET`, and `NODE_ENV=production`.
5. Configure Azure SQL firewall/network access to permit Vercel and your trusted setup machine. The current private `192.168.x.x` SQL Server cannot be reached from Vercel.
6. Create a **private** Vercel Blob store and connect it to the project. Transaction evidence is stored there, not on temporary serverless disk.
7. From a trusted machine with access to Azure SQL, seed once with unique `ADMIN_PASSWORD` and `SUPERADMIN_PASSWORD` environment values. Production seeding refuses the known default passwords.

The app stores production sessions in the SQL Server `app_sessions` table. Keep production secrets in Vercel's project environment settings; never commit `.env` or business evidence.

---

## 8. Backing up your data

Your data lives in SQL Server. In SSMS, right-click the `devinda_enterprises` database, choose **Tasks > Back Up**, and save a full backup (`.bak`).
From a query window, the equivalent backup command is:
```
BACKUP DATABASE devinda_enterprises TO DISK = 'C:\\Backups\\devinda_enterprises.bak' WITH INIT;
```
Keep the backup file somewhere safe — it contains your
entire business's records.

---

## 9. Folder structure

```
devinda-enterprises/
├── server.js              # App entry point
├── config/                # DB connection & helper functions
├── middleware/             # Login-required middleware
├── routes/                 # All business logic (sellers, buyers, products, purchases, sales, invoices)
├── views/                  # EJS page templates
├── public/                 # CSS, JS, and your logo
└── database/
    ├── schema.sql           # Run once to create the database
    └── seed.js               # Run once (npm run seed) to create the admin login
```

---

## Troubleshooting

- **"Login failed for user"** → check `DB_SERVER`, `DB_USER`, and `DB_PASSWORD` in `.env`, and confirm SQL Server Authentication is enabled.
- **"Invalid object name"** → execute `database/schema.sql` in SSMS first.
- **Port 3000 already in use** → change `PORT` in `.env` to something else, e.g. `3001`.
- **Logo not showing on invoices** → confirm `public/images/logo.png` exists.
