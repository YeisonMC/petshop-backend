import assert from "node:assert/strict";
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
    addresses: [{ id_direccion: 1, id_usuario: 1 }, { id_direccion: 2, id_usuario: 2 }],
    carts: [{ id_carrito: 1, id_usuario: 1, estado: "ACTIVO" }],
    cartItems: [{ id_carrito: 1, id_variante: 2, cantidad: 2 }],
    inventory: { stock_actual: 65, stock_reservado: 5 },
    orders: [],
    details: [],
    movements: [],
    nextOrderId: 1,
    nextDetailId: 1
};

let snapshot;
let failNextReserve = false;

const execute = async (sql, params = []) => {
    const query = sql.replace(/\s+/g, " ").trim();

    if (query.startsWith("SELECT id_usuario FROM usuarios")) {
        return [[1, 2].includes(Number(params[0]))
            ? [{ id_usuario: Number(params[0]) }] : [], []];
    }

    if (query.startsWith("SELECT id_direccion FROM direcciones")) {
        const address = state.addresses.find((item) => (
            item.id_usuario === Number(params[0]) && item.id_direccion === Number(params[1])
        ));
        return [address ? [{ ...address }] : [], []];
    }

    if (query.startsWith("SELECT id_carrito FROM carritos")) {
        const cart = state.carts.find((item) => (
            item.id_usuario === Number(params[0]) && item.estado === "ACTIVO"
        ));
        return [cart ? [{ ...cart }] : [], []];
    }

    if (query.startsWith("SELECT id_variante, cantidad FROM detalle_carrito")) {
        return [state.cartItems.filter((item) => item.id_carrito === Number(params[0]))
            .map((item) => ({ ...item })), []];
    }

    if (query.includes("FROM variantes_producto vp")) {
        return [Number(params[0]) === 2 ? [{
            id_variante: 2,
            sku: "SKU-DEMO-002",
            variante_activa: 1,
            precio_actual: "12.50",
            nombre_producto: "Producto de prueba",
            producto_estado: "ACTIVO",
            ...state.inventory
        }] : [], []];
    }

    if (query.startsWith("INSERT INTO pedidos")) {
        const order = {
            id_pedido: state.nextOrderId++,
            id_usuario: Number(params[0]),
            id_direccion: Number(params[1]),
            codigo_pedido: params[2],
            estado: "PENDIENTE",
            subtotal: params[3],
            descuento: "0.00",
            costo_envio: "0.00",
            total: params[4],
            observaciones: params[5],
            fecha_pedido: new Date(),
            reserva_expira_at: new Date(Date.now() + 30 * 60 * 1000)
        };
        state.orders.push(order);
        return [{ insertId: order.id_pedido, affectedRows: 1 }, []];
    }

    if (query.startsWith("INSERT INTO detalle_pedido")) {
        state.details.push({
            id_detalle_pedido: state.nextDetailId++,
            id_pedido: Number(params[0]),
            id_variante: Number(params[1]),
            nombre_producto: params[2],
            sku: params[3],
            cantidad: Number(params[4]),
            precio_unitario: params[5],
            subtotal: params[6]
        });
        return [{ affectedRows: 1 }, []];
    }

    if (query.startsWith("UPDATE inventario SET stock_reservado = stock_reservado +")) {
        if (failNextReserve) {
            failNextReserve = false;
            return [{ affectedRows: 0 }, []];
        }
        const enough = Number(params[1]) === 2
            && state.inventory.stock_actual - state.inventory.stock_reservado >= Number(params[2]);
        if (enough) state.inventory.stock_reservado += Number(params[0]);
        return [{ affectedRows: Number(enough) }, []];
    }

    if (query.startsWith("UPDATE inventario SET stock_reservado = stock_reservado -")) {
        const enough = Number(params[1]) === 2
            && state.inventory.stock_reservado >= Number(params[2]);
        if (enough) state.inventory.stock_reservado -= Number(params[0]);
        return [{ affectedRows: Number(enough) }, []];
    }

    if (query.startsWith("INSERT INTO movimientos_inventario")) {
        state.movements.push({
            id_variante: Number(params[0]),
            tipo_movimiento: params[1],
            cantidad: Number(params[2]),
            motivo: params[3],
            referencia: params[4],
            stock_anterior: Number(params[5]),
            stock_nuevo: Number(params[6])
        });
        return [{ affectedRows: 1 }, []];
    }

    if (query.startsWith("UPDATE carritos SET estado = 'CONVERTIDO'")) {
        const cart = state.carts.find((item) => (
            item.id_carrito === Number(params[0]) && item.estado === "ACTIVO"
        ));
        if (cart) cart.estado = "CONVERTIDO";
        return [{ affectedRows: Number(Boolean(cart)) }, []];
    }

    if (query.startsWith("SELECT id_pedido FROM pedidos")) {
        const expired = state.orders.filter((item) => (
            item.estado === "PENDIENTE"
            && item.reserva_expira_at
            && item.reserva_expira_at <= new Date()
        ));
        return [expired.map((item) => ({ id_pedido: item.id_pedido })), []];
    }

    if (query.startsWith("SELECT id_detalle_pedido")) {
        return [state.details.filter((item) => item.id_pedido === Number(params[0]))
            .map((item) => ({ ...item })), []];
    }

    if (query.startsWith("SELECT") && query.includes("FROM pedidos")) {
        let orders = state.orders;

        if (query.includes("WHERE id_pedido = ?")) {
            orders = orders.filter((item) => item.id_pedido === Number(params[0]));
            if (query.includes("AND id_usuario = ?")) {
                orders = orders.filter((item) => item.id_usuario === Number(params[1]));
            }
        } else {
            orders = orders.filter((item) => item.id_usuario === Number(params[0]));
            if (query.includes("AND id_pedido = ?")) {
                orders = orders.filter((item) => item.id_pedido === Number(params[1]));
            }
        }

        if (query.includes("reserva_expira_at <= CURRENT_TIMESTAMP")) {
            orders = orders.filter((item) => (
                item.estado === "PENDIENTE"
                && item.reserva_expira_at
                && item.reserva_expira_at <= new Date()
            ));
        }

        return [orders.map((item) => ({ ...item })), []];
    }

    if (query.startsWith("UPDATE pedidos SET estado = 'CANCELADO'")) {
        const order = state.orders.find((item) => (
            item.id_pedido === Number(params[0]) && item.estado === "PENDIENTE"
        ));
        if (order) order.estado = "CANCELADO";
        return [{ affectedRows: Number(Boolean(order)) }, []];
    }

    throw new Error(`Consulta no simulada: ${query}`);
};

const fakePool = {
    execute,
    getConnection: async () => ({
        execute,
        beginTransaction: async () => { snapshot = structuredClone(state); },
        commit: async () => { snapshot = undefined; },
        rollback: async () => {
            Object.assign(state, snapshot);
            snapshot = undefined;
        },
        release: () => {}
    })
};

const { configurarPoolParaPruebas } = await import("../src/config/database.js");
configurarPoolParaPruebas(fakePool);
const { default: app } = await import("../src/app.js");
const { expirarVencidas } = await import("../src/services/pedidos.service.js");

const tokenFor = (id, role = "CLIENTE_WEB") => jwt.sign(
    { rol: role }, process.env.JWT_SECRET,
    { subject: String(id), expiresIn: "1h" }
);
const ownerToken = tokenFor(1);
const otherToken = tokenFor(2);
const adminToken = tokenFor(1, "ADMIN_CATALOGO");

let server;
let baseUrl;
const request = async (path, { method = "GET", body, token } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            Accept: "application/json",
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json() };
};

before(() => new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
    });
}));

after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
}));

test("pedidos exige autenticación y rol CLIENTE_WEB", async () => {
    assert.equal((await request("/api/pedidos")).status, 401);
    assert.equal((await request("/api/pedidos", { token: adminToken })).status, 403);
});

test("crear pedido rechaza dirección ajena y campos no permitidos", async () => {
    const otherAddress = await request("/api/pedidos", {
        method: "POST", token: ownerToken, body: { id_direccion: 2 }
    });
    const invalidBody = await request("/api/pedidos", {
        method: "POST", token: ownerToken, body: { id_direccion: 1, total: 1 }
    });
    assert.equal(otherAddress.status, 404);
    assert.equal(invalidBody.status, 400);
    assert.equal(state.orders.length, 0);
});

test("crear pedido rechaza carrito vacío y falta de stock", async () => {
    const originalItems = state.cartItems;
    state.cartItems = [];
    const empty = await request("/api/pedidos", {
        method: "POST", token: ownerToken, body: { id_direccion: 1 }
    });
    state.cartItems = originalItems;
    assert.equal(empty.status, 409);
    assert.equal(empty.body.error.code, "EMPTY_CART");

    state.inventory.stock_reservado = 64;
    const noStock = await request("/api/pedidos", {
        method: "POST", token: ownerToken, body: { id_direccion: 1 }
    });
    state.inventory.stock_reservado = 5;
    assert.equal(noStock.status, 409);
    assert.equal(noStock.body.error.code, "INSUFFICIENT_STOCK");
    assert.equal(state.orders.length, 0);
});

test("fallo al reservar revierte pedido, detalles e inventario", async () => {
    failNextReserve = true;
    const failed = await request("/api/pedidos", {
        method: "POST", token: ownerToken, body: { id_direccion: 1 }
    });
    assert.equal(failed.status, 409);
    assert.equal(state.orders.length, 0);
    assert.equal(state.details.length, 0);
    assert.equal(state.inventory.stock_reservado, 5);
    assert.equal(state.carts[0].estado, "ACTIVO");
});

test("crear pedido toma precio actual, reserva stock y convierte carrito", async () => {
    const response = await request("/api/pedidos", {
        method: "POST", token: ownerToken,
        body: { id_direccion: 1, observaciones: "Entregar en recepción" }
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.data.estado, "PENDIENTE");
    assert.equal(response.body.data.total, 25);
    assert.equal(response.body.data.detalles[0].precio_unitario, 12.5);
    assert.ok(response.body.data.reserva_expira_at);
    assert.equal(state.inventory.stock_reservado, 7);
    assert.equal(state.inventory.stock_actual, 65);
    assert.equal(state.carts[0].estado, "CONVERTIDO");
    assert.equal(state.movements[0].tipo_movimiento, "RESERVA");
    assert.equal(state.movements[0].stock_anterior, 65);
    assert.equal(state.movements[0].stock_nuevo, 65);
});

test("solo el propietario puede listar, consultar y cancelar su pedido", async () => {
    const list = await request("/api/pedidos", { token: ownerToken });
    const otherList = await request("/api/pedidos", { token: otherToken });
    const detail = await request("/api/pedidos/1", { token: ownerToken });
    const otherDetail = await request("/api/pedidos/1", { token: otherToken });
    const otherCancel = await request("/api/pedidos/1/cancelar", {
        method: "PATCH", token: otherToken
    });
    assert.equal(list.body.data.length, 1);
    assert.deepEqual(otherList.body.data, []);
    assert.equal(detail.body.data.detalles.length, 1);
    assert.equal(otherDetail.status, 404);
    assert.equal(otherCancel.status, 404);
    assert.equal(state.inventory.stock_reservado, 7);
});

test("cancelar libera una sola vez y registra movimiento", async () => {
    const canceled = await request("/api/pedidos/1/cancelar", {
        method: "PATCH", token: ownerToken
    });
    const repeated = await request("/api/pedidos/1/cancelar", {
        method: "PATCH", token: ownerToken
    });
    assert.equal(canceled.status, 200);
    assert.equal(repeated.status, 200);
    assert.equal(canceled.body.data.estado, "CANCELADO");
    assert.equal(state.inventory.stock_reservado, 5);
    assert.equal(state.movements.filter((item) => item.tipo_movimiento === "LIBERACION").length, 1);
    assert.equal(state.movements[1].stock_anterior, 65);
    assert.equal(state.movements[1].stock_nuevo, 65);
});

test("proceso de vencimiento libera pedidos expirados y es idempotente", async () => {
    state.carts.push({ id_carrito: 2, id_usuario: 1, estado: "ACTIVO" });
    state.cartItems.push({ id_carrito: 2, id_variante: 2, cantidad: 1 });
    const created = await request("/api/pedidos", {
        method: "POST", token: ownerToken, body: { id_direccion: 1 }
    });
    assert.equal(created.status, 201);
    state.orders[1].reserva_expira_at = new Date(Date.now() - 1000);

    assert.equal(await expirarVencidas(), 1);
    assert.equal(await expirarVencidas(), 0);
    assert.equal(state.orders[1].estado, "CANCELADO");
    assert.equal(state.inventory.stock_reservado, 5);
    assert.equal(state.movements.filter((item) => item.tipo_movimiento === "LIBERACION").length, 2);
});
