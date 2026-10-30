import 'dotenv/config';
import bcrypt from 'bcryptjs';
import 'express-async-errors';
import express from 'express';
import nodemailer from 'nodemailer';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const directory = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const databaseUrl = new URL(process.env.DATABASE_URL || 'postgresql://localhost');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: databaseUrl.hostname.endsWith('.render.com') ? { rejectUnauthorized: false } : false,
});

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '10mb' }));

const required = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Falta configurar ${name}.`);
}

async function initialize() {
  await pool.query(await readFile(path.join(directory, 'schema.sql'), 'utf8'));
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await pool.query(
    `INSERT INTO kiosk_users (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [process.env.ADMIN_EMAIL.trim().toLowerCase(), passwordHash]
  );
}

function authenticate(req, res, next) {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('kiosk_session='));
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1] || cookie?.slice('kiosk_session='.length);
  if (!token) return res.status(401).json({ error: 'Iniciá sesión para continuar.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    pool.query('SELECT session_version FROM kiosk_users WHERE id = $1', [req.user.sub])
      .then(({ rows }) => {
        if (!rows[0] || rows[0].session_version !== req.user.version) {
          return res.status(401).json({ error: 'La sesión venció. Volvé a iniciar sesión.' });
        }
        next();
      })
      .catch(next);
  } catch {
    res.status(401).json({ error: 'La sesión venció. Volvé a iniciar sesión.' });
  }
}

function validArray(value) {
  return Array.isArray(value) ? value : [];
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const registrationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });
const recoveryLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });

function setSessionCookie(res, user) {
  const token = jwt.sign(
    { email: user.email, version: user.session_version },
    process.env.JWT_SECRET,
    { subject: user.id, expiresIn: '12h' }
  );
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `kiosk_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`);
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 200;
}

function createMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) return null;
  const port = Number(SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
}

app.post('/api/auth/register', registrationLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = req.body?.password;
  if (email.length > 254 || !emailPattern.test(email)) return res.status(400).json({ error: 'Ingresá un email válido.' });
  if (!validPassword(password)) return res.status(400).json({ error: 'La contraseña debe tener entre 12 y 200 caracteres.' });

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await pool.query(
      'INSERT INTO kiosk_users (email, password_hash) VALUES ($1, $2) RETURNING id, email, session_version',
      [email, passwordHash]
    );
    setSessionCookie(res, rows[0]);
    res.status(201).json({ user: { id: rows[0].id, email: rows[0].email } });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'No se pudo crear la cuenta. Revisá si ese email ya está registrado.' });
    throw error;
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const { rows } = await pool.query('SELECT id, email, password_hash, session_version FROM kiosk_users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
  }
  setSessionCookie(res, user);
  res.json({ user: { id: user.id, email: user.email } });
});

app.post('/api/auth/password/forgot', recoveryLimiter, async (req, res) => {
  const mailer = createMailer();
  if (!mailer) return res.status(503).json({ error: 'La recuperación por email todavía no está configurada.' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (email.length > 254 || !emailPattern.test(email)) return res.status(400).json({ error: 'Ingresá un email válido.' });

  const { rows } = await pool.query('SELECT id, email FROM kiosk_users WHERE email = $1', [email]);
  if (rows[0]) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await pool.query('DELETE FROM kiosk_password_reset_tokens WHERE user_id = $1 AND used_at IS NULL', [rows[0].id]);
    await pool.query(
      'INSERT INTO kiosk_password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval \'30 minutes\')',
      [tokenHash, rows[0].id]
    );
    const appUrl = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl = `${appUrl}/?reset=${encodeURIComponent(token)}`;
    try {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: rows[0].email,
        subject: 'Restablecer contraseña del Sistema Kiosco',
        text: `Para elegir una contraseña nueva, abrí este enlace (vence en 30 minutos): ${resetUrl}`,
        html: `<p>Recibimos un pedido para restablecer tu contraseña.</p><p><a href="${resetUrl}">Crear una contraseña nueva</a></p><p>El enlace vence en 30 minutos. Si no pediste este cambio, ignorá este email.</p>`,
      });
    } catch {
      await pool.query('DELETE FROM kiosk_password_reset_tokens WHERE token_hash = $1', [tokenHash]);
      return res.status(503).json({ error: 'No se pudo enviar el email de recuperación. Revisá la configuración de correo.' });
    }
  }
  res.json({ message: 'Si el email está registrado, recibirás un enlace para restablecer la contraseña.' });
});

app.post('/api/auth/password/reset', async (req, res) => {
  const token = String(req.body?.token || '');
  const password = req.body?.password;
  if (!token || token.length > 200) return res.status(400).json({ error: 'El enlace no es válido o venció.' });
  if (!validPassword(password)) return res.status(400).json({ error: 'La contraseña debe tener entre 12 y 200 caracteres.' });

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT user_id FROM kiosk_password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE`,
      [tokenHash]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El enlace no es válido o venció.' });
    }
    await client.query(
      'UPDATE kiosk_users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2',
      [passwordHash, rows[0].user_id]
    );
    await client.query('UPDATE kiosk_password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [rows[0].user_id]);
    await client.query('COMMIT');
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `kiosk_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
    res.json({ message: 'Contraseña actualizada. Ya podés ingresar.' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

app.post('/api/auth/logout', (_req, res) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `kiosk_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
  res.status(204).end();
});

app.get('/api/auth/session', authenticate, async (req, res) => {
  const { rows } = await pool.query('SELECT id, email FROM kiosk_users WHERE id = $1', [req.user.sub]);
  if (!rows[0]) return res.status(401).json({ error: 'La cuenta ya no existe.' });
  res.json({ user: rows[0] });
});

app.get('/api/kiosk/state', authenticate, async (req, res) => {
  const owner = req.user.sub;
  const [products, sales, movements, meta] = await Promise.all([
    pool.query('SELECT data FROM kiosk_products WHERE owner = $1', [owner]),
    pool.query('SELECT data FROM kiosk_sales WHERE owner = $1 ORDER BY created_at DESC', [owner]),
    pool.query('SELECT data FROM kiosk_movements WHERE owner = $1 ORDER BY created_at DESC LIMIT 5000', [owner]),
    pool.query('SELECT categories, current_shift, closed_shifts FROM kiosk_meta WHERE owner = $1', [owner]),
  ]);
  const row = meta.rows[0];
  const state = {
    products: products.rows.map((r) => r.data),
    sales: sales.rows.map((r) => r.data),
    stockMovements: movements.rows.map((r) => r.data),
    categories: row?.categories || [],
    currentShift: row?.current_shift || null,
    closedShifts: row?.closed_shifts || [],
  };
  res.json({ state, isEmpty: !state.products.length && !state.sales.length && !row });
});

app.post('/api/kiosk/sync', authenticate, async (req, res) => {
  const owner = req.user.sub;
  const body = req.body || {};
  const client = await pool.connect();
  const stockUpdates = {};
  try {
    await client.query('BEGIN');
    for (const change of validArray(body.products)) {
      const product = change.product;
      if (!product?.id) continue;
      const { rows } = await client.query(
        `INSERT INTO kiosk_products (owner, id, data, updated_at) VALUES ($1, $2, $3::jsonb, now())
         ON CONFLICT (owner, id) DO UPDATE SET
           data = jsonb_set(EXCLUDED.data, '{stock}', to_jsonb(GREATEST(0,
             COALESCE((kiosk_products.data->>'stock')::numeric, 0) +
             CASE WHEN $4::boolean THEN 0 ELSE $5::numeric END))),
           updated_at = now()
         RETURNING (data->>'stock')::numeric AS stock`,
        [owner, product.id, JSON.stringify(product), Boolean(change.isNew), Number(change.stockDelta) || 0]
      );
      stockUpdates[product.id] = Number(rows[0].stock);
    }
    const deletedProducts = validArray(body.deletedProducts);
    if (deletedProducts.length) await client.query('DELETE FROM kiosk_products WHERE owner = $1 AND id = ANY($2::text[])', [owner, deletedProducts]);

    for (const sale of validArray(body.sales)) {
      if (!sale?.id) continue;
      await client.query(
        `INSERT INTO kiosk_sales (owner, id, data, created_at) VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (owner, id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at`,
        [owner, sale.id, JSON.stringify(sale), sale.date]
      );
    }
    const deletedSales = validArray(body.deletedSales);
    if (deletedSales.length) await client.query('DELETE FROM kiosk_sales WHERE owner = $1 AND id = ANY($2::text[])', [owner, deletedSales]);

    for (const movement of validArray(body.movements)) {
      if (!movement?.id) continue;
      await client.query(
        `INSERT INTO kiosk_movements (owner, id, data, created_at) VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (owner, id) DO NOTHING`,
        [owner, movement.id, JSON.stringify(movement), movement.date]
      );
    }
    const deletedMovements = validArray(body.deletedMovements);
    if (deletedMovements.length) await client.query('DELETE FROM kiosk_movements WHERE owner = $1 AND id = ANY($2::text[])', [owner, deletedMovements]);

    if (body.meta) {
      await client.query(
        `INSERT INTO kiosk_meta (owner, categories, current_shift, closed_shifts, updated_at)
         VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, now())
         ON CONFLICT (owner) DO UPDATE SET categories = EXCLUDED.categories,
           current_shift = EXCLUDED.current_shift, closed_shifts = EXCLUDED.closed_shifts, updated_at = now()`,
        [owner, JSON.stringify(body.meta.categories || []), JSON.stringify(body.meta.currentShift), JSON.stringify(body.meta.closedShifts || [])]
      );
    }
    await client.query('COMMIT');
    res.json({ stockUpdates });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error sincronizando datos del kiosco:', error.message);
    res.status(500).json({ error: 'No se pudieron guardar los cambios en PostgreSQL.' });
  } finally {
    client.release();
  }
});

app.get('/api/calandria/log', authenticate, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT seq, at, kind, action, qty, minutes, prev_hash, hash
     FROM kiosk_calandria_log WHERE owner = $1 ORDER BY seq LIMIT 10000`,
    [req.user.sub]
  );
  res.json({ entries: rows });
});

app.post('/api/calandria/log', authenticate, async (req, res) => {
  const { kind, action, qty, minutes } = req.body || {};
  const allowedKinds = ['reposicion', 'ingreso_habitual', 'liquidacion', 'fiados', 'sistema'];
  const allowedActions = ['aprobada', 'descartada', 'pausa', 'reanudada'];
  if (!allowedKinds.includes(kind) || !allowedActions.includes(action)) return res.status(400).json({ error: 'Acción de Golondrina inválida.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM kiosk_users WHERE id = $1 FOR UPDATE', [req.user.sub]);
    const { rows } = await client.query('SELECT seq, hash FROM kiosk_calandria_log WHERE owner = $1 ORDER BY seq DESC LIMIT 1', [req.user.sub]);
    const previous = rows[0];
    const entry = {
      seq: (previous?.seq || 0) + 1,
      at: new Date().toISOString(),
      kind,
      action,
      qty: Math.max(0, Math.min(100000, Math.trunc(Number(qty) || 0))),
      minutes: Math.max(0, Math.min(600, Math.trunc(Number(minutes) || 0))),
      prev_hash: previous?.hash || 'GENESIS',
    };
    const canonical = `${entry.seq}|${entry.at}|${entry.kind}|${entry.action}|${entry.qty}|${entry.minutes}|${entry.prev_hash}`;
    entry.hash = createHash('sha256').update(canonical, 'utf8').digest('hex');
    await client.query(
      `INSERT INTO kiosk_calandria_log (owner, seq, at, kind, action, qty, minutes, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [req.user.sub, entry.seq, entry.at, entry.kind, entry.action, entry.qty, entry.minutes, entry.prev_hash, entry.hash]
    );
    await client.query('COMMIT');
    res.status(201).json({ entry });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error guardando registro de Golondrina:', error.message);
    res.status(500).json({ error: 'No se pudo guardar el registro.' });
  } finally {
    client.release();
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta de API inexistente.' }));
app.use((error, _req, res, _next) => {
  console.error('Error de API:', error.message);
  res.status(500).json({ error: 'Ocurrió un error interno. Volvé a intentar.' });
});
const publicDirectory = path.resolve(directory, '../dist');
app.use(express.static(publicDirectory));
app.get('*', (_req, res) => res.sendFile(path.join(publicDirectory, 'index.html')));

const port = Number(process.env.PORT) || 3001;
initialize().then(() => app.listen(port, '0.0.0.0', () => console.log(`Sistema Kiosco escuchando en ${port}`))).catch((error) => {
  console.error('No se pudo iniciar el servidor:', error.message);
  process.exit(1);
});