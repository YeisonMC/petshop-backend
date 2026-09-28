import * as service from "../services/admin-inventory.service.js";

export const listar = async (req, res) => {
    const result = await service.listar(req.validated.query);
    res.status(200).json({ success: true, ...result });
};
export const configurar = async (req, res) => {
    const data = await service.configurar(req.validated.params.idVariante, req.validated.body);
    res.status(200).json({ success: true, data });
};
export const ajustar = async (req, res) => {
    const data = await service.ajustar(
        req.validated.params.idVariante, req.validated.body, req.admin.id_usuario
    );
    res.status(200).json({ success: true, message: "Stock ajustado", data });
};
export const listarMovimientos = async (req, res) => {
    const data = await service.listarMovimientos(req.validated.params.idVariante);
    res.status(200).json({ success: true, data });
};
