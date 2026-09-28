import * as authRepository from "../repositories/auth.repository.js";
import AppError from "../utils/app-error.js";
import ROLES from "../utils/roles.js";

const requireCatalogAdmin = async (req, res, next) => {
    const user = await authRepository.obtenerPorId(req.auth.userId);

    if (!user || !user.estado || !user.rol_activo) {
        throw new AppError("La sesión administrativa ya no está activa", 401, "ADMIN_SESSION_INACTIVE");
    }

    if (user.rol !== ROLES.ADMIN_CATALOGO) {
        throw new AppError("No tienes permisos de catálogo", 403, "FORBIDDEN");
    }

    req.admin = {
        id_usuario: user.id_usuario,
        nombres: user.nombres,
        apellidos: user.apellidos,
        correo: user.correo,
        rol: user.rol
    };

    next();
};

export default requireCatalogAdmin;
