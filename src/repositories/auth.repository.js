import { pool } from "../config/database.js";

const USER_SELECT = `
    SELECT
        u.id_usuario,
        u.id_rol,
        u.nombres,
        u.apellidos,
        u.correo,
        u.password_hash,
        u.telefono,
        u.dni,
        u.ruc,
        u.estado,
        u.fecha_registro,
        u.ultimo_acceso,
        r.nombre AS rol
    FROM usuarios u
    INNER JOIN roles r
        ON r.id_rol = u.id_rol
`;

export const obtenerPorCorreo = async (correo) => {
    const [rows] = await pool.execute(`
        ${USER_SELECT}
        WHERE u.correo = ?
        LIMIT 1
    `, [correo]);

    return rows[0] || null;
};

export const obtenerPorId = async (idUsuario) => {
    const [rows] = await pool.execute(`
        ${USER_SELECT}
        WHERE u.id_usuario = ?
        LIMIT 1
    `, [idUsuario]);

    return rows[0] || null;
};

export const obtenerRolActivoPorNombre = async (nombre) => {
    const [rows] = await pool.execute(`
        SELECT id_rol, nombre
        FROM roles
        WHERE nombre = ?
          AND estado = TRUE
        LIMIT 1
    `, [nombre]);

    return rows[0] || null;
};

export const crearUsuario = async ({
    idRol,
    nombres,
    apellidos,
    correo,
    passwordHash,
    telefono,
    dni,
    ruc
}) => {
    const [result] = await pool.execute(`
        INSERT INTO usuarios (
            id_rol,
            nombres,
            apellidos,
            correo,
            password_hash,
            telefono,
            dni,
            ruc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        idRol,
        nombres,
        apellidos,
        correo,
        passwordHash,
        telefono || null,
        dni || null,
        ruc || null
    ]);

    return result.insertId;
};

export const actualizarUltimoAcceso = async (idUsuario) => {
    await pool.execute(`
        UPDATE usuarios
        SET ultimo_acceso = CURRENT_TIMESTAMP
        WHERE id_usuario = ?
    `, [idUsuario]);
};
