import jwt from "jsonwebtoken";

import env from "../config/env.js";
import AppError from "../utils/app-error.js";

const authenticate = (req, res, next) => {
    const authorization = req.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
        return next(new AppError(
            "Debes enviar un token Bearer para acceder a esta ruta",
            401,
            "AUTHENTICATION_REQUIRED"
        ));
    }

    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
        return next(new AppError(
            "Debes enviar un token Bearer para acceder a esta ruta",
            401,
            "AUTHENTICATION_REQUIRED"
        ));
    }

    try {
        const payload = jwt.verify(token, env.JWT_SECRET);
        const userId = Number(payload.sub);

        if (!Number.isInteger(userId) || userId <= 0) {
            throw new Error("Token sin identificador de usuario válido");
        }

        req.auth = {
            userId,
            role: payload.rol
        };

        return next();
    } catch (error) {
        const expired = error instanceof jwt.TokenExpiredError;

        return next(new AppError(
            expired ? "El token ha expirado" : "El token no es válido",
            401,
            expired ? "TOKEN_EXPIRED" : "INVALID_TOKEN"
        ));
    }
};

export default authenticate;
