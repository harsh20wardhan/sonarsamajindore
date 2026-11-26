const { getPool } = require('./db');
const { requireAdmin } = require('./auth');

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
    // ── GET: Fetch all businesses ──
    if (event.httpMethod === 'GET') {
      const res = await pool.query(`
        SELECT * FROM public.businesses 
        ORDER BY created_at DESC
      `);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ businesses: res.rows })
      };
    }

    // ── POST: Add or Update business ──
    if (event.httpMethod === 'POST') {
      const auth = requireAdmin(event, headers);
      if (!auth.ok) return auth.response;

      const b = JSON.parse(event.body || '{}');
      if (!b.name_mr || !b.owner_mr) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Name and owner are required fields.' })
        };
      }

      const id = b.id || ('biz-' + Date.now());
      const query = `
        INSERT INTO public.businesses (
          id, name_mr, name_hi, name_en, owner_mr, owner_hi, owner_en,
          category_key, category_mr, category_hi, category_en,
          phone, whatsapp, address_mr, address_hi, address_en,
          description_mr, description_hi, description_en,
          established, verified, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name_mr = EXCLUDED.name_mr,
          name_hi = EXCLUDED.name_hi,
          name_en = EXCLUDED.name_en,
          owner_mr = EXCLUDED.owner_mr,
          owner_hi = EXCLUDED.owner_hi,
          owner_en = EXCLUDED.owner_en,
          category_key = EXCLUDED.category_key,
          category_mr = EXCLUDED.category_mr,
          category_hi = EXCLUDED.category_hi,
          category_en = EXCLUDED.category_en,
          phone = EXCLUDED.phone,
          whatsapp = EXCLUDED.whatsapp,
          address_mr = EXCLUDED.address_mr,
          address_hi = EXCLUDED.address_hi,
          address_en = EXCLUDED.address_en,
          description_mr = EXCLUDED.description_mr,
          description_hi = EXCLUDED.description_hi,
          description_en = EXCLUDED.description_en,
          established = EXCLUDED.established,
          verified = EXCLUDED.verified,
          updated_at = NOW()
        RETURNING *;
      `;

      const values = [
        id,
        b.name_mr, b.name_hi || b.name_mr, b.name_en || b.name_mr,
        b.owner_mr, b.owner_hi || b.owner_mr, b.owner_en || b.owner_mr,
        b.category_key || 'other', b.category_mr || 'व्यवसाय', b.category_hi || 'व्यवसाय', b.category_en || 'Business',
        b.phone || '', b.whatsapp || b.phone || '',
        b.address_mr || '', b.address_hi || b.address_mr || '', b.address_en || b.address_mr || '',
        b.description_mr || b.name_mr, b.description_hi || b.description_mr || b.name_mr, b.description_en || b.description_mr || b.name_mr,
        b.established || '2024',
        b.verified !== false
      ];

      const res = await pool.query(query, values);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, business: res.rows[0] })
      };
    }

    // ── DELETE: Remove business ──
    if (event.httpMethod === 'DELETE') {
      const auth = requireAdmin(event, headers);
      if (!auth.ok) return auth.response;

      const id = (event.queryStringParameters && event.queryStringParameters.id) ||
                 (event.body ? JSON.parse(event.body).id : null);

      if (!id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Business ID is required for deletion.' })
        };
      }

      await pool.query('DELETE FROM public.businesses WHERE id = $1', [id]);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, deletedId: id })
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('Error in businesses function:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
