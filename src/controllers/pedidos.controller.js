import * as pedidosService from "../services/pedidos.service.js";

export const listar = async (req, res) => res.status(200).json({
    success: true,
    message: "Pedidos obtenidos correctamente",
    data: await pedidosService.listar(req.auth.userId)
});

export const crear = async (req, res) => res.status(201).json({
    success: true,
    message: "Pedido creado y stock reservado correctamente",
    data: await pedidosService.crear(req.auth.userId, req.validated.body)
});

export const obtener = async (req, res) => res.status(200).json({
    success: true,
    message: "Pedido obtenido correctamente",
    data: await pedidosService.obtener(req.auth.userId, req.validated.params.id)
});

export const cancelar = async (req, res) => res.status(200).json({
    success: true,
    message: "Pedido cancelado correctamente",
    data: await pedidosService.cancelar(req.auth.userId, req.validated.params.id)
});
