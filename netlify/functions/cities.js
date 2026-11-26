const { getPool } = require('./db');
const { requireAdmin } = require('./auth');

const baseHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
};

let schemaReady = false;

async function ensureCitySchema(pool) {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.cities (
      slug TEXT PRIMARY KEY,
      name_mr TEXT NOT NULL,
      name_hi TEXT NOT NULL,
      name_en TEXT NOT NULL,
      tagline_mr TEXT DEFAULT '',
      tagline_hi TEXT DEFAULT '',
      tagline_en TEXT DEFAULT '',
      modules JSONB DEFAULT '{"events":true,"gallery":true}'::jsonb,
      is_active BOOLEAN DEFAULT true,
      sort_order INT DEFAULT 10,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.city_events (
      id TEXT PRIMARY KEY,
      city_slug TEXT NOT NULL REFERENCES public.cities(slug) ON DELETE CASCADE,
      title_mr TEXT NOT NULL,
      title_hi TEXT DEFAULT '',
      title_en TEXT DEFAULT '',
      date_display TEXT DEFAULT '',
      venue TEXT DEFAULT '',
      description_mr TEXT DEFAULT '',
      description_hi TEXT DEFAULT '',
      description_en TEXT DEFAULT '',
      status TEXT DEFAULT 'upcoming',
      photos JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.city_gallery (
      id TEXT PRIMARY KEY,
      city_slug TEXT NOT NULL REFERENCES public.cities(slug) ON DELETE CASCADE,
      year TEXT NOT NULL DEFAULT '2026',
      title_mr TEXT NOT NULL,
      title_hi TEXT DEFAULT '',
      title_en TEXT DEFAULT '',
      date_display TEXT DEFAULT '',
      venue TEXT DEFAULT '',
      description_mr TEXT DEFAULT '',
      description_hi TEXT DEFAULT '',
      description_en TEXT DEFAULT '',
      photos JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_city_events_slug ON public.city_events(city_slug, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_city_gallery_slug_year ON public.city_gallery(city_slug, year DESC, created_at DESC);
  `);
  schemaReady = true;
}

function cleanSlug(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: baseHeaders, body: '' };
  }

  const pool = getPool();

  try {
    await ensureCitySchema(pool);

    if (event.httpMethod === 'GET') {
      const qs = event.queryStringParameters || {};
      const slug = cleanSlug(qs.slug || '');
      const getHeaders = {
        ...baseHeaders,
        'Cache-Control': qs.nocache ? 'no-store' : 'public, max-age=30, stale-while-revalidate=120'
      };

      if (slug) {
        const [cityRes, eventsRes, galleryRes] = await Promise.all([
          pool.query('SELECT * FROM public.cities WHERE slug = $1 AND is_active = true', [slug]),
          pool.query('SELECT * FROM public.city_events WHERE city_slug = $1 ORDER BY created_at DESC', [slug]),
          pool.query('SELECT * FROM public.city_gallery WHERE city_slug = $1 ORDER BY year DESC, created_at DESC', [slug])
        ]);

        if (!cityRes.rows.length) {
          return {
            statusCode: 404,
            headers: baseHeaders,
            body: JSON.stringify({ error: 'City not found' })
          };
        }

        return {
          statusCode: 200,
          headers: getHeaders,
          body: JSON.stringify({
            city: cityRes.rows[0],
            events: eventsRes.rows,
            gallery: galleryRes.rows
          })
        };
      }

      // List cities with event & photo counts
      const includeInactive = qs.all === '1';
      if (includeInactive) {
        const auth = requireAdmin(event, baseHeaders);
        if (!auth.ok) return auth.response;
      }

      const whereClause = includeInactive ? '' : 'WHERE c.is_active = true';
      const listRes = await pool.query(`
        SELECT c.*,
          COALESCE((SELECT COUNT(*) FROM public.city_events e WHERE e.city_slug = c.slug), 0)::int AS events_count,
          COALESCE((
            SELECT SUM(jsonb_array_length(COALESCE(g.photos, '[]'::jsonb)))
            FROM public.city_gallery g WHERE g.city_slug = c.slug
          ), 0)::int AS photos_count
        FROM public.cities c
        ${whereClause}
        ORDER BY c.sort_order ASC, c.name_en ASC
      `);

      return {
        statusCode: 200,
        headers: getHeaders,
        body: JSON.stringify({ cities: listRes.rows })
      };
    }

    // Protected Admin Mutations
    if (event.httpMethod === 'POST') {
      const auth = requireAdmin(event, baseHeaders);
      if (!auth.ok) return auth.response;

      const body = JSON.parse(event.body || '{}');
      const action = body.action || 'upsert_city';

      if (action === 'upsert_city') {
        const slug = cleanSlug(body.slug || body.name_en);
        if (!slug || !body.name_mr) {
          return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: 'City slug and Marathi name are required.' }) };
        }
        const res = await pool.query(`
          INSERT INTO public.cities (
            slug, name_mr, name_hi, name_en, tagline_mr, tagline_hi, tagline_en, modules, is_active, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
          ON CONFLICT (slug) DO UPDATE SET
            name_mr = EXCLUDED.name_mr,
            name_hi = EXCLUDED.name_hi,
            name_en = EXCLUDED.name_en,
            tagline_mr = EXCLUDED.tagline_mr,
            tagline_hi = EXCLUDED.tagline_hi,
            tagline_en = EXCLUDED.tagline_en,
            modules = EXCLUDED.modules,
            is_active = EXCLUDED.is_active,
            sort_order = EXCLUDED.sort_order
          RETURNING *;
        `, [
          slug,
          body.name_mr.trim(),
          (body.name_hi || body.name_mr).trim(),
          (body.name_en || slug).trim(),
          body.tagline_mr || '',
          body.tagline_hi || body.tagline_mr || '',
          body.tagline_en || body.tagline_mr || '',
          JSON.stringify(body.modules || { events: true, gallery: true }),
          body.is_active !== false,
          parseInt(body.sort_order || '10', 10)
        ]);
        return { statusCode: 200, headers: baseHeaders, body: JSON.stringify({ success: true, city: res.rows[0] }) };
      }

      if (action === 'upsert_event') {
        const citySlug = cleanSlug(body.city_slug);
        if (!citySlug || !body.title_mr) {
          return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: 'city_slug and title_mr are required.' }) };
        }
        const id = body.id || (`cev-${citySlug}-${Date.now()}`);
        const res = await pool.query(`
          INSERT INTO public.city_events (
            id, city_slug, title_mr, title_hi, title_en, date_display, venue,
            description_mr, description_hi, description_en, status, photos
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
          ON CONFLICT (id) DO UPDATE SET
            title_mr = EXCLUDED.title_mr,
            title_hi = EXCLUDED.title_hi,
            title_en = EXCLUDED.title_en,
            date_display = EXCLUDED.date_display,
            venue = EXCLUDED.venue,
            description_mr = EXCLUDED.description_mr,
            description_hi = EXCLUDED.description_hi,
            description_en = EXCLUDED.description_en,
            status = EXCLUDED.status,
            photos = EXCLUDED.photos
          RETURNING *;
        `, [
          id, citySlug, body.title_mr.trim(),
          (body.title_hi || body.title_mr).trim(),
          (body.title_en || body.title_mr).trim(),
          body.date_display || '',
          body.venue || '',
          body.description_mr || '',
          body.description_hi || body.description_mr || '',
          body.description_en || body.description_mr || '',
          body.status === 'past' ? 'past' : 'upcoming',
          JSON.stringify(Array.isArray(body.photos) ? body.photos : [])
        ]);
        return { statusCode: 200, headers: baseHeaders, body: JSON.stringify({ success: true, event: res.rows[0] }) };
      }

      if (action === 'upsert_gallery') {
        const citySlug = cleanSlug(body.city_slug);
        if (!citySlug || !body.title_mr) {
          return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: 'city_slug and title_mr are required.' }) };
        }
        const id = body.id || (`cgal-${citySlug}-${Date.now()}`);
        const res = await pool.query(`
          INSERT INTO public.city_gallery (
            id, city_slug, year, title_mr, title_hi, title_en, date_display, venue,
            description_mr, description_hi, description_en, photos
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
          ON CONFLICT (id) DO UPDATE SET
            year = EXCLUDED.year,
            title_mr = EXCLUDED.title_mr,
            title_hi = EXCLUDED.title_hi,
            title_en = EXCLUDED.title_en,
            date_display = EXCLUDED.date_display,
            venue = EXCLUDED.venue,
            description_mr = EXCLUDED.description_mr,
            description_hi = EXCLUDED.description_hi,
            description_en = EXCLUDED.description_en,
            photos = EXCLUDED.photos
          RETURNING *;
        `, [
          id, citySlug, String(body.year || '2026'),
          body.title_mr.trim(),
          (body.title_hi || body.title_mr).trim(),
          (body.title_en || body.title_mr).trim(),
          body.date_display || '',
          body.venue || '',
          body.description_mr || '',
          body.description_hi || body.description_mr || '',
          body.description_en || body.description_mr || '',
          JSON.stringify(Array.isArray(body.photos) ? body.photos : [])
        ]);
        return { statusCode: 200, headers: baseHeaders, body: JSON.stringify({ success: true, album: res.rows[0] }) };
      }

      return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: 'Invalid action' }) };
    }

    if (event.httpMethod === 'DELETE') {
      const auth = requireAdmin(event, baseHeaders);
      if (!auth.ok) return auth.response;

      const qs = event.queryStringParameters || {};
      const body = event.body ? JSON.parse(event.body) : {};
      const type = qs.type || body.type;
      const id = qs.id || body.id;

      if (!type || !id) {
        return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: 'type and id are required.' }) };
      }

      if (type === 'city') {
        await pool.query('DELETE FROM public.cities WHERE slug = $1', [cleanSlug(id)]);
      } else if (type === 'event') {
        await pool.query('DELETE FROM public.city_events WHERE id = $1', [id]);
      } else if (type === 'gallery') {
        await pool.query('DELETE FROM public.city_gallery WHERE id = $1', [id]);
      } else {
        return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: 'Invalid type' }) };
      }

      return { statusCode: 200, headers: baseHeaders, body: JSON.stringify({ success: true, deletedId: id }) };
    }

    return { statusCode: 405, headers: baseHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('Error in cities function:', err);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ error: err.message })
    };
  }
};
