import { pool } from "../config/database.js";

export const obtenerTodas = async () => {
    const [rows] = await pool.execute(`
        SELECT
            c.id_categoria,
            c.id_categoria_padre,
            c.nombre,
            c.slug,
            c.descripcion,
            padre.nombre AS categoria_padre,
            COUNT(DISTINCT p.id_producto) AS cantidad_productos
        FROM categorias c
        LEFT JOIN categorias padre
            ON padre.id_categoria = c.id_categoria_padre
        LEFT JOIN producto_categoria pc
            ON pc.id_categoria = c.id_categoria
        LEFT JOIN productos p
            ON p.id_producto = pc.id_producto
           AND p.estado = 'ACTIVO'
        WHERE c.estado = TRUE
        GROUP BY
            c.id_categoria,
            c.id_categoria_padre,
            c.nombre,
            c.slug,
            c.descripcion,
            padre.nombre
        ORDER BY
            c.id_categoria_padre IS NOT NULL,
            COALESCE(padre.nombre, c.nombre),
            c.nombre
    `);

    return rows;
};
