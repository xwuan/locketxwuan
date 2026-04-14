'use strict';
const { sb, requireAdmin, allowMethods } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return;

  // 🤖 Vercel Cron bypass — chỉ cần ping Supabase để tránh auto-pause
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (isCron) {
    // Chỉ cần 1 query nhẹ để giữ Supabase tỉnh
    try {
      await sb('GET', 'customers', { q: 'select=id&limit=1' });
      return res.json({ ok: true, source: 'cron' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── Normal admin request ──────────────────────────────────────
  if (!await requireAdmin(req, res)) return;
  try {
    const now90s = new Date(Date.now() - 90000).toISOString();
    const [customers, codes, completed, sessions] = await Promise.all([
      sb('GET', 'customers',    { q: 'select=id' }),
      sb('GET', 'access_codes', { q: 'select=id' }),
      sb('GET', 'access_codes', { q: 'completed_at=not.is.null&select=id' }),
      sb('GET', 'sessions',     { q: `is_kicked=eq.false&last_ping=gt.${encodeURIComponent(now90s)}&select=id` }),
    ]);
    res.json({
      customers: customers?.length ?? 0,
      codes:     codes?.length     ?? 0,
      completed: completed?.length ?? 0,
      sessions:  sessions?.length  ?? 0,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
