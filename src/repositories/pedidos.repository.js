import { pool } from "../config/database.js";

const pedidoColumns = `
    id_pedido, id_usuario, id_direccion, codigo_pedido, fecha_pedido,
    reserva_expira_at, estado, subtotal, descuento, costo_envio, total,
    observaciones, created_at, updated_at
`;

export const bloquearUsuario = async (idUsuario, executor) => {
    const [rows] = await executor.execute(`
        SELECT id_usuario FROM usuarios
        WHERE id_usuario = ? AND estado = TRUE
        FOR UPDATE
    `, [idUsuario]);

    return Boolean(rows[0]);
};

export const obtenerDireccionActiva = async (idUsuario, idDireccion, executor) => {
    const [rows] = await executor.execute(`
        SELECT id_direccion FROM direcciones
        WHERE id_usuario = ? AND id_direccion = ? AND estado = TRUE
        LIMIT 1 FOR UPDATE
    `, [idUsuario, idDireccion]);

    return rows[0] || null;
};

export const obtenerCarritoActivo = async (idUsuario, executor) => {
    const [rows] = await executor.execute(`
        SELECT id_carrito FROM carritos
        WHERE id_usuario = ? AND estado = 'ACTIVO'
        ORDER BY id_carrito DESC LIMIT 1 FOR UPDATE
    `, [idUsuario]);

    return rows[0] || null;
};

export const obtenerItemsCarrito = async (idCarrito, executor) => {
    const [rows] = await executor.execute(`
        SELECT id_variante, cantidad FROM detalle_carrito
        WHERE id_carrito = ?
        ORDER BY id_variante ASC FOR UPDATE
    `, [idCarrito]);

    return rows;
};

export const obtenerVariante = async (idVariante, executor) => {
    const [rows] = await executor.execute(`
        SELECT vp.id_variante, vp.sku, vp.activo AS variante_activa,
            COALESCE(vp.precio_oferta, vp.precio) AS precio_actual,
            p.nombre AS nombre_producto, p.estado AS producto_estado,
            i.stock_actual, i.stock_reservado
        FROM variantes_producto vp
        INNER JOIN productos p ON p.id_producto = vp.id_producto
        LEFT JOIN inventario i ON i.id_variante = vp.id_variante
        WHERE vp.id_variante = ?
        LIMIT 1 FOR UPDATE
    `, [idVariante]);

    return rows[0] || null;
};

export const crear = async ({
    idUsuario, idDireccion, codigo, subtotal, observaciones
}, executor) => {
    const [result] = await executor.execute(`
        INSERT INTO pedidos (
            id_usuario, id_direccion, codigo_pedido, estado, subtotal,
            descuento, costo_envio, total, observaciones, reserva_expira_at
        ) VALUES (
            ?, ?, ?, 'PENDIENTE', ?, 0, 0, ?, ?,
            DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)
        )
    `, [idUsuario, idDireccion, codigo, subtotal, subtotal, observaciones]);

    return result.insertId;
};

export const crearDetalle = async (idPedido, item, executor) => {
    await executor.execute(`
        INSERT INTO detalle_pedido (
            id_pedido, id_variante, nombre_producto, sku, cantidad,
            precio_unitario, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        idPedido, item.idVariante, item.nombreProducto, item.sku,
        item.cantidad, item.precioUnitario, item.subtotal
    ]);
};

export const reservarStock = async (idVariante, cantidad, executor) => {
    const [result] = await executor.execute(`
        UPDATE inventario
        SET stock_reservado = stock_reservado + ?
        WHERE id_variante = ? AND stock_actual - stock_reservado >= ?
    `, [cantidad, idVariante, cantidad]);

    return result.affectedRows === 1;
};

export const liberarStock = async (idVariante, cantidad, executor) => {
    const [result] = await executor.execute(`
        UPDATE inventario
        SET stock_reservado = stock_reservado - ?
        WHERE id_variante = ? AND stock_reservado >= ?
    `, [cantidad, idVariante, cantidad]);

    return result.affectedRows === 1;
};

export const registrarMovimiento = async ({
    idVariante, tipo, cantidad, motivo, referencia, stockAnterior, stockNuevo
}, executor) => {
    await executor.execute(`
        INSERT INTO movimientos_inventario (
            id_variante, tipo_movimiento, cantidad, motivo, referencia,
            stock_anterior, stock_nuevo
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [idVariante, tipo, cantidad, motivo, referencia, stockAnterior, stockNuevo]);
};

export const convertirCarrito = async (idCarrito, executor) => {
    const [result] = await executor.execute(`
        UPDATE carritos SET estado = 'CONVERTIDO'
        WHERE id_carrito = ? AND estado = 'ACTIVO'
    `, [idCarrito]);

    return result.affectedRows === 1;
};

export const listar = async (idUsuario, executor = pool) => {
    const [rows] = await executor.execute(`
        SELECT ${pedidoColumns} FROM pedidos
        WHERE id_usuario = ?
        ORDER BY fecha_pedido DESC, id_pedido DESC
    `, [idUsuario]);

    return rows;
};

export const obtener = async (idUsuario, idPedido, executor = pool) => {
    const [rows] = await executor.execute(`
        SELECT ${pedidoColumns} FROM pedidos
        WHERE id_usuario = ? AND id_pedido = ? LIMIT 1
    `, [idUsuario, idPedido]);

    return rows[0] || null;
};

export const obtenerBloqueado = async (idPedido, idUsuario, executor) => {
    const byUser = idUsuario === null ? "" : "AND id_usuario = ?";
    const [rows] = await executor.execute(`
        SELECT ${pedidoColumns} FROM pedidos
        WHERE id_pedido = ? ${byUser}
        LIMIT 1 FOR UPDATE
    `, idUsuario === null ? [idPedido] : [idPedido, idUsuario]);

    return rows[0] || null;
};

export const obtenerVencidoBloqueado = async (idPedido, executor) => {
    const [rows] = await executor.execute(`
        SELECT ${pedidoColumns} FROM pedidos
        WHERE id_pedido = ? AND estado = 'PENDIENTE'
          AND reserva_expira_at IS NOT NULL
          AND reserva_expira_at <= CURRENT_TIMESTAMP
        LIMIT 1 FOR UPDATE
    `, [idPedido]);

    return rows[0] || null;
};

export const obtenerDetalles = async (idPedido, executor = pool) => {
    const [rows] = await executor.execute(`
        SELECT id_detalle_pedido, id_pedido, id_variante, nombre_producto,
            sku, cantidad, precio_unitario, subtotal, created_at
        FROM detalle_pedido WHERE id_pedido = ?
        ORDER BY id_detalle_pedido ASC
    `, [idPedido]);

    return rows;
};

export const marcarCancelado = async (idPedido, executor) => {
    const [result] = await executor.execute(`
        UPDATE pedidos SET estado = 'CANCELADO'
        WHERE id_pedido = ? AND estado = 'PENDIENTE'
    `, [idPedido]);

    return result.affectedRows === 1;
};

export const listarIdsVencidos = async (limit = 100, executor = pool) => {
    const [rows] = await executor.execute(`
        SELECT id_pedido FROM pedidos
        WHERE estado = 'PENDIENTE'
          AND reserva_expira_at IS NOT NULL
          AND reserva_expira_at <= CURRENT_TIMESTAMP
        ORDER BY reserva_expira_at ASC, id_pedido ASC
        LIMIT ?
    `, [limit]);

    return rows.map((row) => row.id_pedido);
};
