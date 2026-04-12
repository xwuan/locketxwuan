'use strict';
const { sb, requireAdmin, allowMethods, genCode } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!await requireAdmin(req, res)) return;
  const { name, phone, social_platform, social_link, notes, type, deposit_note, service_status } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Missing name' });
  try {
    const customer_code = genCode('KH-', 8);
    const access_code   = genCode('XW-', 6);
    const [cust] = await sb('POST', 'customers', {
      body: { name, phone: phone || null, social_platform: social_platform || 'zalo', social_link: social_link || null, notes: notes || null, customer_code, type: type || 'baohanh', deposit_note: deposit_note || null, service_status: service_status || 'baohanh' },
      prefer: 'return=representation',
    });
    await sb('POST', 'access_codes', {
      body: { customer_id: cust.id, code: access_code },
      prefer: 'return=minimal',
    });
    res.json({ customer_code, access_code, customer_id: cust.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
