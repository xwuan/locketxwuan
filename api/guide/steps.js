'use strict';
const { sb, requireGuide, allowMethods } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return;
  const payload = await requireGuide(req, res);
  if (!payload) return;

  try {
    // Verify session still valid and not kicked
    const sessions = await sb('GET', 'sessions', {
      q: `session_token=eq.${encodeURIComponent(payload.sessionToken)}&is_kicked=eq.false`,
    });
    if (!sessions?.length) return res.status(403).json({ error: 'Phiên đã bị kết thúc' });

    const steps = await sb('GET', 'guide_steps', { q: 'order=order_num.asc' }) || [];
    res.json(steps);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
