import { z } from "zod";

const quantitySchema = z.coerce.number()
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad mínima es 1")
    .max(99, "La cantidad máxima es 99");

export const agregarItemSchema = z.object({
    id_variante: z.coerce.number().int().positive(),
    cantidad: quantitySchema
}).strict();

export const actualizarItemSchema = z.object({
    cantidad: quantitySchema
}).strict();

export const itemParamsSchema = z.object({
    idVariante: z.coerce.number().int().positive()
}).strict();
