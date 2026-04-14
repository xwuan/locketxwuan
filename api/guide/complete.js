'use strict';
const { sb, requireGuide, allowMethods } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  const payload = await requireGuide(req, res);
  if (!payload) return;

  const { choice } = req.body || {};

  try {
    const updateBody = { completed_at: new Date().toISOString(), is_active: false };
    if (choice) updateBody.locket_choice = choice;

    await Promise.all([
      sb('PATCH', 'access_codes', {
        q: `code=eq.${encodeURIComponent(payload.code)}`,
        body: updateBody,
      }),
      sb('DELETE', 'sessions', {
        q: `session_token=eq.${encodeURIComponent(payload.sessionToken)}`,
      }),
    ]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
