import { z } from "zod";

const requiredText = (max) => z.string().trim().min(1).max(max);
const optionalText = (max) => requiredText(max).nullable().optional();

const addressFields = {
    alias_direccion: optionalText(80),
    receptor: requiredText(150),
    telefono_contacto: z.string().trim().min(7).max(20)
        .regex(/^\+?[0-9 ()-]+$/, "El teléfono de contacto no es válido"),
    direccion_linea1: requiredText(150),
    direccion_linea2: optionalText(150),
    distrito: requiredText(100),
    provincia: requiredText(100),
    departamento: requiredText(100),
    codigo_postal: optionalText(10),
    referencia: optionalText(255)
};

export const crearDireccionSchema = z.object({
    ...addressFields,
    es_principal: z.boolean().optional()
}).strict();

export const actualizarDireccionSchema = z.object(addressFields)
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: "Debes enviar al menos un campo para actualizar"
    });

export const direccionParamsSchema = z.object({
    id: z.coerce.number().int().positive().max(4294967295)
}).strict();
