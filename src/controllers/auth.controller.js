import * as authService from "../services/auth.service.js";

export const registrar = async (req, res) => {
    const authData = await authService.registrarCliente(req.validated.body);

    return res.status(201).json({
        success: true,
        message: "Cuenta creada correctamente",
        data: authData
    });
};

export const login = async (req, res) => {
    const authData = await authService.iniciarSesion(req.validated.body);

    return res.status(200).json({
        success: true,
        message: "Inicio de sesión correcto",
        data: authData
    });
};

export const perfil = async (req, res) => {
    const user = await authService.obtenerPerfil(req.auth.userId);

    return res.status(200).json({
        success: true,
        message: "Perfil obtenido correctamente",
        data: user
    });
};
