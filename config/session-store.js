const session = require('express-session');
const pool = require('./db');

class SqlSessionStore extends session.Store {
  get(sessionId, callback) {
    pool.query(
      'SELECT session_data FROM app_sessions WHERE session_id = ? AND expires_at > SYSUTCDATETIME()',
      [sessionId]
    ).then(([rows]) => callback(null, rows.length ? JSON.parse(rows[0].session_data) : null))
      .catch(callback);
  }

  set(sessionId, sessionData, callback = () => {}) {
    const expiresAt = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires)
      : new Date(Date.now() + (sessionData.cookie?.maxAge || 86400000));

    pool.query(
      `MERGE dbo.app_sessions WITH (HOLDLOCK) AS target
       USING (SELECT ? AS session_id, ? AS session_data, ? AS expires_at) AS source
       ON target.session_id = source.session_id
       WHEN MATCHED THEN UPDATE SET session_data = source.session_data, expires_at = source.expires_at
       WHEN NOT MATCHED THEN INSERT (session_id, session_data, expires_at)
         VALUES (source.session_id, source.session_data, source.expires_at);`,
      [sessionId, JSON.stringify(sessionData), expiresAt]
    ).then(() => callback(null)).catch(callback);
  }

  destroy(sessionId, callback = () => {}) {
    pool.query('DELETE FROM app_sessions WHERE session_id = ?', [sessionId])
      .then(() => callback(null)).catch(callback);
  }

  touch(sessionId, sessionData, callback = () => {}) {
    const expiresAt = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires)
      : new Date(Date.now() + (sessionData.cookie?.maxAge || 86400000));
    pool.query('UPDATE app_sessions SET expires_at = ? WHERE session_id = ?', [expiresAt, sessionId])
      .then(() => callback(null)).catch(callback);
  }
}

module.exports = SqlSessionStore;