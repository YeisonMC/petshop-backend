import { ejecutarTransaccion } from "../config/database.js";
import * as carritoRepository from "../repositories/carrito.repository.js";
import AppError from "../utils/app-error.js";

const MAX_ITEM_QUANTITY = 99;

const lockAuthenticatedUser = async (idUsuario, connection) => {
    const userExists = await carritoRepository.bloquearUsuario(
        idUsuario,
        connection
    );

    if (!userExists) {
        throw new AppError(
            "El usuario autenticado ya no existe",
            401,
            "AUTH_USER_NOT_FOUND"
        );
    }
};

const ensureAvailableVariant = (variant) => {
    if (!variant) {
        throw new AppError(
            "La variante solicitada no existe",
            404,
            "VARIANT_NOT_FOUND"
        );
    }

    if (!variant.variante_activa || variant.producto_estado !== "ACTIVO") {
        throw new AppError(
            "La variante no está disponible para la venta",
            409,
            "VARIANT_NOT_AVAILABLE"
        );
    }
};

const ensureStock = (variant, requestedQuantity) => {
    const availableStock = Number(variant.stock_disponible);

    if (requestedQuantity > availableStock) {
        throw new AppError(
            "No existe stock suficiente para la cantidad solicitada",
            409,
            "INSUFFICIENT_STOCK",
            {
                stock_disponible: availableStock,
                cantidad_solicitada: requestedQuantity
            }
        );
    }
};

const ensureQuantityLimit = (quantity) => {
    if (quantity > MAX_ITEM_QUANTITY) {
        throw new AppError(
            `No puedes agregar más de ${MAX_ITEM_QUANTITY} unidades de una variante`,
            400,
            "CART_QUANTITY_LIMIT"
        );
    }
};

const normalizeCart = (cart, items) => {
    const normalizedItems = items.map((item) => {
        const quantity = Number(item.cantidad);
        const unitPrice = Number(item.precio_unitario);
        const availableStock = Number(item.stock_disponible);

        return {
            ...item,
            cantidad: quantity,
            precio_unitario: unitPrice,
            subtotal: Number((quantity * unitPrice).toFixed(2)),
            variante_activa: Boolean(item.variante_activa),
            stock_disponible: availableStock,
            disponible: Boolean(item.variante_activa)
                && item.producto_estado === "ACTIVO"
                && availableStock >= quantity
        };
    });

    return {
        id_carrito: cart?.id_carrito || null,
        estado: cart?.estado || "ACTIVO",
        items: normalizedItems,
        resumen: {
            productos_distintos: normalizedItems.length,
            cantidad_total: normalizedItems.reduce(
                (total, item) => total + item.cantidad,
                0
            ),
            subtotal: Number(normalizedItems.reduce(
                (total, item) => total + item.subtotal,
                0
            ).toFixed(2))
        }
    };
};

export const obtenerCarrito = async (idUsuario) => {
    const cart = await carritoRepository.obtenerActivoPorUsuario(idUsuario);

    if (!cart) {
        return normalizeCart(null, []);
    }

    const items = await carritoRepository.obtenerItems(cart.id_carrito);
    return normalizeCart(cart, items);
};

export const agregarItem = async (idUsuario, { id_variante: idVariante, cantidad }) => {
    await ejecutarTransaccion(async (connection) => {
        await lockAuthenticatedUser(idUsuario, connection);

        let cart = await carritoRepository.obtenerActivoPorUsuario(
            idUsuario,
            connection,
            true
        );

        if (!cart) {
            cart = await carritoRepository.crearCarrito(idUsuario, connection);
        }

        const variant = await carritoRepository.obtenerVarianteParaCarrito(
            idVariante,
            connection
        );
        ensureAvailableVariant(variant);

        const existingItem = await carritoRepository.obtenerItem(
            cart.id_carrito,
            idVariante,
            connection
        );
        const finalQuantity = Number(existingItem?.cantidad || 0) + cantidad;

        ensureQuantityLimit(finalQuantity);
        ensureStock(variant, finalQuantity);

        const itemData = {
            idCarrito: cart.id_carrito,
            idVariante,
            cantidad: finalQuantity,
            precioUnitario: Number(variant.precio_actual)
        };

        if (existingItem) {
            await carritoRepository.actualizarItem(itemData, connection);
        } else {
            await carritoRepository.insertarItem(itemData, connection);
        }

        await carritoRepository.actualizarFechaCarrito(cart.id_carrito, connection);
    });

    return obtenerCarrito(idUsuario);
};

export const actualizarCantidad = async (idUsuario, idVariante, cantidad) => {
    await ejecutarTransaccion(async (connection) => {
        await lockAuthenticatedUser(idUsuario, connection);
        const cart = await carritoRepository.obtenerActivoPorUsuario(
            idUsuario,
            connection,
            true
        );

        if (!cart) {
            throw new AppError(
                "El producto no pertenece al carrito activo",
                404,
                "CART_ITEM_NOT_FOUND"
            );
        }

        const existingItem = await carritoRepository.obtenerItem(
            cart.id_carrito,
            idVariante,
            connection
        );

        if (!existingItem) {
            throw new AppError(
                "El producto no pertenece al carrito activo",
                404,
                "CART_ITEM_NOT_FOUND"
            );
        }

        const variant = await carritoRepository.obtenerVarianteParaCarrito(
            idVariante,
            connection
        );
        ensureAvailableVariant(variant);
        ensureStock(variant, cantidad);

        await carritoRepository.actualizarItem({
            idCarrito: cart.id_carrito,
            idVariante,
            cantidad,
            precioUnitario: Number(variant.precio_actual)
        }, connection);
        await carritoRepository.actualizarFechaCarrito(cart.id_carrito, connection);
    });

    return obtenerCarrito(idUsuario);
};

export const eliminarItem = async (idUsuario, idVariante) => {
    await ejecutarTransaccion(async (connection) => {
        await lockAuthenticatedUser(idUsuario, connection);
        const cart = await carritoRepository.obtenerActivoPorUsuario(
            idUsuario,
            connection,
            true
        );

        if (!cart) {
            throw new AppError(
                "El producto no pertenece al carrito activo",
                404,
                "CART_ITEM_NOT_FOUND"
            );
        }

        const deleted = await carritoRepository.eliminarItem(
            cart.id_carrito,
            idVariante,
            connection
        );

        if (!deleted) {
            throw new AppError(
                "El producto no pertenece al carrito activo",
                404,
                "CART_ITEM_NOT_FOUND"
            );
        }

        await carritoRepository.actualizarFechaCarrito(cart.id_carrito, connection);
    });

    return obtenerCarrito(idUsuario);
};
