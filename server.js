const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const root = __dirname;
const port = Number(process.env.PORT || 8765);
const esewaEnv = process.env.ESEWA_ENV || 'uat';
const isProduction = esewaEnv === 'production';
const productCode = process.env.ESEWA_PRODUCT_CODE || (isProduction ? '' : 'EPAYTEST');
const secretKey = process.env.ESEWA_SECRET_KEY || (isProduction ? '' : '8gBm/:&EnhH.1/q(');
const configuredPublicUrl = process.env.PUBLIC_URL || '';
const ordersFile = path.join(root, 'orders.json');
const orderRetentionMs = 7 * 24 * 60 * 60 * 1000;

function json(res, status, body) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*'});
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
function getFreshOrders() {
  const cutoff = Date.now() - orderRetentionMs;
  const fresh = readOrders().filter(order => Number.isFinite(Date.parse(order.createdAt)) && Date.parse(order.createdAt) >= cutoff);
  if (fresh.length !== readOrders().length) saveOrders(fresh);
  return fresh;
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
  if (req.method === 'GET' && url.pathname === '/api/orders') return json(res, 200, {orders:getFreshOrders(), retentionDays:7});
  if (req.method === 'POST' && url.pathname === '/api/orders') {
    try {
      const order = await readBody(req);
      if (!order.orderNumber || !order.createdAt || !order.customer?.name || !order.customer?.phone) return json(res, 400, {error:'Required order details are missing.'});
      const orders = getFreshOrders().filter(item => item.orderNumber !== order.orderNumber);
      orders.push({...order, syncedAt:new Date().toISOString()});
      saveOrders(orders);
      return json(res, 201, {ok:true, orderNumber:order.orderNumber, retentionDays:7});
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
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, {ok:true, esewaEnvironment:esewaEnv, configured:Boolean(productCode && secretKey)});
  serveStatic(req, res, url.pathname);
});

server.listen(port, () => console.log(`Shree Devi site running at http://localhost:${port}`));
