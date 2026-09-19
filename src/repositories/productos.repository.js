const { pool } = require("../config/database");

const buildProductFilters = (filters) => {
    const clauses = ["p.estado = 'ACTIVO'"];
    const params = [];

    if (filters.search) {
        const search = `%${filters.search}%`;
        clauses.push("(p.nombre LIKE ? OR p.descripcion_corta LIKE ?)");
        params.push(search, search);
    }

    if (filters.categoria) {
        clauses.push(`
            EXISTS (
                SELECT 1
                FROM producto_categoria pc_filter
                INNER JOIN categorias c_filter
                    ON c_filter.id_categoria = pc_filter.id_categoria
                WHERE pc_filter.id_producto = p.id_producto
                  AND c_filter.slug = ?
                  AND c_filter.estado = TRUE
            )
        `);
        params.push(filters.categoria);
    }

    if (filters.id_marca) {
        clauses.push("p.id_marca = ?");
        params.push(filters.id_marca);
    }

    if (filters.destacado !== undefined) {
        clauses.push("p.destacado = ?");
        params.push(filters.destacado);
    }

    return {
        whereClause: `WHERE ${clauses.join(" AND ")}`,
        params
    };
};

const obtenerTodos = async (filters) => {
    const { whereClause, params } = buildProductFilters(filters);
    const offset = (filters.page - 1) * filters.limit;

    const countSql = `
        SELECT COUNT(DISTINCT p.id_producto) AS total
        FROM productos p
        ${whereClause}
    `;

    const dataSql = `
        SELECT
            p.id_producto,
            p.nombre,
            p.slug,
            p.descripcion_corta,
            p.destacado,
            p.created_at,
            m.id_marca,
            m.nombre AS marca,
            resumen_variantes.precio_desde,
            resumen_variantes.precio_regular_desde,
            COALESCE(resumen_variantes.stock_disponible, 0) AS stock_disponible,
            COALESCE(resumen_variantes.cantidad_variantes, 0) AS cantidad_variantes,
            resumen_variantes.tiene_oferta,
            (
                SELECT ip.url_imagen
                FROM imagenes_producto ip
                WHERE ip.id_producto = p.id_producto
                ORDER BY ip.es_principal DESC, ip.orden_visual ASC, ip.id_imagen ASC
                LIMIT 1
            ) AS imagen_principal
        FROM productos p
        LEFT JOIN marcas m
            ON m.id_marca = p.id_marca
        LEFT JOIN (
            SELECT
                vp.id_producto,
                MIN(COALESCE(vp.precio_oferta, vp.precio)) AS precio_desde,
                MIN(vp.precio) AS precio_regular_desde,
                SUM(GREATEST(
                    COALESCE(i.stock_actual, 0) - COALESCE(i.stock_reservado, 0),
                    0
                )) AS stock_disponible,
                COUNT(*) AS cantidad_variantes,
                MAX(vp.precio_oferta IS NOT NULL) AS tiene_oferta
            FROM variantes_producto vp
            LEFT JOIN inventario i
                ON i.id_variante = vp.id_variante
            WHERE vp.activo = TRUE
            GROUP BY vp.id_producto
        ) resumen_variantes
            ON resumen_variantes.id_producto = p.id_producto
        ${whereClause}
        ORDER BY p.destacado DESC, p.created_at DESC, p.id_producto DESC
        LIMIT ? OFFSET ?
    `;

    const [[countRows], [productos]] = await Promise.all([
        pool.execute(countSql, params),
        pool.execute(dataSql, [...params, filters.limit, offset])
    ]);

    return {
        productos,
        total: Number(countRows[0].total)
    };
};

const obtenerPorSlug = async (slug) => {
    const [productoRows] = await pool.execute(`
        SELECT
            p.id_producto,
            p.nombre,
            p.slug,
            p.descripcion_corta,
            p.descripcion_larga,
            p.beneficios,
            p.ingredientes,
            p.requiere_receta,
            p.destacado,
            p.created_at,
            p.updated_at,
            m.id_marca,
            m.nombre AS marca
        FROM productos p
        LEFT JOIN marcas m
            ON m.id_marca = p.id_marca
        WHERE p.slug = ?
          AND p.estado = 'ACTIVO'
        LIMIT 1
    `, [slug]);

    if (!productoRows[0]) {
        return null;
    }

    const producto = productoRows[0];

    const [categoriasResult, variantesResult, imagenesResult, resenasResult] = await Promise.all([
        pool.execute(`
            SELECT c.id_categoria, c.nombre, c.slug
            FROM categorias c
            INNER JOIN producto_categoria pc
                ON pc.id_categoria = c.id_categoria
            WHERE pc.id_producto = ?
              AND c.estado = TRUE
            ORDER BY c.nombre ASC
        `, [producto.id_producto]),
        pool.execute(`
            SELECT
                vp.id_variante,
                vp.sku,
                vp.nombre_variante,
                vp.presentacion,
                vp.unidad_medida,
                vp.precio,
                vp.precio_oferta,
                COALESCE(vp.precio_oferta, vp.precio) AS precio_actual,
                vp.peso_kg,
                vp.dimensiones,
                COALESCE(i.stock_actual, 0) AS stock_actual,
                COALESCE(i.stock_reservado, 0) AS stock_reservado,
                GREATEST(
                    COALESCE(i.stock_actual, 0) - COALESCE(i.stock_reservado, 0),
                    0
                ) AS stock_disponible
            FROM variantes_producto vp
            LEFT JOIN inventario i
                ON i.id_variante = vp.id_variante
            WHERE vp.id_producto = ?
              AND vp.activo = TRUE
            ORDER BY precio_actual ASC, vp.id_variante ASC
        `, [producto.id_producto]),
        pool.execute(`
            SELECT
                id_imagen,
                url_imagen,
                texto_alternativo,
                orden_visual,
                es_principal
            FROM imagenes_producto
            WHERE id_producto = ?
            ORDER BY es_principal DESC, orden_visual ASC, id_imagen ASC
        `, [producto.id_producto]),
        pool.execute(`
            SELECT
                COUNT(*) AS cantidad_resenas,
                ROUND(AVG(calificacion), 1) AS promedio_calificacion
            FROM resenas
            WHERE id_producto = ?
              AND estado = 'PUBLICADA'
        `, [producto.id_producto])
    ]);

    return {
        ...producto,
        categorias: categoriasResult[0],
        variantes: variantesResult[0],
        imagenes: imagenesResult[0],
        resenas: resenasResult[0][0]
    };
};

module.exports = {
    obtenerTodos,
    obtenerPorSlug
};
