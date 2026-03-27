'use strict';
const { createHash } = require('crypto');
const { signJWT, allowMethods } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Missing password' });

  const hash = createHash('sha256').update(password).digest('hex');
  if (hash !== process.env.ADMIN_PASSWORD_HASH) {
    // Delay to slow brute force
    await new Promise(r => setTimeout(r, 800));
    return res.status(401).json({ error: 'Wrong password' });
  }

  const token = signJWT({
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 86400, // 24h
  });
  res.json({ token });
};
