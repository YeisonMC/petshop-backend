import { pool } from "../config/database.js";

const allowed = {
    marcas: ["nombre", "descripcion", "estado"],
    categorias: ["nombre", "slug", "descripcion", "id_categoria_padre", "estado"],
    productos: ["nombre", "slug", "id_marca", "descripcion_corta", "descripcion_larga",
        "beneficios", "ingredientes", "requiere_receta", "destacado", "estado"],
    variantes_producto: ["sku", "nombre_variante", "presentacion", "unidad_medida",
        "precio", "precio_oferta", "costo", "peso_kg", "dimensiones", "codigo_barras", "activo"],
    imagenes_producto: ["url_imagen", "texto_alternativo", "orden_visual", "es_principal"]
};

const updateAllowed = async (table, idColumn, id, data, executor = pool) => {
    const columns = allowed[table].filter((key) => data[key] !== undefined);
    if (columns.length === 0) return;
    await executor.execute(
        `UPDATE ${table} SET ${columns.map((key) => `${key} = ?`).join(", ")} WHERE ${idColumn} = ?`,
        [...columns.map((key) => data[key]), id]
    );
};

export const resumen = async () => {
    const [[row]] = await pool.execute(`
        SELECT
            (SELECT COUNT(*) FROM productos) AS productos,
            (SELECT COUNT(*) FROM productos WHERE estado = 'ACTIVO') AS productos_activos,
            (SELECT COUNT(*) FROM variantes_producto WHERE activo = TRUE) AS variantes_activas,
            (SELECT COUNT(*) FROM categorias WHERE estado = TRUE) AS categorias_activas,
            (SELECT COUNT(*) FROM marcas WHERE estado = TRUE) AS marcas_activas,
            (SELECT COUNT(*) FROM inventario WHERE stock_actual - stock_reservado <= stock_minimo) AS stock_bajo
    `);
    return row;
};

export const listarMarcas = async () => {
    const [rows] = await pool.execute(`
        SELECT id_marca, nombre, descripcion, estado, created_at, updated_at
        FROM marcas ORDER BY nombre ASC
    `);
    return rows;
};
export const obtenerMarca = async (id, executor = pool) => {
    const [[row]] = await executor.execute(
        "SELECT id_marca, nombre, descripcion, estado FROM marcas WHERE id_marca = ? LIMIT 1", [id]
    );
    return row || null;
};
export const crearMarca = async (data, executor = pool) => {
    const [result] = await executor.execute(
        "INSERT INTO marcas (nombre, descripcion, estado) VALUES (?, ?, ?)",
        [data.nombre, data.descripcion ?? null, data.estado ?? true]
    );
    return result.insertId;
};
export const actualizarMarca = (id, data) => updateAllowed("marcas", "id_marca", id, data);

export const listarCategorias = async () => {
    const [rows] = await pool.execute(`
        SELECT id_categoria, id_categoria_padre, nombre, slug, descripcion, estado,
            created_at, updated_at
        FROM categorias ORDER BY nombre ASC
    `);
    return rows;
};
export const obtenerCategoria = async (id, executor = pool) => {
    const [[row]] = await executor.execute(
        "SELECT id_categoria, id_categoria_padre, nombre, slug, descripcion, estado FROM categorias WHERE id_categoria = ? LIMIT 1",
        [id]
    );
    return row || null;
};
export const obtenerAncestrosCategoria = async (id, executor = pool) => {
    const [rows] = await executor.execute(`
        WITH RECURSIVE ancestros AS (
            SELECT id_categoria, id_categoria_padre FROM categorias WHERE id_categoria = ?
            UNION ALL
            SELECT c.id_categoria, c.id_categoria_padre
            FROM categorias c INNER JOIN ancestros a ON c.id_categoria = a.id_categoria_padre
        ) SELECT id_categoria FROM ancestros
    `, [id]);
    return rows.map((row) => row.id_categoria);
};
export const crearCategoria = async (data, executor = pool) => {
    const [result] = await executor.execute(`
        INSERT INTO categorias (id_categoria_padre, nombre, slug, descripcion, estado)
        VALUES (?, ?, ?, ?, ?)
    `, [data.id_categoria_padre ?? null, data.nombre, data.slug,
        data.descripcion ?? null, data.estado ?? true]);
    return result.insertId;
};
export const actualizarCategoria = (id, data) => updateAllowed("categorias", "id_categoria", id, data);

const productSelect = `
    p.id_producto, p.id_marca, b.nombre AS marca, p.nombre, p.slug,
    p.descripcion_corta, p.descripcion_larga, p.beneficios, p.ingredientes,
    p.requiere_receta, p.destacado, p.estado, p.created_at, p.updated_at
`;
export const listarProductos = async ({ page, limit, search, estado }) => {
    const conditions = [];
    const params = [];
    if (search) {
        conditions.push("(p.nombre LIKE ? OR p.slug LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
    }
    if (estado) {
        conditions.push("p.estado = ?");
        params.push(estado);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [[count]] = await pool.execute(`SELECT COUNT(*) AS total FROM productos p ${where}`, params);
    const [rows] = await pool.execute(`
        SELECT ${productSelect},
            (SELECT COUNT(*) FROM variantes_producto vp WHERE vp.id_producto = p.id_producto) AS variantes,
            (SELECT COALESCE(SUM(i.stock_actual - i.stock_reservado), 0)
             FROM variantes_producto vp LEFT JOIN inventario i ON i.id_variante = vp.id_variante
             WHERE vp.id_producto = p.id_producto AND vp.activo = TRUE) AS stock_disponible,
            (SELECT ip.url_imagen FROM imagenes_producto ip
             WHERE ip.id_producto = p.id_producto
             ORDER BY ip.es_principal DESC, ip.orden_visual ASC, ip.id_imagen ASC LIMIT 1) AS imagen
        FROM productos p LEFT JOIN marcas b ON b.id_marca = p.id_marca
        ${where} ORDER BY p.updated_at DESC, p.id_producto DESC LIMIT ? OFFSET ?
    `, [...params, limit, (page - 1) * limit]);
    return { rows, total: Number(count.total) };
};
export const obtenerProducto = async (id, executor = pool) => {
    const [[row]] = await executor.execute(`
        SELECT ${productSelect} FROM productos p
        LEFT JOIN marcas b ON b.id_marca = p.id_marca
        WHERE p.id_producto = ? LIMIT 1
    `, [id]);
    return row || null;
};
export const bloquearProducto = async (id, executor) => {
    const [[row]] = await executor.execute(
        "SELECT id_producto FROM productos WHERE id_producto = ? LIMIT 1 FOR UPDATE", [id]
    );
    return row || null;
};
export const obtenerCategoriasProducto = async (id, executor = pool) => {
    const [rows] = await executor.execute(
        "SELECT id_categoria FROM producto_categoria WHERE id_producto = ? ORDER BY id_categoria", [id]
    );
    return rows.map((row) => row.id_categoria);
};
export const obtenerVariantesProducto = async (id, executor = pool) => {
    const [rows] = await executor.execute(`
        SELECT vp.*, i.stock_actual, i.stock_reservado, i.stock_minimo, i.ubicacion_almacen
        FROM variantes_producto vp LEFT JOIN inventario i ON i.id_variante = vp.id_variante
        WHERE vp.id_producto = ? ORDER BY vp.id_variante ASC
    `, [id]);
    return rows;
};
export const obtenerImagenesProducto = async (id, executor = pool) => {
    const [rows] = await executor.execute(`
        SELECT id_imagen, id_producto, url_imagen, texto_alternativo, orden_visual, es_principal
        FROM imagenes_producto WHERE id_producto = ?
        ORDER BY es_principal DESC, orden_visual ASC, id_imagen ASC
    `, [id]);
    return rows;
};
export const contarCategoriasActivas = async (ids, executor) => {
    const [rows] = await executor.execute(
        `SELECT COUNT(*) AS total FROM categorias WHERE estado = TRUE AND id_categoria IN (${ids.map(() => "?").join(",")})`, ids
    );
    return Number(rows[0].total);
};
export const crearProducto = async (data, executor) => {
    const [result] = await executor.execute(`
        INSERT INTO productos (
            id_marca, nombre, slug, descripcion_corta, descripcion_larga,
            beneficios, ingredientes, requiere_receta, destacado, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [data.id_marca ?? null, data.nombre, data.slug, data.descripcion_corta ?? null,
        data.descripcion_larga ?? null, data.beneficios ?? null, data.ingredientes ?? null,
        data.requiere_receta ?? false, data.destacado ?? false, data.estado ?? "ACTIVO"]);
    return result.insertId;
};
export const actualizarProducto = (id, data, executor) =>
    updateAllowed("productos", "id_producto", id, data, executor);
export const reemplazarCategoriasProducto = async (id, ids, executor) => {
    await executor.execute("DELETE FROM producto_categoria WHERE id_producto = ?", [id]);
    for (const categoryId of ids) {
        await executor.execute(
            "INSERT INTO producto_categoria (id_producto, id_categoria) VALUES (?, ?)",
            [id, categoryId]
        );
    }
};

export const obtenerVariante = async (id, executor = pool) => {
    const [[row]] = await executor.execute(`
        SELECT vp.*, i.stock_actual, i.stock_reservado, i.stock_minimo, i.ubicacion_almacen
        FROM variantes_producto vp LEFT JOIN inventario i ON i.id_variante = vp.id_variante
        WHERE vp.id_variante = ? LIMIT 1
    `, [id]);
    return row || null;
};
export const bloquearVariante = async (id, executor) => {
    const [[row]] = await executor.execute(
        "SELECT id_variante, precio, precio_oferta FROM variantes_producto WHERE id_variante = ? LIMIT 1 FOR UPDATE",
        [id]
    );
    return row || null;
};
export const crearVariante = async (idProducto, data, executor) => {
    const [result] = await executor.execute(`
        INSERT INTO variantes_producto (
            id_producto, sku, nombre_variante, presentacion, unidad_medida,
            precio, precio_oferta, costo, peso_kg, dimensiones, codigo_barras, activo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [idProducto, data.sku, data.nombre_variante, data.presentacion ?? null,
        data.unidad_medida ?? null, data.precio, data.precio_oferta ?? null,
        data.costo ?? null, data.peso_kg ?? null, data.dimensiones ?? null,
        data.codigo_barras ?? null, data.activo ?? true]);
    return result.insertId;
};
export const crearInventarioVariante = async (idVariante, data, executor) => {
    await executor.execute(`
        INSERT INTO inventario (id_variante, stock_actual, stock_reservado, stock_minimo, ubicacion_almacen)
        VALUES (?, 0, 0, ?, ?)
    `, [idVariante, data.stock_minimo ?? 0, data.ubicacion_almacen ?? null]);
};
export const actualizarVariante = (id, data, executor = pool) =>
    updateAllowed("variantes_producto", "id_variante", id, data, executor);

export const obtenerImagen = async (id, executor = pool) => {
    const [[row]] = await executor.execute(`
        SELECT id_imagen, id_producto, url_imagen, texto_alternativo, orden_visual, es_principal
        FROM imagenes_producto WHERE id_imagen = ? LIMIT 1
    `, [id]);
    return row || null;
};
export const quitarPrincipal = async (idProducto, executor) => {
    await executor.execute("UPDATE imagenes_producto SET es_principal = FALSE WHERE id_producto = ?", [idProducto]);
};
export const crearImagen = async (idProducto, data, executor) => {
    const [result] = await executor.execute(`
        INSERT INTO imagenes_producto
            (id_producto, url_imagen, texto_alternativo, orden_visual, es_principal)
        VALUES (?, ?, ?, ?, ?)
    `, [idProducto, data.url_imagen, data.texto_alternativo ?? null,
        data.orden_visual ?? 1, data.es_principal ?? false]);
    return result.insertId;
};
export const actualizarImagen = (id, data, executor) =>
    updateAllowed("imagenes_producto", "id_imagen", id, data, executor);
export const eliminarImagen = async (id, executor) => {
    await executor.execute("DELETE FROM imagenes_producto WHERE id_imagen = ?", [id]);
};
export const asegurarImagenPrincipal = async (idProducto, executor) => {
    const [rows] = await executor.execute(`
        SELECT id_imagen, es_principal FROM imagenes_producto
        WHERE id_producto = ? ORDER BY es_principal DESC, orden_visual ASC, id_imagen ASC
    `, [idProducto]);
    if (rows.length > 0 && !rows[0].es_principal) {
        await executor.execute("UPDATE imagenes_producto SET es_principal = TRUE WHERE id_imagen = ?", [rows[0].id_imagen]);
    }
};
