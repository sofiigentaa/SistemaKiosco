import 'dotenv/config';
import pg from 'pg';
import { readFile } from 'node:fs/promises';

if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en el entorno.');

const { Pool } = pg;
const database = new URL(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: database.hostname.endsWith('.render.com') ? { rejectUnauthorized: false } : false,
});

try {
  const schema = await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  console.log('Esquema PostgreSQL aplicado correctamente.');
} finally {
  await pool.end();
}