import { z } from "zod";

export const inventoryListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    search: z.string().trim().max(100).optional(),
    bajo_minimo: z.enum(["true", "false"]).optional()
}).strict();

export const inventoryParamsSchema = z.object({
    idVariante: z.coerce.number().int().positive().max(4294967295)
}).strict();

export const inventorySettingsSchema = z.object({
    stock_minimo: z.coerce.number().int().min(0).max(1000000).optional(),
    ubicacion_almacen: z.string().trim().max(100).nullable().optional()
}).strict().refine((data) => Object.keys(data).length > 0, "Envía al menos un campo");

export const inventoryAdjustmentSchema = z.object({
    cantidad: z.coerce.number().int().min(-100000).max(100000).refine(
        (value) => value !== 0,
        "La cantidad no puede ser cero"
    ),
    motivo: z.string().trim().min(5).max(255)
}).strict();
