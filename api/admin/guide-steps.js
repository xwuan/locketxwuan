'use strict';
const { sb, requireAdmin, allowMethods } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;
  if (!await requireAdmin(req, res)) return;

  try {
    if (req.method === 'GET') {
      const steps = await sb('GET', 'guide_steps', { q: 'order=order_num.asc' }) || [];
      return res.json(steps);
    }

    if (req.method === 'POST') {
      // Nếu có ?action=reorder → logic cũ của reorder-step.js
      if (req.query?.action === 'reorder') {
        const { id_a, order_a, id_b, order_b } = req.body || {};
        if (!id_a || !id_b) return res.status(400).json({ error: 'Missing ids' });
        await Promise.all([
          sb('PATCH', 'guide_steps', { q: `id=eq.${id_a}`, body: { order_num: order_b } }),
          sb('PATCH', 'guide_steps', { q: `id=eq.${id_b}`, body: { order_num: order_a } }),
        ]);
        return res.json({ ok: true });
      }

      // POST thường → tạo step mới
      const { type, title, content, image_url, caption, layout, bg_color } = req.body || {};
      const existing = await sb('GET', 'guide_steps', { q: 'select=order_num&order=order_num.desc&limit=1' }) || [];
      const order_num = existing.length ? (existing[0].order_num + 1) : 1;
      const [step] = await sb('POST', 'guide_steps', {
        body: { type: type||'text', title, content, image_url, caption, layout: layout||'image-left', bg_color: bg_color||'default', order_num },
        prefer: 'return=representation',
      });
      return res.json(step);
    }

    if (req.method === 'PATCH') {
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing id' });
      fields.updated_at = new Date().toISOString();
      await sb('PATCH', 'guide_steps', { q: `id=eq.${id}`, body: fields });
      return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await sb('DELETE', 'guide_steps', { q: `id=eq.${id}` });
      return res.json({ ok: true });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
};
