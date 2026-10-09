import { pool } from "../config/database.js";

const columns = `
    id_pago, id_pedido, metodo_pago, monto, moneda, estado,
    referencia_transaccion, fecha_pago
`;

export const obtenerPorPedido = async (idPedido, executor = pool) => {
    const [rows] = await executor.execute(`
        SELECT ${columns} FROM pagos
        WHERE id_pedido = ? ORDER BY id_pago DESC LIMIT 1
    `, [idPedido]);

    return rows[0] || null;
};

export const crear = async (idPedido, monto, intentId, executor) => {
    await executor.execute(`
        INSERT INTO pagos (
            id_pedido, metodo_pago, monto, moneda, estado, referencia_transaccion
        ) VALUES (?, 'TARJETA', ?, 'PEN', 'PENDIENTE', ?)
    `, [idPedido, monto, intentId]);
};

export const marcarAprobado = async (idPago, executor) => {
    const [result] = await executor.execute(`
        UPDATE pagos SET estado = 'APROBADO', fecha_pago = CURRENT_TIMESTAMP
        WHERE id_pago = ? AND estado = 'PENDIENTE'
    `, [idPago]);

    return result.affectedRows === 1;
};

export const marcarRechazado = async (idPago, executor) => {
    await executor.execute(`
        UPDATE pagos SET estado = 'RECHAZADO'
        WHERE id_pago = ? AND estado = 'PENDIENTE'
    `, [idPago]);
};
