const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 
  process.env.SUPABASE_DB_URL || 
  'postgresql://postgres.micvzfznrwcnfsojyscf:Sonarsamaj%40123@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres';

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
