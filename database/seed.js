// Creates the default admin and superadmin login users.
// Run with: npm run seed
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seedUser(username, plainPassword, fullName, role) {
  const hashed = await bcrypt.hash(plainPassword, 10);
  const [existing] = await pool.query('SELECT id, role FROM users WHERE username = ?', [username]);

  if (existing.length > 0) {
    await pool.query(
      'UPDATE users SET password = ?, full_name = ?, role = ? WHERE username = ?',
      [hashed, fullName, role, username]
    );
    console.log(`${role} user already existed - credentials reset to "${username}" / "${plainPassword}"`);
    return;
  }

  await pool.query(
    'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
    [username, hashed, fullName, role]
  );
  console.log(`${role} user created successfully.`);
}

async function seed() {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const superadminPassword = process.env.SUPERADMIN_PASSWORD || 'superadmin123';
    if (process.env.NODE_ENV === 'production' &&
      (adminPassword === 'admin123' || superadminPassword === 'superadmin123')) {
      throw new Error('Set ADMIN_PASSWORD and SUPERADMIN_PASSWORD before seeding a production database.');
    }

    await seedUser(process.env.ADMIN_USERNAME || 'admin', adminPassword, 'Administrator', 'admin');
    await seedUser(process.env.SUPERADMIN_USERNAME || 'superadmin', superadminPassword, 'Super Administrator', 'superadmin');

    console.log('----------------------------------------');
    console.log(' Default login users:');
    console.log('  admin / admin123');
    console.log('  superadmin / superadmin123');
    console.log('  Only superadmin can manage company records.');
    console.log('----------------------------------------');
  } catch (err) {
    console.error('Seed error:', err.message);
  } finally {
    process.exit();
  }
}

seed();
