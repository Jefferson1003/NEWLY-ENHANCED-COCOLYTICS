import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'new_cocolytics';
const MIGRATIONS_TABLE = 'schema_migrations';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, 'migrations');

const baseConfig = {
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  multipleStatements: true,
};

export const pool = mysql.createPool({
  ...baseConfig,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function ensureDatabaseExists() {
  const connection = await mysql.createConnection(baseConfig);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await connection.end();
}

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function getPendingMigrations() {
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  const [rows] = await pool.query(`SELECT name FROM ${MIGRATIONS_TABLE}`);
  const applied = new Set(rows.map((row) => row.name));

  return files.filter((file) => !applied.has(file));
}

async function applyMigration(filename) {
  const migrationPath = path.join(migrationsDir, filename);
  const sql = await readFile(migrationPath, 'utf8');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query(sql);
    await connection.execute(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`, [filename]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw new Error(`Migration ${filename} failed: ${error.message}`);
  } finally {
    connection.release();
  }
}

export async function runMigrations() {
  await ensureMigrationsTable();
  const pendingMigrations = await getPendingMigrations();

  for (const filename of pendingMigrations) {
    await applyMigration(filename);
  }
}

export async function initializeDatabase() {
  await ensureDatabaseExists();
  await runMigrations();
}
