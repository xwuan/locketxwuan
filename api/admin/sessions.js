'use strict';
const { sb, requireAdmin, allowMethods } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return;
  if (!await requireAdmin(req, res)) return;
  try {
    const now90s = new Date(Date.now() - 90000).toISOString();
    const sessions = await sb('GET', 'sessions', {
      q: `is_kicked=eq.false&last_ping=gt.${encodeURIComponent(now90s)}&order=started_at.desc`,
    }) || [];
    if (!sessions.length) return res.json([]);

    // Enrich with customer info
    const codes = sessions.map(s => `"${s.access_code}"`).join(',');
    const acodes = await sb('GET', 'access_codes', {
      q: `code=in.(${codes})&select=code,expires_at,customer_id`,
    }) || [];
    const custIds = [...new Set(acodes.map(a => a.customer_id).filter(Boolean))];
    let custs = [];
    if (custIds.length) {
      custs = await sb('GET', 'customers', {
        q: `id=in.(${custIds.map(c => `"${c}"`).join(',')})&select=id,name,phone,customer_code`,
      }) || [];
    }

    const enriched = sessions.map(s => {
      const ac   = acodes.find(a => a.code === s.access_code);
      const cust = ac ? custs.find(c => c.id === ac.customer_id) : null;
      return {
        id:           s.id,
        access_code:  s.access_code,
        started_at:   s.started_at,
        last_ping:    s.last_ping,
        expires_at:   ac?.expires_at || null,
        customer_name: cust?.name || 'Khách chưa rõ',
        customer_phone: cust?.phone || '—',
        customer_code:  cust?.customer_code || '—',
      };
    });
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
