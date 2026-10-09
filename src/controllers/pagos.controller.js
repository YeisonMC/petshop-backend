import * as pagosService from "../services/pagos.service.js";

export const crearIntento = async (req, res) => res.status(200).json({
    success: true,
    data: await pagosService.crearIntento(req.auth.userId, req.validated.params.id)
});

export const obtenerEstado = async (req, res) => res.status(200).json({
    success: true,
    data: await pagosService.obtenerEstado(req.auth.userId, req.validated.params.id)
});

export const webhook = async (req, res) => {
    await pagosService.procesarWebhook(req.body, req.headers["stripe-signature"]);
    return res.status(200).json({ received: true });
};
