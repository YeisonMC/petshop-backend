import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";
process.env.DB_NAME = "petshop_test";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";
process.env.JWT_EXPIRES_IN = "1h";
process.env.BCRYPT_ROUNDS = "4";

const users = [{
    id_usuario: 1,
    id_rol: 1,
    nombres: "Cliente",
    apellidos: "Prueba",
    correo: "cliente@petshop.test",
    password_hash: await bcrypt.hash("Cliente123", 4),
    telefono: "999888777",
    dni: "70000001",
    ruc: null,
    estado: 1,
    fecha_registro: new Date("2026-09-01T00:00:00Z"),
    ultimo_acceso: null,
    rol: "CLIENTE_WEB"
}];

const fakePool = {
    execute: async (sql, params = []) => {
        const normalizedSql = sql.replace(/\s+/g, " ").trim();

        if (normalizedSql.includes("FROM usuarios u") && normalizedSql.includes("WHERE u.correo = ?")) {
            const user = users.find((item) => item.correo === params[0]);
            return [user ? [{ ...user }] : [], []];
        }

        if (normalizedSql.includes("FROM usuarios u") && normalizedSql.includes("WHERE u.id_usuario = ?")) {
            const user = users.find((item) => item.id_usuario === Number(params[0]));
            return [user ? [{ ...user }] : [], []];
        }

        if (normalizedSql.includes("FROM roles") && normalizedSql.includes("WHERE nombre = ?")) {
            return params[0] === "CLIENTE_WEB"
                ? [[{ id_rol: 1, nombre: "CLIENTE_WEB" }], []]
                : [[], []];
        }

        if (normalizedSql.startsWith("INSERT INTO usuarios")) {
            const idUsuario = Math.max(...users.map((user) => user.id_usuario)) + 1;
            users.push({
                id_usuario: idUsuario,
                id_rol: params[0],
                nombres: params[1],
                apellidos: params[2],
                correo: params[3],
                password_hash: params[4],
                telefono: params[5],
                dni: params[6],
                ruc: params[7],
                estado: 1,
                fecha_registro: new Date(),
                ultimo_acceso: null,
                rol: "CLIENTE_WEB"
            });
            return [{ insertId: idUsuario, affectedRows: 1 }, []];
        }

        if (normalizedSql.startsWith("UPDATE usuarios SET ultimo_acceso")) {
            const user = users.find((item) => item.id_usuario === Number(params[0]));
            user.ultimo_acceso = new Date();
            return [{ affectedRows: 1 }, []];
        }

        if (normalizedSql.includes("COUNT(DISTINCT p.id_producto) AS total")) {
            return [[{ total: 1 }], []];
        }

        if (normalizedSql.includes("resumen_variantes.precio_desde")) {
            return [[{
                id_producto: 1,
                nombre: "Croquetas Premium Adulto 3 kg",
                slug: "croquetas-premium-adulto-3kg-demo",
                descripcion_corta: "Alimento seco para mascotas adultas",
                destacado: 1,
                created_at: new Date("2026-09-01T00:00:00Z"),
                id_marca: 1,
                marca: "NutriPet",
                precio_desde: "74.90",
                precio_regular_desde: "79.90",
                stock_disponible: "37",
                cantidad_variantes: "1",
                tiene_oferta: 1,
                imagen_principal: "https://cdn.petshopdemo.pe/productos/croquetas-premium.jpg"
            }], []];
        }

        if (normalizedSql.includes("p.descripcion_larga") && normalizedSql.includes("WHERE p.slug = ?")) {
            if (params[0] !== "croquetas-premium-adulto-3kg-demo") {
                return [[], []];
            }

            return [[{
                id_producto: 1,
                nombre: "Croquetas Premium Adulto 3 kg",
                slug: "croquetas-premium-adulto-3kg-demo",
                descripcion_corta: "Alimento seco para mascotas adultas",
                descripcion_larga: "Fórmula completa para alimentación diaria.",
                beneficios: "Ayuda a mantener energía y buena digestión.",
                ingredientes: "Proteína animal, cereales, vitaminas y minerales.",
                requiere_receta: 0,
                destacado: 1,
                id_marca: 1,
                marca: "NutriPet"
            }], []];
        }

        if (normalizedSql.includes("INNER JOIN producto_categoria pc")) {
            return [[{
                id_categoria: 1,
                nombre: "Alimentos",
                slug: "alimentos"
            }], []];
        }

        if (normalizedSql.includes("FROM variantes_producto vp")) {
            return [[{
                id_variante: 1,
                sku: "SKU-DEMO-001",
                nombre_variante: "Bolsa 3 kg",
                presentacion: "3 kg",
                unidad_medida: "kg",
                precio: "79.90",
                precio_oferta: "74.90",
                precio_actual: "74.90",
                peso_kg: "3.000",
                dimensiones: "40x25x12 cm",
                stock_actual: "40",
                stock_reservado: "3",
                stock_disponible: "37"
            }], []];
        }

        if (normalizedSql.includes("FROM imagenes_producto")) {
            return [[{
                id_imagen: 1,
                url_imagen: "https://cdn.petshopdemo.pe/productos/croquetas-premium.jpg",
                texto_alternativo: "Croquetas Premium Adulto",
                orden_visual: 1,
                es_principal: 1
            }], []];
        }

        if (normalizedSql.includes("FROM resenas")) {
            return [[{
                cantidad_resenas: "3",
                promedio_calificacion: "4.7"
            }], []];
        }

        if (normalizedSql.includes("FROM categorias c")) {
            return [[{
                id_categoria: 1,
                id_categoria_padre: null,
                nombre: "Alimentos",
                slug: "alimentos",
                descripcion: "Productos de alimentación para mascotas",
                categoria_padre: null,
                cantidad_productos: "1"
            }], []];
        }

        throw new Error(`Consulta no simulada: ${normalizedSql}`);
    }
};

const { configurarPoolParaPruebas } = await import("../src/config/database.js");
configurarPoolParaPruebas(fakePool);

const { default: app } = await import("../src/app.js");

let server;
let baseUrl;

const request = (path, { method = "GET", body = null, token = null } = {}) => new Promise((resolve, reject) => {
    const serializedBody = body === null ? null : JSON.stringify(body);
    const headers = { Accept: "application/json" };

    if (serializedBody) {
        headers["Content-Type"] = "application/json";
        headers["Content-Length"] = Buffer.byteLength(serializedBody);
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const requestInstance = http.request(`${baseUrl}${path}`, { method, headers }, (response) => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
            body += chunk;
        });
        response.on("end", () => {
            resolve({
                status: response.statusCode,
                body: JSON.parse(body)
            });
        });
    });

    requestInstance.on("error", reject);

    if (serializedBody) {
        requestInstance.write(serializedBody);
    }

    requestInstance.end();
});

const requestText = (path) => new Promise((resolve, reject) => {
    http.get(`${baseUrl}${path}`, (response) => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
            body += chunk;
        });
        response.on("end", () => {
            resolve({
                status: response.statusCode,
                contentType: response.headers["content-type"],
                body
            });
        });
    }).on("error", reject);
});

before(() => new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
    });
}));

after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
}));

test("GET / sirve la página de prueba del catálogo", async () => {
    const response = await requestText("/");

    assert.equal(response.status, 200);
    assert.match(response.contentType, /text\/html/);
    assert.match(response.body, /Catálogo de productos/);
    assert.match(response.body, /bootstrap@5\.3\.8/);
});

test("POST /api/auth/registro crea un CLIENTE_WEB y devuelve un JWT", async () => {
    const response = await request("/api/auth/registro", {
        method: "POST",
        body: {
            nombres: "María",
            apellidos: "López Pérez",
            correo: "Maria.Nueva@Example.com",
            password: "Segura123",
            telefono: "987654321",
            dni: "70000002"
        }
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.usuario.correo, "maria.nueva@example.com");
    assert.equal(response.body.data.usuario.rol, "CLIENTE_WEB");
    assert.equal(typeof response.body.data.accessToken, "string");
    assert.equal("password_hash" in response.body.data.usuario, false);
    assert.notEqual(users[1].password_hash, "Segura123");
});

test("POST /api/auth/registro rechaza un correo duplicado", async () => {
    const response = await request("/api/auth/registro", {
        method: "POST",
        body: {
            nombres: "Otro",
            apellidos: "Cliente",
            correo: "maria.nueva@example.com",
            password: "Segura123"
        }
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, "USER_ALREADY_EXISTS");
});

test("POST /api/auth/registro valida la seguridad de la contraseña", async () => {
    const response = await request("/api/auth/registro", {
        method: "POST",
        body: {
            nombres: "Nuevo",
            apellidos: "Cliente",
            correo: "nuevo@example.com",
            password: "debil"
        }
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
});

let accessToken;

test("POST /api/auth/login autentica credenciales válidas", async () => {
    const response = await request("/api/auth/login", {
        method: "POST",
        body: {
            correo: "cliente@petshop.test",
            password: "Cliente123"
        }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.usuario.id_usuario, 1);
    assert.equal(response.body.data.tokenType, "Bearer");
    assert.equal(typeof response.body.data.accessToken, "string");

    accessToken = response.body.data.accessToken;
});

test("POST /api/auth/login no revela cuál credencial es incorrecta", async () => {
    const response = await request("/api/auth/login", {
        method: "POST",
        body: {
            correo: "cliente@petshop.test",
            password: "Incorrecta123"
        }
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, "INVALID_CREDENTIALS");
});

test("GET /api/auth/perfil exige autenticación", async () => {
    const response = await request("/api/auth/perfil");

    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, "AUTHENTICATION_REQUIRED");
});

test("GET /api/auth/perfil devuelve al usuario autenticado", async () => {
    const response = await request("/api/auth/perfil", { token: accessToken });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.correo, "cliente@petshop.test");
    assert.equal(response.body.data.rol, "CLIENTE_WEB");
    assert.equal("password_hash" in response.body.data, false);
});

test("GET /api/auth/perfil rechaza tokens inválidos", async () => {
    const response = await request("/api/auth/perfil", { token: "token-invalido" });

    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, "INVALID_TOKEN");
});

test("GET /api/auth/perfil rechaza roles distintos de CLIENTE_WEB", async () => {
    const token = jwt.sign(
        { rol: "ADMIN_CATALOGO" },
        process.env.JWT_SECRET,
        { subject: "1", expiresIn: "1h" }
    );
    const response = await request("/api/auth/perfil", { token });

    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, "FORBIDDEN");
});

test("GET /api/productos devuelve precio, imagen, stock y paginación", async () => {
    const response = await request("/api/productos?page=1&limit=12");

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data[0].precio_desde, 74.9);
    assert.equal(response.body.data[0].stock_disponible, 37);
    assert.equal(response.body.data[0].disponible, true);
    assert.match(response.body.data[0].imagen_principal, /croquetas-premium/);
    assert.deepEqual(response.body.pagination, {
        page: 1,
        limit: 12,
        total: 1,
        totalPages: 1
    });
});

test("GET /api/productos/:slug devuelve el detalle del producto", async () => {
    const response = await request(
        "/api/productos/croquetas-premium-adulto-3kg-demo"
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.data.slug, "croquetas-premium-adulto-3kg-demo");
    assert.equal(response.body.data.variantes[0].precio_actual, 74.9);
    assert.equal(response.body.data.resenas.promedio, 4.7);
});

test("GET /api/productos/:slug responde 404 cuando el producto no existe", async () => {
    const response = await request("/api/productos/producto-inexistente");

    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, "PRODUCT_NOT_FOUND");
});

test("GET /api/categorias devuelve categorías con cantidad de productos", async () => {
    const response = await request("/api/categorias");

    assert.equal(response.status, 200);
    assert.equal(response.body.cantidad, 1);
    assert.equal(response.body.data[0].cantidad_productos, 1);
});

test("la validación con Zod rechaza límites fuera de rango", async () => {
    const response = await request("/api/productos?limit=1000");

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
});

test("el middleware notFound responde con un error uniforme", async () => {
    const response = await request("/api/ruta-inexistente");

    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, "ROUTE_NOT_FOUND");
});
