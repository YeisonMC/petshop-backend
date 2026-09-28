import { ejecutarTransaccion } from "../config/database.js";
import * as repository from "../repositories/admin-catalog.repository.js";
import AppError from "../utils/app-error.js";

const notFound = (resource) => new AppError(`${resource} no existe`, 404, "RESOURCE_NOT_FOUND");
const conflict = (message) => new AppError(message, 409, "CATALOG_CONFLICT");
const numberOrNull = (value) => value == null ? null : Number(value);

const normalizarProducto = (row) => ({
    ...row,
    requiere_receta: Boolean(row.requiere_receta),
    destacado: Boolean(row.destacado),
    variantes: row.variantes == null ? undefined : Number(row.variantes),
    stock_disponible: row.stock_disponible == null ? undefined : Number(row.stock_disponible)
});
const normalizarVariante = (row) => ({
    ...row,
    activo: Boolean(row.activo),
    precio: Number(row.precio),
    precio_oferta: numberOrNull(row.precio_oferta),
    costo: numberOrNull(row.costo),
    peso_kg: numberOrNull(row.peso_kg),
    stock_actual: numberOrNull(row.stock_actual),
    stock_reservado: numberOrNull(row.stock_reservado),
    stock_minimo: numberOrNull(row.stock_minimo)
});
const normalizarImagen = (row) => ({ ...row, es_principal: Boolean(row.es_principal) });

const validarMarcaActiva = async (id, executor) => {
    if (id == null) return;
    const brand = await repository.obtenerMarca(id, executor);
    if (!brand || !brand.estado) throw conflict("La marca seleccionada no está activa");
};
const validarCategoriasActivas = async (ids, executor) => {
    if (await repository.contarCategoriasActivas(ids, executor) !== ids.length) {
        throw conflict("Una o más categorías no existen o están inactivas");
    }
};
const validarPadre = async (idPadre, idActual = null) => {
    if (idPadre == null) return;
    const parent = await repository.obtenerCategoria(idPadre);
    if (!parent || !parent.estado) throw conflict("La categoría padre no está activa");
    if (idActual != null) {
        const ancestors = await repository.obtenerAncestrosCategoria(idPadre);
        if (ancestors.includes(idActual)) throw conflict("La categoría padre generaría un ciclo");
    }
};

export const resumen = async () => {
    const result = await repository.resumen();
    return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, Number(value)]));
};

export const listarMarcas = async () => (await repository.listarMarcas()).map(
    (row) => ({ ...row, estado: Boolean(row.estado) })
);
export const crearMarca = async (data) => {
    const id = await repository.crearMarca(data);
    return { ...(await repository.obtenerMarca(id)), estado: data.estado ?? true };
};
export const actualizarMarca = async (id, data) => {
    if (!await repository.obtenerMarca(id)) throw notFound("La marca");
    await repository.actualizarMarca(id, data);
    const row = await repository.obtenerMarca(id);
    return { ...row, estado: Boolean(row.estado) };
};

export const listarCategorias = async () => (await repository.listarCategorias()).map(
    (row) => ({ ...row, estado: Boolean(row.estado) })
);
export const crearCategoria = async (data) => {
    await validarPadre(data.id_categoria_padre);
    const id = await repository.crearCategoria(data);
    const row = await repository.obtenerCategoria(id);
    return { ...row, estado: Boolean(row.estado) };
};
export const actualizarCategoria = async (id, data) => {
    if (!await repository.obtenerCategoria(id)) throw notFound("La categoría");
    if (data.id_categoria_padre !== undefined) await validarPadre(data.id_categoria_padre, id);
    await repository.actualizarCategoria(id, data);
    const row = await repository.obtenerCategoria(id);
    return { ...row, estado: Boolean(row.estado) };
};

export const listarProductos = async (filters) => {
    const { rows, total } = await repository.listarProductos(filters);
    return {
        data: rows.map(normalizarProducto),
        pagination: {
            page: filters.page,
            limit: filters.limit,
            total,
            totalPages: Math.ceil(total / filters.limit)
        }
    };
};
export const obtenerProducto = async (id) => {
    const row = await repository.obtenerProducto(id);
    if (!row) throw notFound("El producto");
    const [categoriaIds, variantes, imagenes] = await Promise.all([
        repository.obtenerCategoriasProducto(id),
        repository.obtenerVariantesProducto(id),
        repository.obtenerImagenesProducto(id)
    ]);
    return {
        ...normalizarProducto(row),
        categoria_ids: categoriaIds,
        variantes: variantes.map(normalizarVariante),
        imagenes: imagenes.map(normalizarImagen)
    };
};
export const crearProducto = async (data) => {
    const id = await ejecutarTransaccion(async (connection) => {
        await validarMarcaActiva(data.id_marca, connection);
        await validarCategoriasActivas(data.categoria_ids, connection);
        const idProducto = await repository.crearProducto(data, connection);
        await repository.reemplazarCategoriasProducto(idProducto, data.categoria_ids, connection);
        return idProducto;
    });
    return obtenerProducto(id);
};
export const actualizarProducto = async (id, data) => {
    await ejecutarTransaccion(async (connection) => {
        if (!await repository.bloquearProducto(id, connection)) throw notFound("El producto");
        if (data.id_marca !== undefined) await validarMarcaActiva(data.id_marca, connection);
        if (data.categoria_ids !== undefined) await validarCategoriasActivas(data.categoria_ids, connection);
        await repository.actualizarProducto(id, data, connection);
        if (data.categoria_ids !== undefined) {
            await repository.reemplazarCategoriasProducto(id, data.categoria_ids, connection);
        }
    });
    return obtenerProducto(id);
};

export const crearVariante = async (idProducto, data) => {
    const id = await ejecutarTransaccion(async (connection) => {
        if (!await repository.bloquearProducto(idProducto, connection)) throw notFound("El producto");
        const idVariante = await repository.crearVariante(idProducto, data, connection);
        await repository.crearInventarioVariante(idVariante, data, connection);
        return idVariante;
    });
    return normalizarVariante(await repository.obtenerVariante(id));
};
export const actualizarVariante = async (id, data) => {
    await ejecutarTransaccion(async (connection) => {
        const current = await repository.bloquearVariante(id, connection);
        if (!current) throw notFound("La variante");
        const price = data.precio ?? Number(current.precio);
        const offer = data.precio_oferta === undefined ? numberOrNull(current.precio_oferta) : data.precio_oferta;
        if (offer != null && offer > price) throw conflict("El precio de oferta no puede superar el precio regular");
        await repository.actualizarVariante(id, data, connection);
    });
    return normalizarVariante(await repository.obtenerVariante(id));
};

export const crearImagen = async (idProducto, data) => {
    const id = await ejecutarTransaccion(async (connection) => {
        if (!await repository.bloquearProducto(idProducto, connection)) throw notFound("El producto");
        const existentes = await repository.obtenerImagenesProducto(idProducto, connection);
        const principal = data.es_principal === true || existentes.length === 0;
        if (principal) await repository.quitarPrincipal(idProducto, connection);
        return repository.crearImagen(idProducto, { ...data, es_principal: principal }, connection);
    });
    return normalizarImagen(await repository.obtenerImagen(id));
};
export const actualizarImagen = async (id, data) => {
    await ejecutarTransaccion(async (connection) => {
        const image = await repository.obtenerImagen(id, connection);
        if (!image) throw notFound("La imagen");
        if (!await repository.bloquearProducto(image.id_producto, connection)) throw notFound("El producto");
        if (data.es_principal) await repository.quitarPrincipal(image.id_producto, connection);
        await repository.actualizarImagen(id, data, connection);
        await repository.asegurarImagenPrincipal(image.id_producto, connection);
    });
    return normalizarImagen(await repository.obtenerImagen(id));
};
export const eliminarImagen = async (id) => {
    await ejecutarTransaccion(async (connection) => {
        const image = await repository.obtenerImagen(id, connection);
        if (!image) throw notFound("La imagen");
        if (!await repository.bloquearProducto(image.id_producto, connection)) throw notFound("El producto");
        await repository.eliminarImagen(id, connection);
        await repository.asegurarImagenPrincipal(image.id_producto, connection);
    });
};
