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

const state = { addresses: [], nextId: 1 };
let transactionSnapshot;

const execute = async (sql, params = []) => {
    const query = sql.replace(/\s+/g, " ").trim();

    if (query.startsWith("SELECT id_usuario FROM usuarios")) {
        return [1, 2].includes(Number(params[0]))
            ? [[{ id_usuario: Number(params[0]) }], []]
            : [[], []];
    }

    if (query.startsWith("SELECT id_direccion FROM direcciones")) {
        const first = state.addresses.find((address) => (
            address.id_usuario === Number(params[0]) && address.estado
        ));
        return [first ? [{ id_direccion: first.id_direccion }] : [], []];
    }

    if (query.startsWith("SELECT") && query.includes("FROM direcciones")) {
        const rows = state.addresses.filter((address) => (
            address.id_usuario === Number(params[0])
            && address.estado
            && (params.length === 1 || address.id_direccion === Number(params[1]))
        )).sort((a, b) => Number(b.es_principal) - Number(a.es_principal)
            || a.id_direccion - b.id_direccion);
        return [rows.map((row) => ({ ...row })), []];
    }

    if (query.startsWith("INSERT INTO direcciones")) {
        const address = {
            id_direccion: state.nextId++,
            id_usuario: Number(params[0]),
            alias_direccion: params[1],
            receptor: params[2],
            telefono_contacto: params[3],
            direccion_linea1: params[4],
            direccion_linea2: params[5],
            distrito: params[6],
            provincia: params[7],
            departamento: params[8],
            codigo_postal: params[9],
            referencia: params[10],
            es_principal: Boolean(params[11]),
            estado: true
        };
        state.addresses.push(address);
        return [{ insertId: address.id_direccion, affectedRows: 1 }, []];
    }

    if (query.startsWith("UPDATE direcciones SET es_principal = FALSE")) {
        for (const address of state.addresses) {
            if (address.id_usuario === Number(params[0]) && address.estado) {
                address.es_principal = false;
            }
        }
        return [{ affectedRows: 1 }, []];
    }

    if (query.startsWith("UPDATE direcciones SET es_principal = TRUE")) {
        const address = state.addresses.find((row) => (
            row.id_usuario === Number(params[0])
            && row.id_direccion === Number(params[1])
            && row.estado
        ));
        address.es_principal = true;
        return [{ affectedRows: 1 }, []];
    }

    if (query.startsWith("UPDATE direcciones SET estado = FALSE")) {
        const address = state.addresses.find((row) => (
            row.id_usuario === Number(params[0])
            && row.id_direccion === Number(params[1])
            && row.estado
        ));
        address.estado = false;
        address.es_principal = false;
        return [{ affectedRows: 1 }, []];
    }

    if (query.startsWith("UPDATE direcciones SET")) {
        const fields = query.slice("UPDATE direcciones SET ".length, query.indexOf(" WHERE "))
            .split(", ").map((assignment) => assignment.split(" = ")[0]);
        const address = state.addresses.find((row) => (
            row.id_usuario === Number(params.at(-2))
            && row.id_direccion === Number(params.at(-1))
            && row.estado
        ));
        fields.forEach((field, index) => { address[field] = params[index]; });
        return [{ affectedRows: 1 }, []];
    }

    throw new Error(`Consulta no simulada: ${query}`);
};

const fakePool = {
    execute,
    getConnection: async () => ({
        execute,
        beginTransaction: async () => {
            transactionSnapshot = structuredClone(state.addresses);
        },
        commit: async () => { transactionSnapshot = undefined; },
        rollback: async () => {
            state.addresses = transactionSnapshot;
            transactionSnapshot = undefined;
        },
        release: () => {}
    })
};

const { configurarPoolParaPruebas } = await import("../src/config/database.js");
configurarPoolParaPruebas(fakePool);
const { default: app } = await import("../src/app.js");

const tokenFor = (id, role = "CLIENTE_WEB") => jwt.sign(
    { rol: role }, process.env.JWT_SECRET,
    { subject: String(id), expiresIn: "1h" }
);
const clientToken = tokenFor(1);
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

const address = (alias) => ({
    alias_direccion: alias,
    receptor: "Cliente de prueba",
    telefono_contacto: "987654321",
    direccion_linea1: "Av. Siempre Viva 123",
    distrito: "Miraflores",
    provincia: "Lima",
    departamento: "Lima"
});

before(() => new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
    });
}));

after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
}));

test("rutas de direcciones exigen autenticación y rol CLIENTE_WEB", async () => {
    const unauthenticated = await request("/api/direcciones");
    const forbidden = await request("/api/direcciones", { token: adminToken });
    assert.equal(unauthenticated.status, 401);
    assert.equal(forbidden.status, 403);
});

test("lista vacía y primera dirección principal automáticamente", async () => {
    const empty = await request("/api/direcciones", { token: clientToken });
    assert.deepEqual(empty.body.data, []);

    const created = await request("/api/direcciones", {
        method: "POST", token: clientToken, body: address("Casa")
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.es_principal, true);
    assert.equal(created.body.data.id_usuario, 1);
});

test("segunda dirección, actualización parcial y cambio de principal", async () => {
    const created = await request("/api/direcciones", {
        method: "POST", token: clientToken, body: address("Trabajo")
    });
    const id = created.body.data.id_direccion;
    assert.equal(created.body.data.es_principal, false);

    const updated = await request(`/api/direcciones/${id}`, {
        method: "PATCH", token: clientToken,
        body: { referencia: "Puerta azul", alias_direccion: null }
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.referencia, "Puerta azul");
    assert.equal(updated.body.data.alias_direccion, null);

    const primary = await request(`/api/direcciones/${id}/principal`, {
        method: "PATCH", token: clientToken
    });
    const list = await request("/api/direcciones", { token: clientToken });
    assert.equal(primary.body.data.es_principal, true);
    assert.equal(list.body.data.filter((item) => item.es_principal).length, 1);
    assert.equal(list.body.data[0].id_direccion, id);
});

test("solo el propietario puede modificar, seleccionar o eliminar la dirección", async () => {
    for (const method of ["PATCH", "DELETE"]) {
        const response = await request("/api/direcciones/1", {
            method, token: otherToken,
            ...(method === "PATCH" ? { body: { receptor: "Intruso" } } : {})
        });
        assert.equal(response.status, 404);
    }
    const primary = await request("/api/direcciones/1/principal", {
        method: "PATCH", token: otherToken
    });
    assert.equal(primary.status, 404);
});

test("validaciones impiden campos ajenos, vacío y rutas inválidas", async () => {
    const invalidCreate = await request("/api/direcciones", {
        method: "POST", token: clientToken,
        body: { ...address("Casa"), id_usuario: 2 }
    });
    const emptyPatch = await request("/api/direcciones/1", {
        method: "PATCH", token: clientToken, body: {}
    });
    const principalPatch = await request("/api/direcciones/1", {
        method: "PATCH", token: clientToken, body: { es_principal: true }
    });
    const invalidId = await request("/api/direcciones/no-id", {
        method: "DELETE", token: clientToken
    });
    for (const response of [invalidCreate, emptyPatch, principalPatch, invalidId]) {
        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, "VALIDATION_ERROR");
    }
});

test("baja lógica conserva el registro y reasigna la principal", async () => {
    const deleted = await request("/api/direcciones/2", {
        method: "DELETE", token: clientToken
    });
    const list = await request("/api/direcciones", { token: clientToken });
    assert.equal(deleted.status, 200);
    assert.equal(state.addresses.length, 2);
    assert.equal(state.addresses[1].estado, false);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].id_direccion, 1);
    assert.equal(list.body.data[0].es_principal, true);

    const again = await request("/api/direcciones/2", {
        method: "DELETE", token: clientToken
    });
    assert.equal(again.status, 404);
});
