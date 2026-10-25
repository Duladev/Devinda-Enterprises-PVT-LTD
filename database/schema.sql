-- Devinda Enterprises (PVT) LTD - SQL Server schema
-- Run this script in SQL Server Management Studio.

IF DB_ID(N'devinda_enterprises') IS NULL
    CREATE DATABASE devinda_enterprises;
GO

USE devinda_enterprises;
GO

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
      id INT IDENTITY(1,1) PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(100) NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin')),
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.app_sessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_sessions (
      session_id VARCHAR(255) NOT NULL PRIMARY KEY,
      session_data NVARCHAR(MAX) NOT NULL,
      expires_at DATETIME2 NOT NULL
    );
    CREATE INDEX IX_app_sessions_expires_at ON dbo.app_sessions (expires_at);
END
GO

IF COL_LENGTH('dbo.users', 'role') IS NULL
    ALTER TABLE dbo.users ADD role VARCHAR(20) NOT NULL CONSTRAINT DF_users_role DEFAULT 'admin';
GO

IF OBJECT_ID(N'dbo.sellers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sellers (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(30) NULL,
      email VARCHAR(150) NULL,
      address VARCHAR(255) NULL,
      nic VARCHAR(30) NULL,
      notes VARCHAR(MAX) NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.buyers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.buyers (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(30) NULL,
      email VARCHAR(150) NULL,
      address VARCHAR(255) NULL,
      nic VARCHAR(30) NULL,
      notes VARCHAR(MAX) NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.products', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.products (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      category VARCHAR(20) NOT NULL DEFAULT 'Dry Fish' CHECK (category IN ('Dry Fish', 'Fresh Fish', 'Other')),
      unit VARCHAR(20) NOT NULL DEFAULT 'kg',
      current_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
      reorder_level DECIMAL(12,2) NOT NULL DEFAULT 0,
      cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.assets', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.assets (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'Equipment' CHECK (category IN ('Equipment', 'Vehicle', 'Furniture', 'Office', 'Other')),
      acquisition_type VARCHAR(30) NOT NULL DEFAULT 'Purchase' CHECK (acquisition_type IN ('Purchase', 'Lease', 'Installment')),
      supplier VARCHAR(150) NULL,
      finance_provider VARCHAR(150) NULL,
      serial_no VARCHAR(100) NULL,
      purchase_date DATE NULL,
      lease_start_date DATE NULL,
      lease_end_date DATE NULL,
      purchase_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
      down_payment DECIMAL(14,2) NOT NULL DEFAULT 0,
      installment_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      installment_period_months INT NOT NULL DEFAULT 0,
      months_paid INT NOT NULL DEFAULT 0,
      monthly_rental DECIMAL(14,2) NOT NULL DEFAULT 0,
      current_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      location VARCHAR(150) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Maintenance', 'Disposed', 'Lost', 'Leased', 'Installment')),
      notes VARCHAR(MAX) NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

IF COL_LENGTH('dbo.assets', 'acquisition_type') IS NULL ALTER TABLE dbo.assets ADD acquisition_type VARCHAR(30) NOT NULL CONSTRAINT DF_assets_acquisition_type DEFAULT 'Purchase';
IF COL_LENGTH('dbo.assets', 'supplier') IS NULL ALTER TABLE dbo.assets ADD supplier VARCHAR(150) NULL;
IF COL_LENGTH('dbo.assets', 'finance_provider') IS NULL ALTER TABLE dbo.assets ADD finance_provider VARCHAR(150) NULL;
IF COL_LENGTH('dbo.assets', 'lease_start_date') IS NULL ALTER TABLE dbo.assets ADD lease_start_date DATE NULL;
IF COL_LENGTH('dbo.assets', 'lease_end_date') IS NULL ALTER TABLE dbo.assets ADD lease_end_date DATE NULL;
IF COL_LENGTH('dbo.assets', 'down_payment') IS NULL ALTER TABLE dbo.assets ADD down_payment DECIMAL(14,2) NOT NULL CONSTRAINT DF_assets_down_payment DEFAULT 0;
IF COL_LENGTH('dbo.assets', 'installment_amount') IS NULL ALTER TABLE dbo.assets ADD installment_amount DECIMAL(14,2) NOT NULL CONSTRAINT DF_assets_installment_amount DEFAULT 0;
IF COL_LENGTH('dbo.assets', 'installment_period_months') IS NULL ALTER TABLE dbo.assets ADD installment_period_months INT NOT NULL CONSTRAINT DF_assets_installment_period_months DEFAULT 0;
IF COL_LENGTH('dbo.assets', 'months_paid') IS NULL ALTER TABLE dbo.assets ADD months_paid INT NOT NULL CONSTRAINT DF_assets_months_paid DEFAULT 0;
IF COL_LENGTH('dbo.assets', 'monthly_rental') IS NULL ALTER TABLE dbo.assets ADD monthly_rental DECIMAL(14,2) NOT NULL CONSTRAINT DF_assets_monthly_rental DEFAULT 0;
IF COL_LENGTH('dbo.assets', 'status') IS NULL ALTER TABLE dbo.assets ADD status VARCHAR(30) NOT NULL CONSTRAINT DF_assets_status DEFAULT 'Active';
GO

IF OBJECT_ID(N'dbo.purchases', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.purchases (
      id INT IDENTITY(1,1) PRIMARY KEY,
      purchase_no VARCHAR(30) NULL UNIQUE,
      seller_id INT NULL,
      purchase_date DATE NOT NULL,
      total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      balance DECIMAL(14,2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(30) NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Card', 'Cheque', 'Credit')),
      notes VARCHAR(MAX) NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
      CONSTRAINT FK_purchases_sellers FOREIGN KEY (seller_id) REFERENCES dbo.sellers(id) ON DELETE SET NULL
    );
END
GO

IF OBJECT_ID(N'dbo.purchase_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.purchase_items (
      id INT IDENTITY(1,1) PRIMARY KEY,
      purchase_id INT NULL,
      product_id INT NULL,
      quantity DECIMAL(12,2) NOT NULL,
      unit_price DECIMAL(12,2) NOT NULL,
      subtotal DECIMAL(14,2) NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES dbo.purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES dbo.products(id)
    );
END
GO

IF OBJECT_ID(N'dbo.sales', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sales (
      id INT IDENTITY(1,1) PRIMARY KEY,
      invoice_no VARCHAR(30) NULL UNIQUE,
      buyer_id INT NULL,
      sale_date DATE NOT NULL,
      total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      balance DECIMAL(14,2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(30) NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Card', 'Cheque', 'Credit')),
      payment_status VARCHAR(20) NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Paid', 'Partial', 'Unpaid')),
      notes VARCHAR(MAX) NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
      CONSTRAINT FK_sales_buyers FOREIGN KEY (buyer_id) REFERENCES dbo.buyers(id) ON DELETE SET NULL
    );
END
GO

-- Upgrade existing databases created with an earlier version.
IF COL_LENGTH('dbo.sellers', 'email') IS NULL ALTER TABLE dbo.sellers ADD email VARCHAR(150) NULL;
IF COL_LENGTH('dbo.buyers', 'email') IS NULL ALTER TABLE dbo.buyers ADD email VARCHAR(150) NULL;
IF COL_LENGTH('dbo.purchases', 'payment_method') IS NULL ALTER TABLE dbo.purchases ADD payment_method VARCHAR(30) NOT NULL CONSTRAINT DF_purchases_payment_method DEFAULT 'Cash';
IF COL_LENGTH('dbo.sales', 'payment_method') IS NULL ALTER TABLE dbo.sales ADD payment_method VARCHAR(30) NOT NULL CONSTRAINT DF_sales_payment_method DEFAULT 'Cash';
IF COL_LENGTH('dbo.purchases', 'discount_amount') IS NULL ALTER TABLE dbo.purchases ADD discount_amount DECIMAL(14,2) NOT NULL CONSTRAINT DF_purchases_discount_amount DEFAULT 0;
IF COL_LENGTH('dbo.sales', 'discount_amount') IS NULL ALTER TABLE dbo.sales ADD discount_amount DECIMAL(14,2) NOT NULL CONSTRAINT DF_sales_discount_amount DEFAULT 0;
GO

IF OBJECT_ID(N'dbo.sale_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sale_items (
      id INT IDENTITY(1,1) PRIMARY KEY,
      sale_id INT NULL,
      product_id INT NULL,
      quantity DECIMAL(12,2) NOT NULL,
      unit_price DECIMAL(12,2) NOT NULL,
      subtotal DECIMAL(14,2) NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES dbo.sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES dbo.products(id)
    );
END
GO

IF OBJECT_ID(N'dbo.stock_transactions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.stock_transactions (
      id INT IDENTITY(1,1) PRIMARY KEY,
      product_id INT NULL,
      type VARCHAR(10) NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUST')),
      quantity DECIMAL(12,2) NOT NULL,
      ref_type VARCHAR(20) NULL,
      ref_id INT NULL,
      balance_after DECIMAL(12,2) NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
      FOREIGN KEY (product_id) REFERENCES dbo.products(id)
    );
END
GO

IF OBJECT_ID(N'dbo.bank_accounts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.bank_accounts (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name VARCHAR(150) NOT NULL DEFAULT 'BOC Current Account',
      bank_name VARCHAR(150) NOT NULL DEFAULT 'Bank of Ceylon',
      account_number VARCHAR(100) NULL,
      branch VARCHAR(150) NULL,
      account_type VARCHAR(30) NOT NULL DEFAULT 'Current' CHECK (account_type IN ('Current', 'Savings', 'Business')),
      opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
      current_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
      notes VARCHAR(MAX) NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.bank_transactions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.bank_transactions (
      id INT IDENTITY(1,1) PRIMARY KEY,
      account_id INT NOT NULL,
      transaction_date DATE NOT NULL,
      type VARCHAR(10) NOT NULL CHECK (type IN ('IN', 'OUT')),
      category VARCHAR(30) NOT NULL DEFAULT 'General',
      payment_method VARCHAR(30) NOT NULL DEFAULT 'Cash',
      reference_no VARCHAR(100) NULL,
      description VARCHAR(255) NULL,
      transfer_bank_name VARCHAR(150) NULL,
      transfer_account_name VARCHAR(150) NULL,
      transfer_account_number VARCHAR(100) NULL,
      transfer_branch VARCHAR(150) NULL,
      cheque_number VARCHAR(50) NULL,
      cheque_date DATE NULL,
      cheque_payee VARCHAR(150) NULL,
      evidence_filename VARCHAR(255) NULL,
      evidence_original_name VARCHAR(255) NULL,
      evidence_mime VARCHAR(100) NULL,
      amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      balance_after DECIMAL(14,2) NOT NULL DEFAULT 0,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
      CONSTRAINT FK_bank_transactions_accounts FOREIGN KEY (account_id) REFERENCES dbo.bank_accounts(id) ON DELETE CASCADE
    );
END
GO

IF COL_LENGTH('dbo.bank_transactions', 'payment_method') IS NULL ALTER TABLE dbo.bank_transactions ADD payment_method VARCHAR(30) NOT NULL CONSTRAINT DF_bank_transactions_payment_method DEFAULT 'Cash';
IF COL_LENGTH('dbo.bank_transactions', 'transfer_bank_name') IS NULL ALTER TABLE dbo.bank_transactions ADD transfer_bank_name VARCHAR(150) NULL;
IF COL_LENGTH('dbo.bank_transactions', 'transfer_account_name') IS NULL ALTER TABLE dbo.bank_transactions ADD transfer_account_name VARCHAR(150) NULL;
IF COL_LENGTH('dbo.bank_transactions', 'transfer_account_number') IS NULL ALTER TABLE dbo.bank_transactions ADD transfer_account_number VARCHAR(100) NULL;
IF COL_LENGTH('dbo.bank_transactions', 'transfer_branch') IS NULL ALTER TABLE dbo.bank_transactions ADD transfer_branch VARCHAR(150) NULL;
IF COL_LENGTH('dbo.bank_transactions', 'cheque_number') IS NULL ALTER TABLE dbo.bank_transactions ADD cheque_number VARCHAR(50) NULL;
IF COL_LENGTH('dbo.bank_transactions', 'cheque_date') IS NULL ALTER TABLE dbo.bank_transactions ADD cheque_date DATE NULL;
IF COL_LENGTH('dbo.bank_transactions', 'cheque_payee') IS NULL ALTER TABLE dbo.bank_transactions ADD cheque_payee VARCHAR(150) NULL;
IF COL_LENGTH('dbo.bank_transactions', 'evidence_filename') IS NULL ALTER TABLE dbo.bank_transactions ADD evidence_filename VARCHAR(255) NULL;
IF COL_LENGTH('dbo.bank_transactions', 'evidence_original_name') IS NULL ALTER TABLE dbo.bank_transactions ADD evidence_original_name VARCHAR(255) NULL;
IF COL_LENGTH('dbo.bank_transactions', 'evidence_mime') IS NULL ALTER TABLE dbo.bank_transactions ADD evidence_mime VARCHAR(100) NULL;
GO

IF OBJECT_ID(N'dbo.cheques', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.cheques (
      id INT IDENTITY(1,1) PRIMARY KEY,
      account_id INT NOT NULL,
      cheque_no VARCHAR(50) NOT NULL,
      payee VARCHAR(150) NOT NULL,
      amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      issue_date DATE NULL,
      due_date DATE NULL,
      cheque_type VARCHAR(20) NOT NULL DEFAULT 'Issued' CHECK (cheque_type IN ('Issued', 'Received')),
      status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Cleared', 'Bounced', 'Cancelled', 'Deposited')),
      bank_name VARCHAR(150) NULL,
      branch VARCHAR(150) NULL,
      notes VARCHAR(MAX) NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
      CONSTRAINT FK_cheques_accounts FOREIGN KEY (account_id) REFERENCES dbo.bank_accounts(id) ON DELETE CASCADE
    );
END
GO

IF OBJECT_ID(N'dbo.bank_facilities', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.bank_facilities (
      id INT IDENTITY(1,1) PRIMARY KEY,
      account_id INT NULL,
      name VARCHAR(150) NOT NULL,
      facility_type VARCHAR(30) NOT NULL DEFAULT 'Loan' CHECK (facility_type IN ('Loan', 'Overdraft', 'Credit Limit', 'Guarantee', 'Lease', 'Other')),
      provider VARCHAR(150) NULL,
      principal_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      outstanding_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      interest_rate DECIMAL(8,2) NOT NULL DEFAULT 0,
      start_date DATE NULL,
      end_date DATE NULL,
      installment_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Closed', 'Default', 'Under Review')),
      notes VARCHAR(MAX) NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
      CONSTRAINT FK_bank_facilities_accounts FOREIGN KEY (account_id) REFERENCES dbo.bank_accounts(id) ON DELETE SET NULL
    );
END
GO

IF OBJECT_ID(N'dbo.employees', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.employees (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      position VARCHAR(100) NOT NULL,
      phone VARCHAR(30) NULL,
      email VARCHAR(150) NULL,
      nic VARCHAR(30) NULL,
      address VARCHAR(255) NULL,
      join_date DATE NULL,
      salary DECIMAL(14,2) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'On Leave', 'Resigned')),
      notes VARCHAR(MAX) NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.directors', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.directors (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      designation VARCHAR(100) NOT NULL,
      phone VARCHAR(30) NULL,
      email VARCHAR(150) NULL,
      nic VARCHAR(30) NULL,
      address VARCHAR(255) NULL,
      appointment_date DATE NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
      notes VARCHAR(MAX) NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.shareholders', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.shareholders (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      share_type VARCHAR(50) NOT NULL DEFAULT 'Individual' CHECK (share_type IN ('Individual', 'Company', 'Trust')),
      shares DECIMAL(18,2) NOT NULL DEFAULT 0,
      share_percentage DECIMAL(8,2) NOT NULL DEFAULT 0,
      phone VARCHAR(30) NULL,
      email VARCHAR(150) NULL,
      nic VARCHAR(30) NULL,
      address VARCHAR(255) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
      notes VARCHAR(MAX) NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

