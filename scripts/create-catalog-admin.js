import bcrypt from "bcryptjs";

import { cerrarPool } from "../src/config/database.js";
import env from "../src/config/env.js";
import * as authRepository from "../src/repositories/auth.repository.js";
import ROLES from "../src/utils/roles.js";
import { registroSchema } from "../src/validators/auth.validator.js";

const main = async () => {
    const parsed = registroSchema.safeParse({
        nombres: process.env.ADMIN_NOMBRES,
        apellidos: process.env.ADMIN_APELLIDOS,
        correo: process.env.ADMIN_CORREO,
        password: process.env.ADMIN_PASSWORD
    });
    if (!parsed.success) {
        throw new Error(`Datos inválidos: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
    }

    const data = parsed.data;
    if (await authRepository.obtenerPorCorreo(data.correo)) {
        throw new Error("Ya existe una cuenta con ese correo; no se modificó");
    }
    const role = await authRepository.obtenerRolActivoPorNombre(ROLES.ADMIN_CATALOGO);
    if (!role) throw new Error("El rol ADMIN_CATALOGO no está activo en la base de datos");

    const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS);
    const id = await authRepository.crearUsuario({
        ...data,
        idRol: role.id_rol,
        passwordHash
    });
    console.log(`Administrador de catálogo creado con ID ${id}.`);
};

try {
    await main();
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await cerrarPool();
}
