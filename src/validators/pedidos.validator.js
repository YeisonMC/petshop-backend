import { z } from "zod";

export const crearPedidoSchema = z.object({
    id_direccion: z.coerce.number().int().positive().max(4294967295),
    observaciones: z.string().trim().max(255).nullable().optional()
}).strict();

export const pedidoParamsSchema = z.object({
    id: z.coerce.number().int().positive().max(4294967295)
}).strict();
