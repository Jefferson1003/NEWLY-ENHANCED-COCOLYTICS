import { initializeDatabase, pool } from './db.js';

async function run() {
  try {
    await initializeDatabase();
    console.log('Database migrations applied successfully.');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

run();
