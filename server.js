const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
let Pool;
try { ({ Pool } = require('pg')); } catch { Pool = null; }

const root = __dirname;
const port = Number(process.env.PORT || 8765);
const esewaEnv = process.env.ESEWA_ENV || 'uat';
const isProduction = esewaEnv === 'production';
const productCode = process.env.ESEWA_PRODUCT_CODE || (isProduction ? '' : 'EPAYTEST');
const secretKey = process.env.ESEWA_SECRET_KEY || (isProduction ? '' : '8gBm/:&EnhH.1/q(');
const configuredPublicUrl = process.env.PUBLIC_URL || '';
const adminToken = process.env.ADMIN_TOKEN || '';
const ordersFile = path.join(root, 'orders.json');
const orderRetentionMs = 7 * 24 * 60 * 60 * 1000;
const databaseUrl = process.env.DATABASE_URL || '';
const pool = Pool && databaseUrl ? new Pool({connectionString: databaseUrl, ssl: databaseUrl.includes('localhost') ? false : {rejectUnauthorized:false}, max: 5}) : null;
let databaseReady = false;

function json(res, status, body) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type, X-Admin-Token'});
  res.end(JSON.stringify(body));
}

function readBody(req, maxBytes = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > maxBytes) { req.destroy(); reject(new Error('Request is too large')); } });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

function readOrders() {
  try { return JSON.parse(fs.readFileSync(ordersFile, 'utf8')); } catch { return []; }
}
function saveOrders(orders) { fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2), 'utf8'); }
function freshOrders(orders) {
  const cutoff = Date.now() - orderRetentionMs;
  return orders.filter(order => Number.isFinite(Date.parse(order.createdAt)) && Date.parse(order.createdAt) >= cutoff);
}
function getFreshOrders() {
  const orders = readOrders();
  const fresh = freshOrders(orders);
  if (fresh.length !== orders.length) saveOrders(fresh);
  return fresh;
}
async function initDatabase() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS orders (
    order_number TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`DELETE FROM orders WHERE created_at < NOW() - INTERVAL '7 days'`);
  databaseReady = true;
  console.log('PostgreSQL order storage enabled (7-day retention).');
}
async function readStoredOrders() {
  if (!databaseReady) return getFreshOrders();
  const result = await pool.query(`SELECT payload FROM orders WHERE created_at >= NOW() - INTERVAL '7 days' ORDER BY created_at ASC`);
  return result.rows.map(row => row.payload);
}
async function saveStoredOrder(order) {
  if (!databaseReady) {
    const orders = getFreshOrders().filter(item => item.orderNumber !== order.orderNumber);
    orders.push(order);
    saveOrders(orders);
    return;
  }
  await pool.query(`INSERT INTO orders (order_number, created_at, payload, synced_at) VALUES ($1, $2, $3::jsonb, NOW()) ON CONFLICT (order_number) DO UPDATE SET payload = EXCLUDED.payload, created_at = EXCLUDED.created_at, synced_at = NOW()`, [order.orderNumber, order.createdAt, JSON.stringify(order)]);
  await pool.query(`DELETE FROM orders WHERE created_at < NOW() - INTERVAL '7 days'`);
}
function authorized(req) {
  if (!adminToken) return true;
  return req.headers['x-admin-token'] === adminToken;
}
function validOrder(order) {
  return order && typeof order === 'object' && /^[A-Z0-9-]{4,40}$/i.test(String(order.orderNumber || '')) && Number.isFinite(Date.parse(order.createdAt)) && typeof order.customer?.name === 'string' && order.customer.name.trim().length >= 2 && /^[0-9+()\-\s]{7,25}$/.test(String(order.customer.phone || '')) && Array.isArray(order.items) && order.items.length > 0 && Number.isFinite(Number(order.total)) && Number(order.total) > 0;
}

function signature(message) {
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname === '/dashboard' ? '/dashboard.html' : pathname;
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif'};
  res.writeHead(200, {'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type'}); res.end(); return; }
  if (req.method === 'GET' && url.pathname === '/api/orders') {
    if (!authorized(req)) return json(res, 401, {error:'Admin authentication required.'});
    try { return json(res, 200, {orders:await readStoredOrders(), retentionDays:7, storage:databaseReady ? 'postgresql' : 'local-fallback'}); } catch (error) { return json(res, 503, {error:'Order storage is unavailable.', detail:error.message}); }
  }
  if (req.method === 'POST' && url.pathname === '/api/orders') {
    try {
      const order = await readBody(req);
      if (!validOrder(order)) return json(res, 400, {error:'Required order details are missing or invalid.'});
      const normalized = {...order, orderNumber:String(order.orderNumber), createdAt:new Date(order.createdAt).toISOString(), syncedAt:new Date().toISOString()};
      await saveStoredOrder(normalized);
      return json(res, 201, {ok:true, orderNumber:normalized.orderNumber, retentionDays:7, storage:databaseReady ? 'postgresql' : 'local-fallback'});
    } catch (error) { return json(res, 400, {error:error.message}); }
  }
  if (req.method === 'POST' && url.pathname === '/api/esewa/initiate') {
    try {
      const body = await readBody(req);
      const total = Number(body.amount);
      if (!Number.isFinite(total) || total <= 0) return json(res, 400, {error:'A valid payment amount is required.'});
      if (!productCode || !secretKey) return json(res, 503, {error:'eSewa merchant credentials are not configured.'});
      const transactionUuid = `SD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      const origin = configuredPublicUrl || `http://${req.headers.host || `localhost:${port}`}`;
      const totalAmount = total.toFixed(2);
      const signedFieldNames = 'total_amount,transaction_uuid,product_code';
      const fields = {
        amount: totalAmount,
        tax_amount: '0',
        total_amount: totalAmount,
        transaction_uuid: transactionUuid,
        product_code: productCode,
        product_service_charge: '0',
        product_delivery_charge: '0',
        success_url: `${origin}/?esewa=success&transaction_uuid=${encodeURIComponent(transactionUuid)}`,
        failure_url: `${origin}/?esewa=failure&transaction_uuid=${encodeURIComponent(transactionUuid)}`,
        signed_field_names: signedFieldNames,
        signature: signature(`total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`)
      };
      const action = isProduction ? 'https://epay.esewa.com.np/api/epay/main/v2/form' : 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
      return json(res, 200, {action, fields, environment: esewaEnv});
    } catch (error) { return json(res, 400, {error: error.message}); }
  }
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, {ok:true, esewaEnvironment:esewaEnv, configured:Boolean(productCode && secretKey), storage:databaseReady ? 'postgresql' : 'local-fallback', adminProtection:Boolean(adminToken)});
  serveStatic(req, res, url.pathname);
});

server.listen(port, async () => {
  try { await initDatabase(); } catch (error) { console.error('Database initialization failed; using local fallback:', error.message); }
  console.log(`Shree Devi site running at http://localhost:${port}`);
});
