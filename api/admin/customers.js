'use strict';
const { sb, requireAdmin, allowMethods } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ['GET', 'DELETE', 'PATCH'])) return;
  if (!await requireAdmin(req, res)) return;

  const { id, q, action, code_id } = req.query || {};

  try {
    // ── PATCH ?action=expire ───────────────────────────────────────
    if (req.method === 'PATCH' && action === 'expire') {
      if (!code_id) return res.status(400).json({ error: 'Missing code_id' });
      const codes = await sb('GET', 'access_codes', { q: `id=eq.${code_id}&select=code` }) || [];
      const code = codes[0]?.code;
      if (code) {
        await sb('PATCH', 'sessions', { q: `access_code=eq.${code}`, body: { is_kicked: true } });
      }
      await sb('PATCH', 'access_codes', {
        q: `id=eq.${code_id}`,
        body: { is_active: false, expires_at: new Date().toISOString() },
      });
      return res.json({ ok: true });
    }

    // ── PATCH ?action=update&id=... ────────────────────────────────
    if (req.method === 'PATCH' && action === 'update') {
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { name, phone, social_platform, social_link, notes, type, deposit_note, service_status } = req.body || {};
      const updateBody = {};
      if (name !== undefined)            updateBody.name = name;
      if (phone !== undefined)           updateBody.phone = phone || null;
      if (social_platform !== undefined) updateBody.social_platform = social_platform;
      if (social_link !== undefined)     updateBody.social_link = social_link || null;
      if (notes !== undefined)           updateBody.notes = notes || null;
      if (type !== undefined)            updateBody.type = type;
      if (deposit_note !== undefined)    updateBody.deposit_note = deposit_note || null;
      if (service_status !== undefined)  updateBody.service_status = service_status;
      await sb('PATCH', 'customers', { q: `id=eq.${id}`, body: updateBody });
      return res.json({ ok: true });
    }

    // ── DELETE ?id=... ─────────────────────────────────────────────
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const codes = await sb('GET', 'access_codes', { q: `customer_id=eq.${id}&select=code` }) || [];
      if (codes.length) {
        const codeList = codes.map(c => `"${c.code}"`).join(',');
        await sb('DELETE', 'sessions', { q: `access_code=in.(${codeList})` });
      }
      await sb('DELETE', 'access_codes', { q: `customer_id=eq.${id}` });
      await sb('DELETE', 'customers', { q: `id=eq.${id}` });
      return res.json({ ok: true });
    }

    // ── GET ?action=codes → tất cả mã + thông tin khách ───────────
    if (req.method === 'GET' && action === 'codes') {
      const [allCodes, allCustomers] = await Promise.all([
        sb('GET', 'access_codes', { q: `order=created_at.desc` }),
        sb('GET', 'customers',    { q: `select=id,name,phone,customer_code,type,service_status` }),
      ]);
      const custMap = {};
      (allCustomers || []).forEach(c => { custMap[c.id] = c; });
      let result = (allCodes || []).map(c => ({ ...c, customer: custMap[c.customer_id] || null }));
      if (q) {
        const ql = q.toLowerCase();
        result = result.filter(c =>
          c.code?.toLowerCase().includes(ql) ||
          c.customer?.name?.toLowerCase().includes(ql) ||
          c.customer?.customer_code?.toLowerCase().includes(ql) ||
          c.customer?.phone?.includes(q)
        );
      }
      return res.json(result);
    }

    // ── GET ?id=... → chi tiết 1 khách ────────────────────────────
    if (req.method === 'GET' && id) {
      const [customers, codes] = await Promise.all([
        sb('GET', 'customers',    { q: `id=eq.${id}` }),
        sb('GET', 'access_codes', { q: `customer_id=eq.${id}&order=created_at.desc` }),
      ]);
      if (!customers?.length) return res.status(404).json({ error: 'Not found' });
      return res.json({ customer: customers[0], codes: codes || [] });
    }

    // ── GET → danh sách khách ──────────────────────────────────────
    let query = 'order=created_at.desc';
    if (q) {
      const esc = encodeURIComponent(q);
      query += `&or=(name.ilike.*${esc}*,phone.ilike.*${esc}*,customer_code.ilike.*${esc}*)`;
    }
    const customers = await sb('GET', 'customers', { q: query }) || [];
    res.json(customers);

  } catch (e) { res.status(500).json({ error: e.message }); }
};
