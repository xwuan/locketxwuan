'use strict';
const { sb, requireGuide, allowMethods } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  const payload = await requireGuide(req, res);
  if (!payload) return;

  try {
    const sessions = await sb('GET', 'sessions', {
      q: `session_token=eq.${encodeURIComponent(payload.sessionToken)}`,
    });
    if (!sessions?.length || sessions[0].is_kicked)
      return res.json({ kicked: true });

    // Check code still active
    const codes = await sb('GET', 'access_codes', {
      q: `code=eq.${encodeURIComponent(payload.code)}&is_active=eq.true`,
    });
    if (!codes?.length) return res.json({ expired: true });

    // Update ping
    await sb('PATCH', 'sessions', {
      q: `session_token=eq.${encodeURIComponent(payload.sessionToken)}`,
      body: { last_ping: new Date().toISOString() },
    });

    // 🧹 Fire-and-forget: xóa session rác (không ping > 3 tiếng)
    const cutoff = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    sb('DELETE', 'sessions', {
      q: `last_ping=lt.${encodeURIComponent(cutoff)}&is_kicked=eq.false`,
    }).catch(() => {}); // bỏ qua lỗi, không block response

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
