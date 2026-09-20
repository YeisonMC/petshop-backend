import * as productosService from "../services/productos.service.js";

export const obtenerProductos = async (req, res) => {
    const resultado = await productosService.obtenerProductos(req.validated.query);

    return res.status(200).json({
        success: true,
        message: "Productos obtenidos correctamente",
        ...resultado
    });
};

export const obtenerProductoPorSlug = async (req, res) => {
    const producto = await productosService.obtenerProductoPorSlug(
        req.validated.params.slug
    );

    return res.status(200).json({
        success: true,
        message: "Producto obtenido correctamente",
        data: producto
    });
};
