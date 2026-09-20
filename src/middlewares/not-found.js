import AppError from "../utils/app-error.js";

const notFound = (req, res, next) => {
    next(new AppError(
        `La ruta ${req.method} ${req.originalUrl} no existe`,
        404,
        "ROUTE_NOT_FOUND"
    ));
};

export default notFound;
