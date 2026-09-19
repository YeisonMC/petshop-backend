const mysql = require("mysql2/promise");
const env = require("./env");

const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

const verificarConexion = async () => {
    const connection = await pool.getConnection();

    try {
        await connection.ping();
    } finally {
        connection.release();
    }
};

const cerrarPool = async () => {
    await pool.end();
};

module.exports = {
    pool,
    verificarConexion,
    cerrarPool
};
