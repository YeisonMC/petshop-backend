import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";

import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";
process.env.DB_NAME = "petshop_test";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";
process.env.JWT_EXPIRES_IN = "1h";
process.env.BCRYPT_ROUNDS = "4";

const state = {
    cart: null,
    items: [],
    nextCartId: 1,
    nextItemId: 1,
    variant: {
        id_variante: 10,
        variante_activa: 1,
        precio_actual: "74.90",
        producto_estado: "ACTIVO",
        stock_disponible: "5"
    }
};

const execute = async (sql, params = []) => {
    const normalizedSql = sql.replace(/\s+/g, " ").trim();

    if (normalizedSql.startsWith("SELECT id_usuario FROM usuarios")) {
        return [[{ id_usuario: Number(params[0]) }], []];
    }

    if (normalizedSql.includes("FROM carritos") && normalizedSql.includes("estado = 'ACTIVO'")) {
        return [state.cart ? [{ ...state.cart }] : [], []];
    }

    if (normalizedSql.startsWith("INSERT INTO carritos")) {
        state.cart = {
            id_carrito: state.nextCartId++,
            id_usuario: Number(params[0]),
            estado: "ACTIVO",
            created_at: new Date(),
            updated_at: new Date()
        };
        return [{ insertId: state.cart.id_carrito, affectedRows: 1 }, []];
    }

    if (normalizedSql.includes("FROM variantes_producto vp") && normalizedSql.includes("FOR UPDATE")) {
        return Number(params[0]) === state.variant.id_variante
            ? [[{ ...state.variant }], []]
            : [[], []];
    }

    if (normalizedSql.includes("FROM detalle_carrito") && normalizedSql.includes("FOR UPDATE")) {
        const item = state.items.find((current) => (
            current.id_carrito === Number(params[0])
            && current.id_variante === Number(params[1])
        ));
        return [item ? [{ ...item }] : [], []];
    }

    if (normalizedSql.startsWith("INSERT INTO detalle_carrito")) {
        state.items.push({
            id_detalle_carrito: state.nextItemId++,
            id_carrito: Number(params[0]),
            id_variante: Number(params[1]),
            cantidad: Number(params[2]),
            precio_unitario: String(params[3])
        });
        return [{ insertId: state.nextItemId - 1, affectedRows: 1 }, []];
    }

    if (normalizedSql.startsWith("UPDATE detalle_carrito")) {
        const item = state.items.find((current) => (
            current.id_carrito === Number(params[2])
            && current.id_variante === Number(params[3])
        ));
        item.cantidad = Number(params[0]);
        item.precio_unitario = String(params[1]);
        return [{ affectedRows: 1 }, []];
    }

    if (normalizedSql.startsWith("DELETE FROM detalle_carrito")) {
        const index = state.items.findIndex((current) => (
            current.id_carrito === Number(params[0])
            && current.id_variante === Number(params[1])
        ));

        if (index === -1) {
            return [{ affectedRows: 0 }, []];
        }

        state.items.splice(index, 1);
        return [{ affectedRows: 1 }, []];
    }

    if (normalizedSql.startsWith("UPDATE carritos")) {
        state.cart.updated_at = new Date();
        return [{ affectedRows: 1 }, []];
    }

    if (normalizedSql.includes("FROM detalle_carrito dc")) {
        const items = state.items.map((item) => ({
            ...item,
            sku: "SKU-DEMO-001",
            nombre_variante: "Bolsa 3 kg",
            presentacion: "3 kg",
            variante_activa: 1,
            id_producto: 1,
            producto: "Croquetas Premium Adulto 3 kg",
            slug: "croquetas-premium-adulto-3kg-demo",
            producto_estado: "ACTIVO",
            marca: "NutriPet",
            stock_disponible: state.variant.stock_disponible,
            imagen_principal: "https://cdn.petshopdemo.pe/productos/croquetas-premium.jpg"
        }));
        return [items, []];
    }

    throw new Error(`Consulta no simulada: ${normalizedSql}`);
};

const fakePool = {
    execute,
    getConnection: async () => ({
        execute,
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {}
    })
};

const { configurarPoolParaPruebas } = await import("../src/config/database.js");
configurarPoolParaPruebas(fakePool);

const { default: app } = await import("../src/app.js");

const clientToken = jwt.sign(
    { rol: "CLIENTE_WEB" },
    process.env.JWT_SECRET,
    { subject: "1", expiresIn: "1h" }
);
const adminToken = jwt.sign(
    { rol: "ADMIN_CATALOGO" },
    process.env.JWT_SECRET,
    { subject: "1", expiresIn: "1h" }
);

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
        let responseBody = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
            responseBody += chunk;
        });
        response.on("end", () => {
            resolve({
                status: response.statusCode,
                body: JSON.parse(responseBody)
            });
        });
    });

    requestInstance.on("error", reject);

    if (serializedBody) {
        requestInstance.write(serializedBody);
    }

    requestInstance.end();
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

test("GET /api/carrito exige autenticación", async () => {
    const response = await request("/api/carrito");

    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, "AUTHENTICATION_REQUIRED");
});

test("GET /api/carrito exige el rol CLIENTE_WEB", async () => {
    const response = await request("/api/carrito", { token: adminToken });

    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, "FORBIDDEN");
});

test("GET /api/carrito devuelve un carrito vacío sin crear registros", async () => {
    const response = await request("/api/carrito", { token: clientToken });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.id_carrito, null);
    assert.deepEqual(response.body.data.items, []);
    assert.equal(state.cart, null);
});

test("POST /api/carrito/items crea el carrito y toma el precio desde la BD", async () => {
    const response = await request("/api/carrito/items", {
        method: "POST",
        token: clientToken,
        body: { id_variante: 10, cantidad: 2 }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.items[0].cantidad, 2);
    assert.equal(response.body.data.items[0].precio_unitario, 74.9);
    assert.equal(response.body.data.resumen.subtotal, 149.8);
});

test("POST /api/carrito/items acumula la cantidad de una variante existente", async () => {
    const response = await request("/api/carrito/items", {
        method: "POST",
        token: clientToken,
        body: { id_variante: 10, cantidad: 2 }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.items[0].cantidad, 4);
    assert.equal(response.body.data.resumen.cantidad_total, 4);
});

test("POST /api/carrito/items rechaza cantidades superiores al stock", async () => {
    const response = await request("/api/carrito/items", {
        method: "POST",
        token: clientToken,
        body: { id_variante: 10, cantidad: 2 }
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, "INSUFFICIENT_STOCK");
    assert.equal(response.body.error.details.stock_disponible, 5);
});

test("PATCH /api/carrito/items/:idVariante reemplaza la cantidad", async () => {
    const response = await request("/api/carrito/items/10", {
        method: "PATCH",
        token: clientToken,
        body: { cantidad: 3 }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.items[0].cantidad, 3);
    assert.equal(response.body.data.resumen.subtotal, 224.7);
});

test("PATCH /api/carrito/items/:idVariante valida la cantidad", async () => {
    const response = await request("/api/carrito/items/10", {
        method: "PATCH",
        token: clientToken,
        body: { cantidad: 0 }
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
});

test("DELETE /api/carrito/items/:idVariante elimina el producto", async () => {
    const response = await request("/api/carrito/items/10", {
        method: "DELETE",
        token: clientToken
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.items, []);
    assert.equal(response.body.data.resumen.subtotal, 0);
});

test("DELETE /api/carrito/items/:idVariante responde 404 si no existe", async () => {
    const response = await request("/api/carrito/items/10", {
        method: "DELETE",
        token: clientToken
    });

    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, "CART_ITEM_NOT_FOUND");
});
