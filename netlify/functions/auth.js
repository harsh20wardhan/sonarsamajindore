const crypto = require('crypto');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Sonarsamaj@2026';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSigningSecret() {
  return process.env.ADMIN_AUTH_SECRET || crypto
    .createHash('sha256')
    .update(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}:sonar-samaj-admin-v1`)
    .digest('hex');
}

function sha256Equal(a, b) {
  const ha = crypto.createHash('sha256').update(String(a || '')).digest();
  const hb = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function verifyCredentials(username, password) {
  return sha256Equal(String(username || '').trim(), ADMIN_USERNAME) &&
         sha256Equal(String(password || ''), ADMIN_PASSWORD);
}

function createToken(username) {
  const now = Date.now();
  const payload = {
    sub: username,
    role: 'admin',
    iat: now,
    exp: now + TOKEN_TTL_MS
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningSecret()).update(encoded).digest('base64url');
  return {
    token: `${encoded}.${sig}`,
    expiresAt: payload.exp
  };
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getSigningSecret()).update(encoded).digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload || payload.role !== 'admin' || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function extractBearerToken(event) {
  const headers = event.headers || {};
  const authHeader = headers.authorization || headers.Authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function requireAdmin(event, corsHeaders = {}) {
  const token = extractBearerToken(event);
  const payload = verifyToken(token);
  if (!payload) {
    return {
      ok: false,
      response: {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ error: 'Unauthorized: Admin login required.' })
      }
    };
  }
  return { ok: true, user: payload };
}

module.exports = {
  verifyCredentials,
  createToken,
  verifyToken,
  requireAdmin
};
