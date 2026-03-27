'use strict';
const { sb, requireAdmin, allowMethods } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!await requireAdmin(req, res)) return;
  const { session_id } = req.body || {};
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' });
  try {
    // 1. Lấy access_code từ session
    const sessions = await sb('GET', 'sessions', { q: `id=eq.${session_id}&select=access_code` });
    const accessCode = sessions?.[0]?.access_code;

    // 2. Mark session is_kicked
    await sb('PATCH', 'sessions', {
      q: `id=eq.${session_id}`,
      body: { is_kicked: true },
    });

    // 3. Vô hiệu hóa mã truy cập ngay lập tức
    if (accessCode) {
      await sb('PATCH', 'access_codes', {
        q: `code=eq.${accessCode}`,
        body: {
          is_active: false,
          expires_at: new Date().toISOString(),
        },
      });
    }

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
