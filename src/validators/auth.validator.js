import { z } from "zod";

const emptyToUndefined = (value) => value === "" ? undefined : value;

const emailSchema = z.string()
    .trim()
    .email("El correo no tiene un formato válido")
    .max(150)
    .transform((value) => value.toLowerCase());

const passwordSchema = z.string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "La contraseña no puede superar los 72 caracteres")
    .regex(/[a-z]/, "La contraseña debe incluir una letra minúscula")
    .regex(/[A-Z]/, "La contraseña debe incluir una letra mayúscula")
    .regex(/[0-9]/, "La contraseña debe incluir un número");

export const registroSchema = z.object({
    nombres: z.string().trim().min(2).max(100),
    apellidos: z.string().trim().min(2).max(100),
    correo: emailSchema,
    password: passwordSchema,
    telefono: z.preprocess(
        emptyToUndefined,
        z.string().trim().regex(/^\+?[0-9]{7,15}$/, "El teléfono no es válido").optional()
    ),
    dni: z.preprocess(
        emptyToUndefined,
        z.string().regex(/^[0-9]{8}$/, "El DNI debe tener 8 dígitos").optional()
    ),
    ruc: z.preprocess(
        emptyToUndefined,
        z.string().regex(/^[0-9]{11}$/, "El RUC debe tener 11 dígitos").optional()
    )
}).strict();

export const loginSchema = z.object({
    correo: emailSchema,
    password: z.string().min(1, "La contraseña es obligatoria").max(72)
}).strict();
