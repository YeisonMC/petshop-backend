import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { cerrarPool, pool } from "../src/config/database.js";
import * as catalog from "../src/repositories/admin-catalog.repository.js";
import * as inventory from "../src/repositories/admin-inventory.repository.js";

const connection = await pool.getConnection();
const suffix = randomUUID().slice(0, 8);
const productSlug = `smoke-catalog-${suffix}`;

try {
    await connection.beginTransaction();
    const brandId = await catalog.crearMarca({ nombre: `Smoke Brand ${suffix}` }, connection);
    const categoryId = await catalog.crearCategoria({
        nombre: `Smoke Category ${suffix}`, slug: `smoke-category-${suffix}`
    }, connection);
    const productId = await catalog.crearProducto({
        id_marca: brandId, nombre: `Smoke Product ${suffix}`, slug: productSlug,
        descripcion_corta: "Prueba transaccional"
    }, connection);
    await catalog.reemplazarCategoriasProducto(productId, [categoryId], connection);
    await catalog.actualizarProducto(productId, { destacado: true }, connection);

    const variantId = await catalog.crearVariante(productId, {
        sku: `SMOKE-${suffix}`, nombre_variante: "Presentación de prueba", precio: 29.9
    }, connection);
    await catalog.crearInventarioVariante(variantId, { stock_minimo: 2 }, connection);
    await catalog.actualizarVariante(variantId, { precio_oferta: 24.9 }, connection);
    const lockedVariant = await catalog.bloquearVariante(variantId, connection);
    assert.equal(Number(lockedVariant.precio_oferta), 24.9);

    const imageId = await catalog.crearImagen(productId, {
        url_imagen: "https://example.invalid/producto-prueba.png", es_principal: true
    }, connection);
    await catalog.actualizarImagen(imageId, { texto_alternativo: "Imagen de prueba" }, connection);
    await catalog.asegurarImagenPrincipal(productId, connection);
    assert.equal((await catalog.obtenerImagenesProducto(productId, connection)).length, 1);

    const lockedInventory = await inventory.obtenerBloqueado(variantId, connection);
    assert.equal(lockedInventory.stock_actual, 0);
    await inventory.actualizarConfiguracion(variantId, {
        stock_minimo: 3, ubicacion_almacen: "SMOKE"
    }, connection);
    await inventory.actualizarStock(variantId, 5, connection);
    await inventory.registrarMovimiento({
        idVariante: variantId, tipo: "AJUSTE_POSITIVO", cantidad: 5,
        motivo: "Verificación transaccional", referencia: "SMOKE",
        anterior: 0, nuevo: 5
    }, connection);
    const [[count]] = await connection.execute(
        "SELECT COUNT(*) AS total FROM movimientos_inventario WHERE id_variante = ?", [variantId]
    );
    assert.equal(count.total, 1);
    console.log("OK escrituras SQL de marca, categoría, producto, variante, imagen e inventario.");
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    await connection.rollback();
    connection.release();
    const [[remaining]] = await pool.execute(
        "SELECT COUNT(*) AS total FROM productos WHERE slug = ?", [productSlug]
    );
    assert.equal(remaining.total, 0, "La prueba dejó un producto en la base");
    console.log("Rollback confirmado: no quedan datos de prueba.");
    await cerrarPool();
}
