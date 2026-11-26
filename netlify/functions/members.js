const { getPool } = require('./db');
const { requireAdmin } = require('./auth');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const pool = getPool();

  try {
    // ── GET: View all member registrations (for admin) ──
    if (event.httpMethod === 'GET') {
      const auth = requireAdmin(event, headers);
      if (!auth.ok) return auth.response;

      const res = await pool.query(`
        SELECT * FROM public.member_registrations 
        ORDER BY created_at DESC 
        LIMIT 200
      `);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ members: res.rows })
      };
    }

    // ── POST: Submit new membership application ──
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body || '{}');
      if (!data.name || !data.phone) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Name and phone are required.' })
        };
      }

      const query = `
        INSERT INTO public.member_registrations (
          name, father_or_husband, gotra, phone, whatsapp, email,
          address, city, state, occupation, business_name, education,
          blood_group, family_members_count, notes, status, dob, date_of_birth, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
        RETURNING id, name, phone, blood_group, dob, created_at;
      `;

      const values = [
        data.name,
        data.father_or_husband || '',
        data.gotra || '',
        data.phone,
        data.whatsapp || data.phone,
        data.email || '',
        data.address || '',
        data.city || 'Indore',
        data.state || 'Madhya Pradesh',
        data.occupation || '',
        data.business_name || '',
        data.education || '',
        data.blood_group || data.bloodgroup || '',
        parseInt(data.family_members_count) || 1,
        data.notes || data.message || '',
        'new',
        data.dob || data.date_of_birth || '',
        data.dob || data.date_of_birth || ''
      ];

      const res = await pool.query(query, values);
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'सदस्यता नोंदणी यशस्वीरित्या झाली आहे! (Member registration submitted successfully)',
          member: res.rows[0]
        })
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('Error in members function:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
