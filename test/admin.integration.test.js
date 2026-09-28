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

const users = [
    {
        id_usuario: 1, id_rol: 2, nombres: "Admin", apellidos: "Prueba",
        correo: "admin@petshop.test", password_hash: await bcrypt.hash("Admin1234!", 4),
        estado: 1, rol: "ADMIN_CATALOGO", rol_activo: 1
    },
    {
        id_usuario: 2, id_rol: 1, nombres: "Cliente", apellidos: "Prueba",
        correo: "cliente@petshop.test", password_hash: await bcrypt.hash("Cliente1234!", 4),
        estado: 1, rol: "CLIENTE_WEB", rol_activo: 1
    }
];
const inventory = {
    id_variante: 7, stock_actual: 10, stock_reservado: 3,
    stock_minimo: 4, ubicacion_almacen: "A1"
};
const variant = { id_variante: 7, id_producto: 3, sku: "TEST-7",
    nombre_variante: "Prueba", precio: 75, precio_oferta: 70, activo: 1 };
const movements = [];
const images = [];
let transactionStarted = 0;
let transactionCommitted = 0;
let transactionRolledBack = 0;

const execute = async (sql, params = []) => {
    const query = sql.replace(/\s+/g, " ").trim();
    if (query.includes("FROM usuarios u") && query.includes("WHERE u.correo = ?")) {
        const user = users.find((item) => item.correo === params[0]);
        return [user ? [{ ...user }] : [], []];
    }
    if (query.includes("FROM usuarios u") && query.includes("WHERE u.id_usuario = ?")) {
        const user = users.find((item) => item.id_usuario === Number(params[0]));
        return [user ? [{ ...user }] : [], []];
    }
    if (query.startsWith("UPDATE usuarios SET ultimo_acceso")) return [{ affectedRows: 1 }, []];
    if (query.startsWith("SELECT id_variante, stock_actual, stock_reservado, stock_minimo, ubicacion_almacen FROM inventario")) {
        return [Number(params[0]) === inventory.id_variante ? [{ ...inventory }] : [], []];
    }
    if (query.startsWith("UPDATE inventario SET stock_actual = ?")) {
        inventory.stock_actual = params[0];
        return [{ affectedRows: 1 }, []];
    }
    if (query.startsWith("UPDATE inventario SET stock_minimo = ?")) {
        inventory.stock_minimo = params[0];
        return [{ affectedRows: 1 }, []];
    }
    if (query.startsWith("INSERT INTO movimientos_inventario")) {
        movements.push({
            id_variante: params[0], tipo_movimiento: params[1], cantidad: params[2],
            motivo: params[3], referencia: params[4], stock_anterior: params[5], stock_nuevo: params[6]
        });
        return [{ insertId: movements.length }, []];
    }
    if (query.startsWith("SELECT id_producto FROM productos WHERE id_producto = ?")) {
        return [Number(params[0]) === 3 ? [{ id_producto: 3 }] : [], []];
    }
    if (query.includes("FROM imagenes_producto WHERE id_producto = ?")) {
        return [images.filter((item) => item.id_producto === Number(params[0])), []];
    }
    if (query.startsWith("UPDATE imagenes_producto SET es_principal = FALSE")) {
        images.forEach((item) => { if (item.id_producto === Number(params[0])) item.es_principal = false; });
        return [{ affectedRows: images.length }, []];
    }
    if (query.startsWith("INSERT INTO imagenes_producto")) {
        const image = {
            id_imagen: images.length + 20, id_producto: params[0], url_imagen: params[1],
            texto_alternativo: params[2], orden_visual: params[3], es_principal: params[4]
        };
        images.push(image);
        return [{ insertId: image.id_imagen }, []];
    }
    if (query.includes("FROM imagenes_producto WHERE id_imagen = ?")) {
        return [images.filter((item) => item.id_imagen === Number(params[0])), []];
    }
    if (query.includes("FROM movimientos_inventario WHERE id_variante = ?")) {
        return [movements.filter((item) => item.id_variante === Number(params[0])), []];
    }
    if (query.includes("FROM variantes_producto vp") && query.includes("WHERE vp.id_variante = ?")) {
        return [Number(params[0]) === 7 ? [{ ...variant, ...inventory }] : [], []];
    }
    if (query.startsWith("SELECT id_variante, precio, precio_oferta FROM variantes_producto")) {
        return [Number(params[0]) === 7 ? [{ ...variant }] : [], []];
    }
    if (query.startsWith("UPDATE variantes_producto SET")) {
        const columns = query.match(/SET (.+) WHERE/)?.[1].split(", ").map((part) => part.split(" = ")[0]);
        columns.forEach((column, index) => { variant[column] = params[index]; });
        return [{ affectedRows: 1 }, []];
    }
    if (query.includes("COUNT(*) AS total") && query.includes("FROM inventario i")) {
        return [[{ total: 1 }], []];
    }
    if (query.includes("FROM inventario i") && query.includes("ORDER BY")) {
        return [[{ ...inventory, stock_disponible: inventory.stock_actual - inventory.stock_reservado,
            sku: "TEST-7", nombre_variante: "Prueba", producto: "Producto de prueba",
            id_producto: 3, variante_activa: 1, producto_estado: "ACTIVO" }], []];
    }
    if (query.includes("FROM marcas ORDER BY nombre")) return [[{ id_marca: 4, nombre: "Marca prueba", estado: 1 }], []];
    if (query.startsWith("INSERT INTO marcas")) return [{ insertId: 4 }, []];
    if (query.includes("FROM marcas WHERE id_marca = ?")) {
        return [[{ id_marca: 4, nombre: "Marca prueba", estado: 1 }], []];
    }
    if (query.includes("AS productos_activos") && query.includes("AS stock_bajo")) {
        return [[{ productos: 5, productos_activos: 4, variantes_activas: 7,
            categorias_activas: 3, marcas_activas: 2, stock_bajo: 1 }], []];
    }
    throw new Error(`Consulta no simulada: ${query}`);
};

const fakePool = {
    execute,
    getConnection: async () => ({
        execute,
        beginTransaction: async () => { transactionStarted += 1; },
        commit: async () => { transactionCommitted += 1; },
        rollback: async () => { transactionRolledBack += 1; },
        release: () => {}
    }),
    end: async () => {}
};

const { configurarPoolParaPruebas } = await import("../src/config/database.js");
const { default: app } = await import("../src/app.js");
configurarPoolParaPruebas(fakePool);

const token = (id, role) => jwt.sign({ rol: role }, process.env.JWT_SECRET,
    { subject: String(id), expiresIn: "1h" });
const adminToken = token(1, "ADMIN_CATALOGO");
const customerToken = token(2, "CLIENTE_WEB");
let server;
let port;

before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = server.address().port;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); });

const request = async (path, { method = "GET", body, auth } = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: {
            ...(body ? { "content-type": "application/json" } : {}),
            ...(auth ? { authorization: `Bearer ${auth}` } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    return {
        status: response.status,
        headers: response.headers,
        body: response.status === 204 ? null : await response.json()
    };
};

test("el panel y la librería AOS se sirven desde el propio backend", async () => {
    const admin = await fetch(`http://127.0.0.1:${port}/admin/`);
    const aos = await fetch(`http://127.0.0.1:${port}/vendor/aos/aos.js`);
    assert.equal(admin.status, 200);
    assert.match(await admin.text(), /PetShop Studio/);
    assert.equal(aos.status, 200);
});

test("las rutas administrativas exigen sesión y rol de catálogo", async () => {
    const anonymous = await request("/api/admin/marcas");
    const customer = await request("/api/admin/marcas", { auth: customerToken });
    assert.equal(anonymous.status, 401);
    assert.equal(customer.status, 403);
    assert.equal(customer.body.error.code, "FORBIDDEN");
});

test("un token anterior deja de funcionar si se desactiva el administrador", async () => {
    users[0].estado = 0;
    const response = await request("/api/admin/marcas", { auth: adminToken });
    users[0].estado = 1;
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, "ADMIN_SESSION_INACTIVE");
});

test("el login administrativo rechaza clientes y acepta un administrador", async () => {
    const client = await request("/api/admin/auth/login", {
        method: "POST", body: { correo: "cliente@petshop.test", password: "Cliente1234!" }
    });
    const admin = await request("/api/admin/auth/login", {
        method: "POST", body: { correo: "admin@petshop.test", password: "Admin1234!" }
    });
    assert.equal(client.status, 401);
    assert.equal(admin.status, 200);
    assert.equal(admin.body.data.usuario.rol, "ADMIN_CATALOGO");
    assert.ok(admin.body.data.accessToken);
});

test("el perfil administrativo y resumen funcionan con token válido", async () => {
    const profile = await request("/api/admin/auth/perfil", { auth: adminToken });
    const summary = await request("/api/admin/resumen", { auth: adminToken });
    assert.equal(profile.status, 200);
    assert.equal(profile.body.data.correo, "admin@petshop.test");
    assert.equal(summary.status, 200);
    assert.equal(summary.body.data.stock_bajo, 1);
});

test("la validación bloquea productos e imágenes mal formados antes de escribir", async () => {
    const product = await request("/api/admin/productos", {
        method: "POST", auth: adminToken,
        body: { nombre: "Producto", slug: "mal Slug", categoria_ids: [] }
    });
    const image = await request("/api/admin/productos/3/imagenes", {
        method: "POST", auth: adminToken, body: { url_imagen: "javascript:alert(1)" }
    });
    assert.equal(product.status, 400);
    assert.equal(image.status, 400);
    assert.equal(product.body.error.code, "VALIDATION_ERROR");
});

test("la primera imagen se vuelve principal aunque se envíe false", async () => {
    const response = await request("/api/admin/productos/3/imagenes", {
        method: "POST", auth: adminToken,
        body: { url_imagen: "https://example.invalid/imagen.png", es_principal: false }
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.data.es_principal, true);
    assert.equal(images.length, 1);
});

test("una marca puede crearse solo con rol administrativo", async () => {
    const response = await request("/api/admin/marcas", {
        method: "POST", auth: adminToken, body: { nombre: "Marca prueba", estado: true }
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.data.id_marca, 4);
});

test("la variante conserva la restricción de oferta al actualizar el precio", async () => {
    const invalid = await request("/api/admin/variantes/7", {
        method: "PATCH", auth: adminToken, body: { precio: 65 }
    });
    assert.equal(invalid.status, 409);
    assert.equal(variant.precio, 75);
    const valid = await request("/api/admin/variantes/7", {
        method: "PATCH", auth: adminToken, body: { precio: 80, precio_oferta: 72 }
    });
    assert.equal(valid.status, 200);
    assert.equal(valid.body.data.precio, 80);
    assert.equal(valid.body.data.precio_oferta, 72);
});

test("el inventario expone físico, reservado y disponible", async () => {
    const response = await request("/api/admin/inventario", { auth: adminToken });
    assert.equal(response.status, 200);
    assert.equal(response.body.data[0].stock_actual, 10);
    assert.equal(response.body.data[0].stock_reservado, 3);
    assert.equal(response.body.data[0].stock_disponible, 7);
});

test("un ajuste positivo deja un movimiento con referencia al administrador", async () => {
    const response = await request("/api/admin/inventario/7/ajustes", {
        method: "POST", auth: adminToken,
        body: { cantidad: 5, motivo: "Ingreso de prueba" }
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.stock_actual, 15);
    assert.equal(movements.at(-1).tipo_movimiento, "AJUSTE_POSITIVO");
    assert.equal(movements.at(-1).referencia, "ADMIN:1");
    assert.equal(transactionStarted, transactionCommitted + transactionRolledBack);
});

test("no se puede bajar stock físico por debajo del reservado", async () => {
    const beforeStock = inventory.stock_actual;
    const beforeMovements = movements.length;
    const response = await request("/api/admin/inventario/7/ajustes", {
        method: "POST", auth: adminToken,
        body: { cantidad: -13, motivo: "Ajuste inválido" }
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, "STOCK_BELOW_RESERVED");
    assert.equal(inventory.stock_actual, beforeStock);
    assert.equal(movements.length, beforeMovements);
    assert.ok(transactionRolledBack > 0);
});

test("cero unidades y motivo corto fallan la validación", async () => {
    const response = await request("/api/admin/inventario/7/ajustes", {
        method: "POST", auth: adminToken, body: { cantidad: 0, motivo: "x" }
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
});

test("la configuración de stock mínimo queda separada del ajuste físico", async () => {
    const response = await request("/api/admin/inventario/7", {
        method: "PATCH", auth: adminToken, body: { stock_minimo: 8 }
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.stock_minimo, 8);
    assert.equal(response.body.data.stock_actual, 15);
});
