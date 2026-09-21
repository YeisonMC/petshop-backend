import AppError from "../utils/app-error.js";

const authorize = (...allowedRoles) => (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
        return next(new AppError(
            "No tienes permisos para realizar esta acción",
            403,
            "FORBIDDEN"
        ));
    }

    return next();
};

export default authorize;
