'use strict';
const { sb, requireAdmin, allowMethods, genCode } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!await requireAdmin(req, res)) return;
  const { customer_id } = req.body || {};
  if (!customer_id) return res.status(400).json({ error: 'Missing customer_id' });
  try {
    const code = genCode('XW-', 6);
    await sb('POST', 'access_codes', {
      body: { customer_id, code },
      prefer: 'return=minimal',
    });
    res.json({ code });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
