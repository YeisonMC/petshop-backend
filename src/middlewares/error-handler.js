const AppError = require("../utils/app-error");

const normalizeError = (error) => {
    if (error instanceof AppError) {
        return error;
    }

    if (error.code === "ER_DUP_ENTRY") {
        return new AppError(
            "El registro ya existe",
            409,
            "DUPLICATE_RESOURCE"
        );
    }

    return new AppError(
        "Ocurrió un error interno en el servidor",
        500,
        "INTERNAL_ERROR"
    );
};

const errorHandler = (error, req, res, next) => {
    const normalizedError = normalizeError(error);

    if (!error.isOperational) {
        console.error("Error no controlado:", error);
    }

    const response = {
        success: false,
        error: {
            code: normalizedError.code,
            message: normalizedError.message
        }
    };

    if (normalizedError.details) {
        response.error.details = normalizedError.details;
    }

    return res.status(normalizedError.statusCode).json(response);
};

module.exports = errorHandler;
