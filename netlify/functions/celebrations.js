const { getPool } = require('./db');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
};

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const pool = getPool();

  try {
    if (event.httpMethod === 'GET') {
      const res = await pool.query(`
        SELECT * FROM public.celebrations 
        WHERE is_active = true 
        ORDER BY created_at DESC
      `);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ celebrations: res.rows })
      };
    }

    if (event.httpMethod === 'POST') {
      const d = JSON.parse(event.body || '{}');
      if (!d.name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Name is required' }) };
      }

      const id = d.id || ('celeb-' + Date.now());
      const query = `
        INSERT INTO public.celebrations (
          id, name, type, date_display, date_month, date_day, year, area, message, photo_url, is_active, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          date_display = EXCLUDED.date_display,
          area = EXCLUDED.area,
          message = EXCLUDED.message
        RETURNING *;
      `;

      const values = [
        id,
        d.name,
        d.type || 'birthday',
        d.date_display || d.date || '',
        d.date_month || null,
        d.date_day || null,
        d.year || 2026,
        d.area || '',
        d.message || '',
        d.photo_url || ''
      ];

      const res = await pool.query(query, values);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, celebration: res.rows[0] })
      };
    }

    if (event.httpMethod === 'DELETE') {
      const id = (event.queryStringParameters && event.queryStringParameters.id) ||
                 (event.body ? JSON.parse(event.body).id : null);
      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID is required' }) };
      }
      await pool.query('DELETE FROM public.celebrations WHERE id = $1', [id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, deletedId: id }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('Error in celebrations function:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
