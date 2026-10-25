const sql = require('mssql');
require('dotenv').config();

const serverSetting = process.env.DB_SERVER || 'Dula-Dev';
const [server, instanceName] = serverSetting.split('\\', 2);

const config = {
  server,
  port: Number(process.env.DB_PORT || 1433),
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'devinda_enterprises',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    ...(instanceName ? { instanceName } : {})
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch(error => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}

function toSqlQuery(query, values = []) {
  let index = 0;
  const converted = query.replace(/\?/g, () => `@p${index++}`);
  return { query: converted, values };
}

async function execute(pool, query, values = [], transaction) {
  const request = transaction ? new sql.Request(transaction) : pool.request();
  const converted = toSqlQuery(query, values);
  converted.values.forEach((value, index) => request.input(`p${index}`, value === undefined ? null : value));
  const isInsert = /^\s*INSERT\s+/i.test(query);
  const result = await request.query(isInsert
    ? `${converted.query}; SELECT CAST(SCOPE_IDENTITY() AS INT) AS insertId;`
    : converted.query);
  const rows = result.recordsets[0] || [];
  if (isInsert) {
    const identityRows = result.recordsets[result.recordsets.length - 1] || [];
    return [{ insertId: identityRows[0]?.insertId }, result];
  }
  return [rows, result];
}

const pool = {
  async query(query, values) {
    const connection = await getPool();
    return execute(connection, query, values);
  },
  async getConnection() {
    const connection = await getPool();
    const transaction = new sql.Transaction(connection);
    return {
      query: (query, values) => execute(connection, query, values, transaction),
      beginTransaction: () => transaction.begin(),
      commit: () => transaction.commit(),
      rollback: () => transaction.rollback(),
      release: () => Promise.resolve()
    };
  }
};

module.exports = pool;
