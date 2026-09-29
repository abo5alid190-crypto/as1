const crypto = require('crypto');

const SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

const PARTNER_USER_ID =
  'a9fce7df-7ce4-426f-8306-1e2021ba3599';

function base64url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function makeToken(userId) {
  const cleanId = String(userId).replace(/-/g, '');
  const uuidBytes = Buffer.from(cleanId, 'hex');

  if (uuidBytes.length !== 16) {
    throw new Error('Invalid partner user UUID');
  }

  const payload = base64url(uuidBytes);
  const signature = crypto
    .createHmac('sha256', SERVICE_KEY)
    .update('v2:' + payload)
    .digest()
    .subarray(0, 10);

  return payload + '.' + base64url(signature);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SERVICE_KEY) {
    return res.status(500).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is not configured'
    });
  }

  try {
    const token = makeToken(PARTNER_USER_ID);

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({ token });
  } catch (error) {
    console.error('default-partner-token error:', error);
    return res.status(500).json({
      error: 'Unable to create default partner token',
      details: error?.message || String(error)
    });
  }
};
