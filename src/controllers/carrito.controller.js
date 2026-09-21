import * as carritoService from "../services/carrito.service.js";

export const obtener = async (req, res) => {
    const cart = await carritoService.obtenerCarrito(req.auth.userId);

    return res.status(200).json({
        success: true,
        message: "Carrito obtenido correctamente",
        data: cart
    });
};

export const agregarItem = async (req, res) => {
    const cart = await carritoService.agregarItem(
        req.auth.userId,
        req.validated.body
    );

    return res.status(200).json({
        success: true,
        message: "Producto agregado al carrito",
        data: cart
    });
};

export const actualizarItem = async (req, res) => {
    const cart = await carritoService.actualizarCantidad(
        req.auth.userId,
        req.validated.params.idVariante,
        req.validated.body.cantidad
    );

    return res.status(200).json({
        success: true,
        message: "Cantidad actualizada correctamente",
        data: cart
    });
};

export const eliminarItem = async (req, res) => {
    const cart = await carritoService.eliminarItem(
        req.auth.userId,
        req.validated.params.idVariante
    );

    return res.status(200).json({
        success: true,
        message: "Producto eliminado del carrito",
        data: cart
    });
};
