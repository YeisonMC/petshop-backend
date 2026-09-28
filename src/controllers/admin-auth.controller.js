import * as authService from "../services/auth.service.js";
import ROLES from "../utils/roles.js";

export const login = async (req, res) => {
    const session = await authService.iniciarSesion(req.validated.body, ROLES.ADMIN_CATALOGO);
    res.set("Cache-Control", "no-store");
    res.status(200).json({ success: true, message: "Sesión administrativa iniciada", data: session });
};

export const perfil = async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.status(200).json({ success: true, data: req.admin });
};
