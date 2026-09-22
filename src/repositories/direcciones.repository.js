import { pool } from "../config/database.js";

const addressColumns = `
    id_direccion, id_usuario, alias_direccion, receptor, telefono_contacto,
    direccion_linea1, direccion_linea2, distrito, provincia, departamento,
    codigo_postal, referencia, es_principal, estado, created_at, updated_at
`;

export const bloquearUsuario = async (idUsuario, executor) => {
    const [rows] = await executor.execute(`
        SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND estado = TRUE FOR UPDATE
    `, [idUsuario]);

    return Boolean(rows[0]);
};

export const listarActivas = async (idUsuario, executor = pool) => {
    const [rows] = await executor.execute(`
        SELECT ${addressColumns}
        FROM direcciones
        WHERE id_usuario = ? AND estado = TRUE
        ORDER BY es_principal DESC, id_direccion ASC
    `, [idUsuario]);

    return rows;
};

export const obtenerActiva = async (idUsuario, idDireccion, executor = pool) => {
    const [rows] = await executor.execute(`
        SELECT ${addressColumns}
        FROM direcciones
        WHERE id_usuario = ? AND id_direccion = ? AND estado = TRUE
        LIMIT 1
    `, [idUsuario, idDireccion]);

    return rows[0] || null;
};

export const crear = async (idUsuario, data, esPrincipal, executor) => {
    const [result] = await executor.execute(`
        INSERT INTO direcciones (
            id_usuario, alias_direccion, receptor, telefono_contacto,
            direccion_linea1, direccion_linea2, distrito, provincia,
            departamento, codigo_postal, referencia, es_principal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        idUsuario, data.alias_direccion ?? null, data.receptor,
        data.telefono_contacto, data.direccion_linea1,
        data.direccion_linea2 ?? null, data.distrito, data.provincia,
        data.departamento, data.codigo_postal ?? null,
        data.referencia ?? null, esPrincipal
    ]);

    return result.insertId;
};

const editableColumns = Object.freeze([
    "alias_direccion", "receptor", "telefono_contacto", "direccion_linea1",
    "direccion_linea2", "distrito", "provincia", "departamento",
    "codigo_postal", "referencia"
]);

export const actualizar = async (idUsuario, idDireccion, data, executor) => {
    const columns = editableColumns.filter((column) => Object.hasOwn(data, column));
    const assignments = columns.map((column) => `${column} = ?`).join(", ");

    await executor.execute(`
        UPDATE direcciones SET ${assignments}
        WHERE id_usuario = ? AND id_direccion = ? AND estado = TRUE
    `, [...columns.map((column) => data[column]), idUsuario, idDireccion]);
};

export const quitarPrincipal = async (idUsuario, executor) => {
    await executor.execute(`
        UPDATE direcciones SET es_principal = FALSE
        WHERE id_usuario = ? AND estado = TRUE AND es_principal = TRUE
    `, [idUsuario]);
};

export const asignarPrincipal = async (idUsuario, idDireccion, executor) => {
    await executor.execute(`
        UPDATE direcciones SET es_principal = TRUE
        WHERE id_usuario = ? AND id_direccion = ? AND estado = TRUE
    `, [idUsuario, idDireccion]);
};

export const desactivar = async (idUsuario, idDireccion, executor) => {
    await executor.execute(`
        UPDATE direcciones SET estado = FALSE, es_principal = FALSE
        WHERE id_usuario = ? AND id_direccion = ? AND estado = TRUE
    `, [idUsuario, idDireccion]);
};

export const primeraActiva = async (idUsuario, executor) => {
    const [rows] = await executor.execute(`
        SELECT id_direccion FROM direcciones
        WHERE id_usuario = ? AND estado = TRUE
        ORDER BY id_direccion ASC LIMIT 1
    `, [idUsuario]);

    return rows[0] || null;
};
