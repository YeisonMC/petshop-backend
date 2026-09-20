import AppError from "../utils/app-error.js";

const validate = (schema, source = "body") => (req, res, next) => {
    const resultado = schema.safeParse(req[source]);

    if (!resultado.success) {
        const details = resultado.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message
        }));

        return next(new AppError(
            "Los datos enviados no son válidos",
            400,
            "VALIDATION_ERROR",
            details
        ));
    }

    req.validated = req.validated || {};
    req.validated[source] = resultado.data;

    return next();
};

export default validate;
