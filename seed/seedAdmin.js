const bcrypt = require('bcryptjs');
const db = require('../db/store');

// Creates (or updates) the admin account. No external DB or configuration required.
// Defaults can be overridden via ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD env vars.
async function seedAdmin() {
  const name = process.env.ADMIN_NAME || 'Admin';
  const email = (process.env.ADMIN_EMAIL || 'ratnasampath.5680@gmail.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Sampath@333';

  const existing = db.findOne('users', { email });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await db.save('users', existing);
      console.log(`Admin role granted to ${email}`);
    } else {
      console.log(`Admin account already exists: ${email}`);
    }
    return existing;
  }

  const hash = await bcrypt.hash(password, 10);
  const admin = await db.insert('users', { name, email, password: hash, role: 'admin', currency: 'USD' });
  console.log(`Admin account created: ${email}`);
  return admin;
}

module.exports = { seedAdmin };

// Allow running directly: npm run seed:admin
if (require.main === module) {
  require('dotenv').config();
  (async () => {
    try {
      await db.init();
      await seedAdmin();
      process.exit(0);
    } catch (error) {
      console.error('Seeding failed:', error.message);
      process.exit(1);
    }
  })();
}
