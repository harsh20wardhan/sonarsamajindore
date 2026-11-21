const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 
  process.env.SUPABASE_DB_URL || 
  'postgresql://postgres:Sonarsamaj%40123@db.micvzfznrwcnfsojyscf.supabase.co:5432/postgres';

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }
  return pool;
}

module.exports = { getPool };
