import { z } from "zod";

const id = z.coerce.number().int().positive().max(4294967295);
const slug = (max) => z.string().trim().min(2).max(max)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa minúsculas, números y guiones");
const nullableText = (max) => z.string().trim().max(max).nullable().optional();
const nullableId = id.nullable().optional();
const money = z.coerce.number().finite().min(0).max(99999999.99);
const positiveMoney = money.refine((value) => value > 0, "El precio debe ser mayor a cero");
const optionalMoney = money.nullable().optional();
const nonEmptyPatch = (schema) => schema.partial().strict().refine(
    (value) => Object.keys(value).length > 0,
    "Envía al menos un campo para actualizar"
);

export const idParamsSchema = z.object({ id }).strict();
export const variantParamsSchema = z.object({ idVariante: id }).strict();
export const imageParamsSchema = z.object({ idImagen: id }).strict();

export const adminListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    search: z.string().trim().max(100).optional(),
    estado: z.enum(["ACTIVO", "INACTIVO", "AGOTADO", "DESCONTINUADO"]).optional()
}).strict();

export const marcaSchema = z.object({
    nombre: z.string().trim().min(2).max(100),
    descripcion: nullableText(255),
    estado: z.boolean().optional()
}).strict();
export const actualizarMarcaSchema = nonEmptyPatch(marcaSchema);

export const categoriaSchema = z.object({
    nombre: z.string().trim().min(2).max(100),
    slug: slug(120),
    descripcion: nullableText(255),
    id_categoria_padre: nullableId,
    estado: z.boolean().optional()
}).strict();
export const actualizarCategoriaSchema = nonEmptyPatch(categoriaSchema);

const productFields = {
    nombre: z.string().trim().min(2).max(150),
    slug: slug(170),
    id_marca: nullableId,
    categoria_ids: z.array(id).min(1).max(20).refine(
        (ids) => new Set(ids).size === ids.length,
        "No repitas categorías"
    ),
    descripcion_corta: nullableText(255),
    descripcion_larga: z.string().trim().max(10000).nullable().optional(),
    beneficios: z.string().trim().max(10000).nullable().optional(),
    ingredientes: z.string().trim().max(10000).nullable().optional(),
    requiere_receta: z.boolean().optional(),
    destacado: z.boolean().optional(),
    estado: z.enum(["ACTIVO", "INACTIVO", "AGOTADO", "DESCONTINUADO"]).optional()
};
export const productoAdminSchema = z.object(productFields).strict();
export const actualizarProductoAdminSchema = nonEmptyPatch(z.object(productFields));

const variantFields = {
    sku: z.string().trim().min(2).max(60),
    nombre_variante: z.string().trim().min(2).max(120),
    presentacion: nullableText(100),
    unidad_medida: nullableText(30),
    precio: positiveMoney,
    precio_oferta: optionalMoney,
    costo: optionalMoney,
    peso_kg: z.coerce.number().positive().max(99999.999).nullable().optional(),
    dimensiones: nullableText(100),
    codigo_barras: nullableText(50),
    activo: z.boolean().optional()
};
export const varianteSchema = z.object({
    ...variantFields,
    stock_minimo: z.coerce.number().int().min(0).max(1000000).optional(),
    ubicacion_almacen: nullableText(100)
}).strict().refine(
    (value) => value.precio_oferta == null || value.precio_oferta <= value.precio,
    { path: ["precio_oferta"], message: "La oferta no puede superar el precio" }
);
export const actualizarVarianteSchema = nonEmptyPatch(z.object(variantFields));

const imageFields = {
    url_imagen: z.string().trim().max(500).url().refine(
        (value) => value.startsWith("https://"),
        "La imagen debe usar HTTPS"
    ),
    texto_alternativo: nullableText(150),
    orden_visual: z.coerce.number().int().min(1).max(1000).optional(),
    es_principal: z.boolean().optional()
};
export const imagenSchema = z.object(imageFields).strict();
export const actualizarImagenSchema = nonEmptyPatch(z.object(imageFields));
