import { pool } from "../config/database.js";

export const bloquearUsuario = async (idUsuario, executor) => {
    const [rows] = await executor.execute(`
        SELECT id_usuario
        FROM usuarios
        WHERE id_usuario = ?
        FOR UPDATE
    `, [idUsuario]);

    return Boolean(rows[0]);
};

export const obtenerActivoPorUsuario = async (
    idUsuario,
    executor = pool,
    forUpdate = false
) => {
    const lockClause = forUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute(`
        SELECT id_carrito, id_usuario, estado, created_at, updated_at
        FROM carritos
        WHERE id_usuario = ?
          AND estado = 'ACTIVO'
        ORDER BY id_carrito DESC
        LIMIT 1
        ${lockClause}
    `, [idUsuario]);

    return rows[0] || null;
};

export const crearCarrito = async (idUsuario, executor) => {
    const [result] = await executor.execute(`
        INSERT INTO carritos (id_usuario, estado)
        VALUES (?, 'ACTIVO')
    `, [idUsuario]);

    return {
        id_carrito: result.insertId,
        id_usuario: idUsuario,
        estado: "ACTIVO"
    };
};

export const obtenerVarianteParaCarrito = async (idVariante, executor) => {
    const [rows] = await executor.execute(`
        SELECT
            vp.id_variante,
            vp.activo AS variante_activa,
            COALESCE(vp.precio_oferta, vp.precio) AS precio_actual,
            p.estado AS producto_estado,
            GREATEST(
                COALESCE(i.stock_actual, 0) - COALESCE(i.stock_reservado, 0),
                0
            ) AS stock_disponible
        FROM variantes_producto vp
        INNER JOIN productos p
            ON p.id_producto = vp.id_producto
        LEFT JOIN inventario i
            ON i.id_variante = vp.id_variante
        WHERE vp.id_variante = ?
        LIMIT 1
        FOR UPDATE
    `, [idVariante]);

    return rows[0] || null;
};

export const obtenerItem = async (idCarrito, idVariante, executor) => {
    const [rows] = await executor.execute(`
        SELECT id_detalle_carrito, id_carrito, id_variante, cantidad
        FROM detalle_carrito
        WHERE id_carrito = ?
          AND id_variante = ?
        LIMIT 1
        FOR UPDATE
    `, [idCarrito, idVariante]);

    return rows[0] || null;
};

export const insertarItem = async ({
    idCarrito,
    idVariante,
    cantidad,
    precioUnitario
}, executor) => {
    await executor.execute(`
        INSERT INTO detalle_carrito (
            id_carrito,
            id_variante,
            cantidad,
            precio_unitario
        ) VALUES (?, ?, ?, ?)
    `, [idCarrito, idVariante, cantidad, precioUnitario]);
};

export const actualizarItem = async ({
    idCarrito,
    idVariante,
    cantidad,
    precioUnitario
}, executor) => {
    await executor.execute(`
        UPDATE detalle_carrito
        SET cantidad = ?,
            precio_unitario = ?
        WHERE id_carrito = ?
          AND id_variante = ?
    `, [cantidad, precioUnitario, idCarrito, idVariante]);
};

export const eliminarItem = async (idCarrito, idVariante, executor) => {
    const [result] = await executor.execute(`
        DELETE FROM detalle_carrito
        WHERE id_carrito = ?
          AND id_variante = ?
    `, [idCarrito, idVariante]);

    return result.affectedRows > 0;
};

export const actualizarFechaCarrito = async (idCarrito, executor) => {
    await executor.execute(`
        UPDATE carritos
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id_carrito = ?
    `, [idCarrito]);
};

export const obtenerItems = async (idCarrito, executor = pool) => {
    const [rows] = await executor.execute(`
        SELECT
            dc.id_detalle_carrito,
            dc.id_variante,
            dc.cantidad,
            dc.precio_unitario,
            vp.sku,
            vp.nombre_variante,
            vp.presentacion,
            vp.activo AS variante_activa,
            p.id_producto,
            p.nombre AS producto,
            p.slug,
            p.estado AS producto_estado,
            m.nombre AS marca,
            GREATEST(
                COALESCE(i.stock_actual, 0) - COALESCE(i.stock_reservado, 0),
                0
            ) AS stock_disponible,
            (
                SELECT ip.url_imagen
                FROM imagenes_producto ip
                WHERE ip.id_producto = p.id_producto
                ORDER BY ip.es_principal DESC, ip.orden_visual ASC, ip.id_imagen ASC
                LIMIT 1
            ) AS imagen_principal
        FROM detalle_carrito dc
        INNER JOIN variantes_producto vp
            ON vp.id_variante = dc.id_variante
        INNER JOIN productos p
            ON p.id_producto = vp.id_producto
        LEFT JOIN marcas m
            ON m.id_marca = p.id_marca
        LEFT JOIN inventario i
            ON i.id_variante = vp.id_variante
        WHERE dc.id_carrito = ?
        ORDER BY dc.created_at ASC, dc.id_detalle_carrito ASC
    `, [idCarrito]);

    return rows;
};
