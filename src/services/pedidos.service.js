import { randomBytes } from "node:crypto";

import { ejecutarTransaccion } from "../config/database.js";
import * as pedidosRepository from "../repositories/pedidos.repository.js";
import AppError from "../utils/app-error.js";

const MAX_MONEY_CENTS = 9999999999;
const toMoney = (cents) => (cents / 100).toFixed(2);
const availableStock = (variant) => (
    Number(variant.stock_actual) - Number(variant.stock_reservado)
);

const normalizeOrder = (order, details) => ({
    ...order,
    subtotal: Number(order.subtotal),
    descuento: Number(order.descuento),
    costo_envio: Number(order.costo_envio),
    total: Number(order.total),
    ...(details ? {
        detalles: details.map((item) => ({
            ...item,
            precio_unitario: Number(item.precio_unitario),
            subtotal: Number(item.subtotal)
        }))
    } : {})
});

const ensureUser = async (idUsuario, connection) => {
    if (!await pedidosRepository.bloquearUsuario(idUsuario, connection)) {
        throw new AppError("El usuario autenticado ya no está disponible", 401, "AUTH_USER_NOT_FOUND");
    }
};

const ensureVariant = (variant, cantidad) => {
    if (!variant || !variant.variante_activa || variant.producto_estado !== "ACTIVO") {
        throw new AppError("Un producto del carrito ya no está disponible", 409, "VARIANT_NOT_AVAILABLE");
    }

    if (variant.stock_actual === null || availableStock(variant) < cantidad) {
        throw new AppError(
            "No existe stock suficiente para completar el pedido",
            409,
            "INSUFFICIENT_STOCK",
            { id_variante: variant.id_variante, stock_disponible: Math.max(0, availableStock(variant)) }
        );
    }
};

const prepareItem = (cartItem, variant) => {
    const cantidad = Number(cartItem.cantidad);
    const precioUnitarioCents = Math.round(Number(variant.precio_actual) * 100);

    if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 99
        || !Number.isSafeInteger(precioUnitarioCents) || precioUnitarioCents < 0) {
        throw new AppError("Un producto del carrito contiene datos inválidos", 409, "INVALID_CART_ITEM");
    }

    ensureVariant(variant, cantidad);

    return {
        idVariante: variant.id_variante,
        nombreProducto: variant.nombre_producto,
        sku: variant.sku,
        cantidad,
        precioUnitario: toMoney(precioUnitarioCents),
        subtotal: toMoney(precioUnitarioCents * cantidad),
        subtotalCents: precioUnitarioCents * cantidad,
        stockActual: Number(variant.stock_actual)
    };
};

const releaseReservation = async (order, connection, motivo) => {
    const details = await pedidosRepository.obtenerDetalles(order.id_pedido, connection);

    for (const detail of [...details].sort((a, b) => a.id_variante - b.id_variante)) {
        const variant = await pedidosRepository.obtenerVariante(detail.id_variante, connection);
        const cantidad = Number(detail.cantidad);

        if (!variant || Number(variant.stock_reservado) < cantidad) {
            throw new Error(`Reserva inconsistente para el pedido ${order.id_pedido}`);
        }

        const released = await pedidosRepository.liberarStock(
            detail.id_variante,
            cantidad,
            connection
        );

        if (!released) {
            throw new Error(`No se pudo liberar la reserva del pedido ${order.id_pedido}`);
        }

        await pedidosRepository.registrarMovimiento({
            idVariante: detail.id_variante,
            tipo: "LIBERACION",
            cantidad,
            motivo,
            referencia: order.codigo_pedido,
            stockAnterior: Number(variant.stock_actual),
            stockNuevo: Number(variant.stock_actual)
        }, connection);
    }

    if (!await pedidosRepository.marcarCancelado(order.id_pedido, connection)) {
        throw new Error(`No se pudo cancelar el pedido ${order.id_pedido}`);
    }
};

export const listar = async (idUsuario) => (
    (await pedidosRepository.listar(idUsuario)).map((order) => normalizeOrder(order))
);

export const obtener = async (idUsuario, idPedido) => {
    const order = await pedidosRepository.obtener(idUsuario, idPedido);

    if (!order) {
        throw new AppError("El pedido no existe", 404, "ORDER_NOT_FOUND");
    }

    const details = await pedidosRepository.obtenerDetalles(idPedido);
    return normalizeOrder(order, details);
};

export const crear = async (idUsuario, { id_direccion: idDireccion, observaciones }) => {
    const idPedido = await ejecutarTransaccion(async (connection) => {
        await ensureUser(idUsuario, connection);

        if (!await pedidosRepository.obtenerDireccionActiva(idUsuario, idDireccion, connection)) {
            throw new AppError("La dirección no existe", 404, "ADDRESS_NOT_FOUND");
        }

        const cart = await pedidosRepository.obtenerCarritoActivo(idUsuario, connection);

        if (!cart) {
            throw new AppError("El carrito está vacío", 409, "EMPTY_CART");
        }

        const cartItems = await pedidosRepository.obtenerItemsCarrito(cart.id_carrito, connection);

        if (cartItems.length === 0) {
            throw new AppError("El carrito está vacío", 409, "EMPTY_CART");
        }

        const items = [];
        let subtotalCents = 0;

        for (const cartItem of cartItems) {
            const variant = await pedidosRepository.obtenerVariante(cartItem.id_variante, connection);
            const item = prepareItem(cartItem, variant);
            subtotalCents += item.subtotalCents;

            if (!Number.isSafeInteger(subtotalCents) || subtotalCents > MAX_MONEY_CENTS) {
                throw new AppError("El total del pedido excede el límite permitido", 400, "ORDER_TOTAL_LIMIT");
            }

            items.push(item);
        }

        const codigo = `PED-${randomBytes(12).toString("hex").toUpperCase()}`;
        const orderId = await pedidosRepository.crear({
            idUsuario,
            idDireccion,
            codigo,
            subtotal: toMoney(subtotalCents),
            observaciones: observaciones ?? null
        }, connection);

        for (const item of items) {
            await pedidosRepository.crearDetalle(orderId, item, connection);

            if (!await pedidosRepository.reservarStock(
                item.idVariante,
                item.cantidad,
                connection
            )) {
                throw new AppError("No existe stock suficiente", 409, "INSUFFICIENT_STOCK");
            }

            await pedidosRepository.registrarMovimiento({
                idVariante: item.idVariante,
                tipo: "RESERVA",
                cantidad: item.cantidad,
                motivo: "Reserva por pedido pendiente",
                referencia: codigo,
                stockAnterior: item.stockActual,
                stockNuevo: item.stockActual
            }, connection);
        }

        if (!await pedidosRepository.convertirCarrito(cart.id_carrito, connection)) {
            throw new Error(`No se pudo convertir el carrito ${cart.id_carrito}`);
        }

        return orderId;
    });

    return obtener(idUsuario, idPedido);
};

export const cancelar = async (idUsuario, idPedido) => {
    await ejecutarTransaccion(async (connection) => {
        const order = await pedidosRepository.obtenerBloqueado(idPedido, idUsuario, connection);

        if (!order) {
            throw new AppError("El pedido no existe", 404, "ORDER_NOT_FOUND");
        }

        if (order.estado === "CANCELADO") {
            return;
        }

        if (order.estado !== "PENDIENTE") {
            throw new AppError("El pedido ya no puede cancelarse", 409, "ORDER_NOT_CANCELLABLE");
        }

        if (order.reserva_expira_at) {
            await releaseReservation(order, connection, "Cancelación del cliente");
        } else {
            await pedidosRepository.marcarCancelado(order.id_pedido, connection);
        }
    });

    return obtener(idUsuario, idPedido);
};

export const expirarVencidas = async () => {
    const ids = await pedidosRepository.listarIdsVencidos();
    const errors = [];
    let expired = 0;

    for (const idPedido of ids) {
        try {
            const changed = await ejecutarTransaccion(async (connection) => {
                const order = await pedidosRepository.obtenerVencidoBloqueado(idPedido, connection);

                if (!order) {
                    return false;
                }

                await releaseReservation(order, connection, "Vencimiento de reserva");
                return true;
            });

            if (changed) expired++;
        } catch (error) {
            errors.push(error);
        }
    }

    if (errors.length) {
        throw new AggregateError(errors, "No se pudieron expirar todas las reservas");
    }

    return expired;
};
