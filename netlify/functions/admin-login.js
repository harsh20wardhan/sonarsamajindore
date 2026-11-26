const { verifyCredentials, createToken, requireAdmin } = require('./auth');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // GET: Verify current session token
  if (event.httpMethod === 'GET') {
    const auth = requireAdmin(event, headers);
    if (!auth.ok) return auth.response;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ authenticated: true, username: auth.user.sub, expiresAt: auth.user.exp })
    };
  }

  // POST: Authenticate with username & password
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const username = (body.username || '').trim();
      const password = body.password || '';

      if (!username || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Username and password are required.' })
        };
      }

      if (!verifyCredentials(username, password)) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid username or password.' })
        };
      }

      const { token, expiresAt } = createToken(username);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, token, username, expiresAt })
      };
    } catch (err) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid request body.' })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};
