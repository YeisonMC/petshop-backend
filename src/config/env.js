import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DB_HOST: z.string().trim().min(1, "DB_HOST es obligatorio"),
    DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
    DB_USER: z.string().trim().min(1, "DB_USER es obligatorio"),
    DB_PASSWORD: z.string().min(1, "DB_PASSWORD es obligatorio"),
    DB_NAME: z.string().trim().min(1, "DB_NAME es obligatorio"),
    DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10)
});

const resultado = envSchema.safeParse(process.env);

if (!resultado.success) {
    const detalles = resultado.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");

    throw new Error(`Configuración de entorno inválida: ${detalles}`);
}

export default resultado.data;
