import mysql from "mysql2/promise";

import env from "./env.js";

export let pool = mysql.createPool({
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

export const verificarConexion = async () => {
    const connection = await pool.getConnection();

    try {
        await connection.ping();
    } finally {
        connection.release();
    }
};

export const cerrarPool = async () => {
    await pool.end();
};

export const ejecutarTransaccion = async (callback) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

export const configurarPoolParaPruebas = (poolDePruebas) => {
    if (env.NODE_ENV !== "test") {
        throw new Error("El pool solo puede reemplazarse durante las pruebas");
    }

    pool = poolDePruebas;
};
