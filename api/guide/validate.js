'use strict';
const { sb, signJWT, allowMethods } = require('../_lib/utils');
const { randomUUID } = require('crypto');

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code' });
  const upperCode = code.trim().toUpperCase();

  try {
    // 1. Validate code
    const codes = await sb('GET', 'access_codes', {
      q: `code=eq.${encodeURIComponent(upperCode)}&is_active=eq.true`,
    });
    if (!codes?.length) return res.status(403).json({ error: 'Mã không hợp lệ hoặc đã vô hiệu hóa' });
    const codeRow = codes[0];

    // 2. Check completed
    if (codeRow.completed_at) return res.status(403).json({ error: 'Mã này đã được sử dụng xong' });

    // 3. Check expiry
    if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date())
      return res.status(403).json({ error: 'Mã đã hết hiệu lực (2 tiếng)' });

    // 4. Xóa session cũ nếu có (cho phép re-entry)
    await sb('DELETE', 'sessions', {
      q: `access_code=eq.${encodeURIComponent(upperCode)}`,
    });

    // 5. Tăng entry_count — đếm số lần nhập mã để phát hiện share
    const newCount = (codeRow.entry_count || 0) + 1;
    const patchBody = { entry_count: newCount };

    // 6. Activate code if first use
    let expiresAt = codeRow.expires_at;
    if (!codeRow.activated_at) {
      const activated_at = new Date().toISOString();
      expiresAt = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
      patchBody.activated_at = activated_at;
      patchBody.expires_at = expiresAt;
    }
    await sb('PATCH', 'access_codes', { q: `id=eq.${codeRow.id}`, body: patchBody });

    // 7. Create new session
    const sessionToken = randomUUID();
    await sb('POST', 'sessions', {
      body: { access_code: upperCode, session_token: sessionToken },
      prefer: 'return=minimal',
    });

    // 8. Sign guide JWT
    const exp = Math.floor(new Date(expiresAt).getTime() / 1000);
    const guideToken = signJWT({ role: 'guide', code: upperCode, sessionToken, exp });

    res.json({ token: guideToken, expires_at: expiresAt });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
