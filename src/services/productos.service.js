import * as productosRepository from "../repositories/productos.repository.js";
import AppError from "../utils/app-error.js";

const toNumberOrNull = (value) => value === null ? null : Number(value);

const normalizeProductSummary = (producto) => ({
    ...producto,
    destacado: Boolean(producto.destacado),
    precio_desde: toNumberOrNull(producto.precio_desde),
    precio_regular_desde: toNumberOrNull(producto.precio_regular_desde),
    stock_disponible: Number(producto.stock_disponible),
    cantidad_variantes: Number(producto.cantidad_variantes),
    tiene_oferta: Boolean(producto.tiene_oferta),
    disponible: Number(producto.stock_disponible) > 0
});

const normalizeProductDetail = (producto) => ({
    ...producto,
    requiere_receta: Boolean(producto.requiere_receta),
    destacado: Boolean(producto.destacado),
    variantes: producto.variantes.map((variante) => ({
        ...variante,
        precio: Number(variante.precio),
        precio_oferta: toNumberOrNull(variante.precio_oferta),
        precio_actual: Number(variante.precio_actual),
        peso_kg: toNumberOrNull(variante.peso_kg),
        stock_actual: Number(variante.stock_actual),
        stock_reservado: Number(variante.stock_reservado),
        stock_disponible: Number(variante.stock_disponible),
        disponible: Number(variante.stock_disponible) > 0
    })),
    imagenes: producto.imagenes.map((imagen) => ({
        ...imagen,
        es_principal: Boolean(imagen.es_principal)
    })),
    resenas: {
        cantidad: Number(producto.resenas.cantidad_resenas),
        promedio: toNumberOrNull(producto.resenas.promedio_calificacion)
    }
});

export const obtenerProductos = async (filters) => {
    const { productos, total } = await productosRepository.obtenerTodos(filters);

    return {
        data: productos.map(normalizeProductSummary),
        pagination: {
            page: filters.page,
            limit: filters.limit,
            total,
            totalPages: Math.ceil(total / filters.limit)
        }
    };
};

export const obtenerProductoPorSlug = async (slug) => {
    const producto = await productosRepository.obtenerPorSlug(slug);

    if (!producto) {
        throw new AppError(
            "El producto solicitado no existe",
            404,
            "PRODUCT_NOT_FOUND"
        );
    }

    return normalizeProductDetail(producto);
};
