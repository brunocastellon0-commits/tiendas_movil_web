import sql from 'mssql';

const sqlConfig: sql.config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DATABASE,
  server: process.env.SQL_SERVER_TUNNEL || '', // URL de Cloudflare
  port: 1433,
  options: {
    encrypt: true, // Obligatorio para conexiones externas/túneles
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Singleton para no saturar de conexiones al cliente
let pool: sql.ConnectionPool | null = null;

export const getSqlConnection = async () => {
  try {
    if (pool) return pool;
    pool = await sql.connect(sqlConfig);
    return pool;
  } catch (err) {
    console.error(' Error de conexión al Adminisis:', err);
    throw err;
  }
};