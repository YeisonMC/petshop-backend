import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import app from "../src/app.js";
import { cerrarPool, pool } from "../src/config/database.js";
import env from "../src/config/env.js";
import * as authRepository from "../src/repositories/auth.repository.js";

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
let temporaryAdmin = null;

const check = async (path, token) => {
    const response = await fetch(`${baseUrl}${path}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {}
    });
    assert.equal(response.status, 200, `${path} respondió ${response.status}: ${await response.text()}`);
    console.log(`OK ${path}`);
};

try {
    await check("/api/health");
    await check("/api/productos?sort=precio_asc&limit=3");
    await check("/api/productos?sort=precio_desc&limit=3");
    await check("/api/categorias");
    await check("/vendor/aos/aos.js");

    let [[admin]] = await pool.execute(`
        SELECT u.id_usuario FROM usuarios u
        INNER JOIN roles r ON r.id_rol = u.id_rol
        WHERE u.estado = TRUE AND r.estado = TRUE AND r.nombre = 'ADMIN_CATALOGO'
        LIMIT 1
    `);
    if (!admin && process.argv.includes("--temporary-admin")) {
        const role = await authRepository.obtenerRolActivoPorNombre("ADMIN_CATALOGO");
        assert.ok(role, "El rol ADMIN_CATALOGO no existe o está inactivo");
        const correo = `smoke-${randomUUID()}@example.invalid`;
        const password = `Smoke-${randomBytes(24).toString("base64url")}!`;
        const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
        const id = await authRepository.crearUsuario({
            idRol: role.id_rol, nombres: "Smoke", apellidos: "Temporal",
            correo, passwordHash, telefono: null, dni: null, ruc: null
        });
        temporaryAdmin = { id, correo };
        admin = { id_usuario: id };
        const login = await fetch(`${baseUrl}/api/admin/auth/login`, {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ correo, password })
        });
        assert.equal(login.status, 200, `El login temporal respondió ${login.status}`);
        console.log("OK /api/admin/auth/login (cuenta temporal)");
    }
    if (admin) {
        const token = jwt.sign({ rol: "ADMIN_CATALOGO" }, env.JWT_SECRET,
            { subject: String(admin.id_usuario), expiresIn: "1m" });
        for (const path of [
            "/api/admin/auth/perfil", "/api/admin/resumen", "/api/admin/marcas",
            "/api/admin/categorias", "/api/admin/productos?limit=3",
            "/api/admin/inventario?limit=3"
        ]) await check(path, token);
    } else {
        console.log("SKIP rutas protegidas: aún no existe una cuenta ADMIN_CATALOGO activa.");
    }
    console.log("Smoke test de solo lectura completado.");
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    await new Promise((resolve) => server.close(resolve));
    if (temporaryAdmin) {
        const [result] = await pool.execute(
            "DELETE FROM usuarios WHERE id_usuario = ? AND correo = ?",
            [temporaryAdmin.id, temporaryAdmin.correo]
        );
        assert.equal(result.affectedRows, 1, "No se pudo retirar la cuenta temporal");
        console.log("Cuenta temporal retirada.");
    }
    await cerrarPool();
}
