import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";
process.env.DB_NAME = "petshop_test";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const { default: app } = await import("../src/app.js");
const { cerrarPool } = await import("../src/config/database.js");

let server;
let baseUrl;

before(() => new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
    });
}));

after(async () => {
    await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
    await cerrarPool();
});

const get = (path, ip) => fetch(`${baseUrl}${path}`, {
    headers: { "X-Forwarded-For": ip }
});

test("solo /api tiene un límite de 300 solicitudes por IP", async () => {
    const first = await get("/api/health", "198.51.100.10");
    assert.equal(first.status, 200);
    assert.match(first.headers.get("ratelimit-policy"), /300-in-15min/);
    await first.arrayBuffer();

    for (let count = 1; count < 300; count += 1) {
        const response = await get("/api/health", "198.51.100.10");
        assert.equal(response.status, 200, `solicitud ${count + 1}`);
        await response.arrayBuffer();
    }

    const blocked = await get("/api/health", "198.51.100.10");
    assert.equal(blocked.status, 429);
    await blocked.arrayBuffer();

    for (const path of ["/", "/styles.css", "/vendor/aos/aos.js"]) {
        const response = await get(path, "198.51.100.10");
        assert.equal(response.status, 200, path);
        assert.equal(response.headers.get("ratelimit"), null, path);
        await response.arrayBuffer();
    }

    const otherClient = await get("/api/health", "198.51.100.11");
    assert.equal(otherClient.status, 200);
    await otherClient.arrayBuffer();
});
