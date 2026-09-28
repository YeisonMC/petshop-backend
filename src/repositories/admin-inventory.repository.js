import { pool } from "../config/database.js";

const fromClause = `
    FROM inventario i
    INNER JOIN variantes_producto vp ON vp.id_variante = i.id_variante
    INNER JOIN productos p ON p.id_producto = vp.id_producto
`;

export const listar = async ({ page, limit, search, bajo_minimo }) => {
    const conditions = [];
    const params = [];
    if (search) {
        conditions.push("(p.nombre LIKE ? OR vp.sku LIKE ? OR vp.nombre_variante LIKE ?)");
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (bajo_minimo === "true") conditions.push("i.stock_actual - i.stock_reservado <= i.stock_minimo");
    if (bajo_minimo === "false") conditions.push("i.stock_actual - i.stock_reservado > i.stock_minimo");
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [[count]] = await pool.execute(`SELECT COUNT(*) AS total ${fromClause} ${where}`, params);
    const [rows] = await pool.execute(`
        SELECT i.id_variante, i.stock_actual, i.stock_reservado,
            i.stock_actual - i.stock_reservado AS stock_disponible,
            i.stock_minimo, i.ubicacion_almacen, i.fecha_actualizacion,
            vp.sku, vp.nombre_variante, vp.activo AS variante_activa,
            p.id_producto, p.nombre AS producto, p.estado AS producto_estado
        ${fromClause} ${where}
        ORDER BY (i.stock_actual - i.stock_reservado <= i.stock_minimo) DESC,
            p.nombre ASC, vp.id_variante ASC LIMIT ? OFFSET ?
    `, [...params, limit, (page - 1) * limit]);
    return { rows, total: Number(count.total) };
};

export const obtenerBloqueado = async (idVariante, executor) => {
    const [[row]] = await executor.execute(`
        SELECT id_variante, stock_actual, stock_reservado, stock_minimo, ubicacion_almacen
        FROM inventario WHERE id_variante = ? LIMIT 1 FOR UPDATE
    `, [idVariante]);
    return row || null;
};

export const actualizarConfiguracion = async (idVariante, data, executor) => {
    const fields = ["stock_minimo", "ubicacion_almacen"].filter((key) => data[key] !== undefined);
    await executor.execute(
        `UPDATE inventario SET ${fields.map((key) => `${key} = ?`).join(", ")} WHERE id_variante = ?`,
        [...fields.map((key) => data[key]), idVariante]
    );
};

export const actualizarStock = async (idVariante, stockNuevo, executor) => {
    await executor.execute("UPDATE inventario SET stock_actual = ? WHERE id_variante = ?", [stockNuevo, idVariante]);
};

export const registrarMovimiento = async ({ idVariante, tipo, cantidad, motivo, referencia, anterior, nuevo }, executor) => {
    await executor.execute(`
        INSERT INTO movimientos_inventario (
            id_variante, tipo_movimiento, cantidad, motivo, referencia,
            stock_anterior, stock_nuevo
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [idVariante, tipo, cantidad, motivo, referencia, anterior, nuevo]);
};

export const listarMovimientos = async (idVariante) => {
    const [rows] = await pool.execute(`
        SELECT id_movimiento, tipo_movimiento, cantidad, motivo, referencia,
            stock_anterior, stock_nuevo, fecha_movimiento
        FROM movimientos_inventario WHERE id_variante = ?
        ORDER BY fecha_movimiento DESC, id_movimiento DESC LIMIT 50
    `, [idVariante]);
    return rows;
};
