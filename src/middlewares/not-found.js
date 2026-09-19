const AppError = require("../utils/app-error");

const notFound = (req, res, next) => {
    next(new AppError(
        `La ruta ${req.method} ${req.originalUrl} no existe`,
        404,
        "ROUTE_NOT_FOUND"
    ));
};

module.exports = notFound;
