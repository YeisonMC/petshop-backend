const { z } = require("zod");

const emptyToUndefined = (value) => value === "" ? undefined : value;

const slugSchema = z.string()
    .trim()
    .min(1)
    .max(170)
    .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "El slug solo puede contener letras minúsculas, números y guiones"
    );

const productosQuerySchema = z.object({
    page: z.preprocess(
        emptyToUndefined,
        z.coerce.number().int().min(1).default(1)
    ),
    limit: z.preprocess(
        emptyToUndefined,
        z.coerce.number().int().min(1).max(50).default(12)
    ),
    search: z.preprocess(
        emptyToUndefined,
        z.string().trim().min(1).max(100).optional()
    ),
    categoria: z.preprocess(
        emptyToUndefined,
        slugSchema.max(120).optional()
    ),
    id_marca: z.preprocess(
        emptyToUndefined,
        z.coerce.number().int().positive().optional()
    ),
    destacado: z.preprocess(
        emptyToUndefined,
        z.enum(["true", "false", "1", "0"])
            .transform((value) => value === "true" || value === "1")
            .optional()
    )
}).strict();

const productoSlugParamsSchema = z.object({
    slug: slugSchema
}).strict();

module.exports = {
    productosQuerySchema,
    productoSlugParamsSchema
};
