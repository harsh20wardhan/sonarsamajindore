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
        ORDER BY date_month ASC NULLS LAST, date_day ASC NULLS LAST, created_at DESC
      `);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ celebrations: res.rows })
      };
    }

    if (event.httpMethod === 'POST') {
      const d = JSON.parse(event.body || '{}');
      const upsertQuery = `
        INSERT INTO public.celebrations (
          id, name, type, date_display, date_month, date_day, year, area, message, photo_url, phone, is_active, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          date_display = EXCLUDED.date_display,
          date_month = EXCLUDED.date_month,
          date_day = EXCLUDED.date_day,
          area = EXCLUDED.area,
          message = EXCLUDED.message,
          photo_url = EXCLUDED.photo_url,
          phone = EXCLUDED.phone
        RETURNING *;
      `;

      // Support bulk array upload: { celebrations: [...] } or [...]
      const bulkList = Array.isArray(d) ? d : (Array.isArray(d.celebrations) ? d.celebrations : null);
      if (bulkList) {
        const validItems = bulkList.filter(item => item && String(item.name || '').trim());
        if (!validItems.length) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'No valid records with name found' }) };
        }

        const client = await pool.connect();
        const inserted = [];
        try {
          await client.query('BEGIN');
          const baseTs = Date.now();
          for (let i = 0; i < validItems.length; i++) {
            const item = validItems[i];
            const id = item.id || (`celeb-${baseTs}-${i}`);
            const values = [
              id,
              String(item.name).trim(),
              item.type || 'birthday',
              item.date_display || item.date || '',
              item.date_month ? parseInt(item.date_month) : null,
              item.date_day ? parseInt(item.date_day) : null,
              item.year || 2026,
              item.area || '',
              item.message || '',
              item.photo_url || '',
              item.phone || ''
            ];
            const res = await client.query(upsertQuery, values);
            inserted.push(res.rows[0]);
          }
          await client.query('COMMIT');
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        } finally {
          client.release();
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, count: inserted.length, celebrations: inserted })
        };
      }

      if (!d.name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Name is required' }) };
      }

      const id = d.id || ('celeb-' + Date.now());
      const values = [
        id,
        d.name,
        d.type || 'birthday',
        d.date_display || d.date || '',
        d.date_month ? parseInt(d.date_month) : null,
        d.date_day ? parseInt(d.date_day) : null,
        d.year || 2026,
        d.area || '',
        d.message || '',
        d.photo_url || '',
        d.phone || ''
      ];

      const res = await pool.query(upsertQuery, values);
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
