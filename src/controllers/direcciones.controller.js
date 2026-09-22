import * as direccionesService from "../services/direcciones.service.js";

export const listar = async (req, res) => {
    const direcciones = await direccionesService.listar(req.auth.userId);

    return res.status(200).json({
        success: true,
        message: "Direcciones obtenidas correctamente",
        data: direcciones
    });
};

export const crear = async (req, res) => {
    const direccion = await direccionesService.crear(req.auth.userId, req.validated.body);

    return res.status(201).json({
        success: true,
        message: "Dirección creada correctamente",
        data: direccion
    });
};

export const actualizar = async (req, res) => {
    const direccion = await direccionesService.actualizar(
        req.auth.userId,
        req.validated.params.id,
        req.validated.body
    );

    return res.status(200).json({
        success: true,
        message: "Dirección actualizada correctamente",
        data: direccion
    });
};

export const establecerPrincipal = async (req, res) => {
    const direccion = await direccionesService.establecerPrincipal(
        req.auth.userId,
        req.validated.params.id
    );

    return res.status(200).json({
        success: true,
        message: "Dirección principal actualizada correctamente",
        data: direccion
    });
};

export const eliminar = async (req, res) => {
    await direccionesService.eliminar(req.auth.userId, req.validated.params.id);

    return res.status(200).json({
        success: true,
        message: "Dirección eliminada correctamente"
    });
};
