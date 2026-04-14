'use strict';
// ─── Env vars (set in Vercel Dashboard, never in browser) ───
const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_KEY;
const JWT_SEC = process.env.JWT_SECRET;

// ─── Supabase REST helper ────────────────────────────────────
async function sb(method, table, { body, q = '', prefer } = {}) {
  const h = {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) h.Prefer = prefer;
  const r = await fetch(`${SB_URL}/rest/v1/${table}${q ? '?' + q : ''}`, {
    method, headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

// ─── JWT (HMAC-SHA256, Node crypto) ──────────────────────────
const { createHmac } = require('crypto');
function b64url(str) { return Buffer.from(str).toString('base64url'); }
function signJWT(payload) {
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const b = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', JWT_SEC).update(`${h}.${b}`).digest('base64url');
  return `${h}.${b}.${sig}`;
}
function verifyJWT(token) {
  if (!token || typeof token !== 'string') return null;
  const [h, b, sig] = token.split('.');
  if (!h || !b || !sig) return null;
  const expected = createHmac('sha256', JWT_SEC).update(`${h}.${b}`).digest('base64url');
  if (sig !== expected) return null;
  const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// ─── HTTP helpers ────────────────────────────────────────────
function getToken(req) {
  const a = req.headers.authorization || '';
  return a.startsWith('Bearer ') ? a.slice(7) : null;
}
async function requireAdmin(req, res) {
  const p = verifyJWT(getToken(req));
  if (!p || p.role !== 'admin') { res.status(401).json({ error: 'Unauthorized' }); return null; }
  return p;
}
async function requireGuide(req, res) {
  const p = verifyJWT(getToken(req));
  if (!p || p.role !== 'guide') { res.status(401).json({ error: 'Unauthorized' }); return null; }
  return p;
}
function allowMethods(req, res, methods) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return false; }
  if (!methods.includes(req.method)) { res.status(405).json({ error: 'Method not allowed' }); return false; }
  return true;
}

// ─── Code generator ─────────────────────────────────────────
function genCode(prefix, len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = prefix;
  for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

module.exports = { sb, signJWT, verifyJWT, getToken, requireAdmin, requireGuide, allowMethods, genCode };
