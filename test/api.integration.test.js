import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";
process.env.DB_NAME = "petshop_test";

const fakePool = {
    execute: async (sql, params = []) => {
        const normalizedSql = sql.replace(/\s+/g, " ").trim();

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

const request = (path) => new Promise((resolve, reject) => {
    http.get(`${baseUrl}${path}`, (response) => {
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
