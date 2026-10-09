import { ejecutarTransaccion } from "../config/database.js";
import env from "../config/env.js";
import * as pagosRepository from "../repositories/pagos.repository.js";
import * as pedidosRepository from "../repositories/pedidos.repository.js";
import AppError from "../utils/app-error.js";
import { stripeClient } from "./stripe-client.js";

const toCents = (amount) => {
    const match = String(amount).match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) throw new Error("Total del pedido inválido");

    const cents = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
    if (!Number.isSafeInteger(cents) || cents < 1 || cents > 99999999) {
        throw new AppError("El total no es compatible con Stripe", 409, "INVALID_PAYMENT_AMOUNT");
    }

    return cents;
};

const requireOrder = async (idUsuario, idPedido, connection) => {
    const order = await pedidosRepository.obtenerBloqueado(idPedido, idUsuario, connection);
    if (!order) throw new AppError("El pedido no existe", 404, "ORDER_NOT_FOUND");
    return order;
};

const verifyIntent = (order, payment, intent) => {
    if (intent.id !== payment.referencia_transaccion
        || intent.currency?.toLowerCase() !== "pen"
        || intent.amount !== toCents(order.total)
        || (intent.status === "succeeded" && intent.amount_received !== intent.amount)
        || intent.metadata?.id_pedido !== String(order.id_pedido)) {
        throw new Error(`Intento de pago inconsistente para el pedido ${order.id_pedido}`);
    }
};

const settle = async (order, payment, intent, connection) => {
    verifyIntent(order, payment, intent);
    if (intent.status !== "succeeded") return false;
    if (order.estado === "PAGADO") {
        if (payment.estado === "PENDIENTE") {
            await pagosRepository.marcarAprobado(payment.id_pago, connection);
        }
        return true;
    }
    if (order.estado !== "PENDIENTE") {
        throw new Error(`Pedido ${order.id_pedido} ya no admite el cobro ${intent.id}`);
    }

    const details = await pedidosRepository.obtenerDetalles(order.id_pedido, connection);
    if (!details.length) throw new Error(`Pedido ${order.id_pedido} sin detalles`);

    for (const detail of [...details].sort((a, b) => a.id_variante - b.id_variante)) {
        const variant = await pedidosRepository.obtenerVariante(detail.id_variante, connection);
        const cantidad = Number(detail.cantidad);
        if (!variant || Number(variant.stock_reservado) < cantidad) {
            throw new Error(`Reserva inconsistente para el pedido ${order.id_pedido}`);
        }

        if (!await pedidosRepository.descontarStockReservado(detail.id_variante, cantidad, connection)) {
            throw new Error(`No se pudo descontar el stock del pedido ${order.id_pedido}`);
        }

        await pedidosRepository.registrarMovimiento({
            idVariante: detail.id_variante,
            tipo: "SALIDA",
            cantidad,
            motivo: "Pago aprobado con Stripe",
            referencia: order.codigo_pedido,
            stockAnterior: Number(variant.stock_actual),
            stockNuevo: Number(variant.stock_actual) - cantidad
        }, connection);
    }

    if (!await pedidosRepository.marcarPagado(order.id_pedido, connection)) {
        throw new Error(`No se pudo marcar pagado el pedido ${order.id_pedido}`);
    }
    if (!await pagosRepository.marcarAprobado(payment.id_pago, connection)) {
        throw new Error(`No se pudo aprobar el pago ${payment.id_pago}`);
    }
    return true;
};

export const crearIntento = async (idUsuario, idPedido) => ejecutarTransaccion(async (connection) => {
    const order = await requireOrder(idUsuario, idPedido, connection);
    if (order.estado !== "PENDIENTE") {
        throw new AppError("El pedido ya no admite pagos", 409, "ORDER_NOT_PAYABLE");
    }
    if (!order.reserva_expira_at || new Date(order.reserva_expira_at) <= new Date()) {
        throw new AppError("La reserva del pedido venció", 409, "ORDER_RESERVATION_EXPIRED");
    }
    if (!env.STRIPE_PUBLISHABLE_KEY && env.NODE_ENV !== "test") {
        throw new AppError("Stripe no está configurado", 503, "PAYMENTS_NOT_CONFIGURED");
    }

    const stripe = stripeClient();
    let payment = await pagosRepository.obtenerPorPedido(idPedido, connection);
    let intent;

    if (payment) {
        intent = await stripe.paymentIntents.retrieve(payment.referencia_transaccion);
        verifyIntent(order, payment, intent);
        if (intent.status === "succeeded") {
            await settle(order, payment, intent, connection);
            return {
                id_pedido: order.id_pedido,
                id_pago: payment.id_pago,
                estado: "APROBADO",
                monto: Number(order.total),
                moneda: "PEN",
                reserva_expira_at: null,
                client_secret: null,
                publishable_key: env.STRIPE_PUBLISHABLE_KEY || "pk_test_mock"
            };
        }
        if (intent.status === "canceled") {
            throw new AppError("El intento de pago fue cancelado", 409, "PAYMENT_CANCELED");
        }
    } else {
        intent = await stripe.paymentIntents.create({
            amount: toCents(order.total),
            currency: "pen",
            payment_method_types: ["card"],
            metadata: {
                id_pedido: String(order.id_pedido),
                codigo_pedido: order.codigo_pedido
            }
        }, { idempotencyKey: `petshop-pedido-${order.id_pedido}-pago-v1` });
        await pagosRepository.crear(idPedido, order.total, intent.id, connection);
        payment = await pagosRepository.obtenerPorPedido(idPedido, connection);
    }

    return {
        id_pedido: order.id_pedido,
        id_pago: payment.id_pago,
        estado: payment.estado,
        monto: Number(order.total),
        moneda: "PEN",
        reserva_expira_at: order.reserva_expira_at,
        client_secret: intent.client_secret,
        publishable_key: env.STRIPE_PUBLISHABLE_KEY || "pk_test_mock"
    };
});

export const obtenerEstado = async (idUsuario, idPedido) => ejecutarTransaccion(async (connection) => {
    const order = await requireOrder(idUsuario, idPedido, connection);
    const payment = await pagosRepository.obtenerPorPedido(idPedido, connection);

    let paidNow = false;
    if (payment && order.estado === "PENDIENTE") {
        const intent = await stripeClient().paymentIntents.retrieve(payment.referencia_transaccion);
        if (intent.status === "succeeded") {
            paidNow = await settle(order, payment, intent, connection);
        }
    }

    return {
        id_pedido: order.id_pedido,
        estado_pedido: paidNow || order.estado === "PAGADO" ? "PAGADO" : order.estado,
        estado_pago: paidNow ? "APROBADO" : payment?.estado || null,
        monto: Number(order.total),
        moneda: "PEN"
    };
});

// Invocado con el pedido bloqueado: nunca liberar stock si el proveedor ya cobró.
export const prepararLiberacion = async (order, connection) => {
    const payment = await pagosRepository.obtenerPorPedido(order.id_pedido, connection);
    if (!payment) return true;

    const stripe = stripeClient();
    let intent = await stripe.paymentIntents.retrieve(payment.referencia_transaccion);
    verifyIntent(order, payment, intent);

    if (intent.status === "succeeded") {
        await settle(order, payment, intent, connection);
        return false;
    }
    if (intent.status === "processing") {
        throw new AppError("El pago aún está procesándose", 409, "PAYMENT_PROCESSING");
    }
    if (intent.status !== "canceled") {
        try {
            intent = await stripe.paymentIntents.cancel(intent.id);
        } catch (error) {
            // Una confirmación puede ganar la carrera al intento de cancelación.
            intent = await stripe.paymentIntents.retrieve(payment.referencia_transaccion);
            if (intent.status !== "succeeded") throw error;
        }
        if (intent.status === "succeeded") {
            await settle(order, payment, intent, connection);
            return false;
        }
        if (intent.status !== "canceled") {
            throw new AppError("No se pudo cancelar el pago", 409, "PAYMENT_NOT_CANCELLABLE");
        }
    }

    await pagosRepository.marcarRechazado(payment.id_pago, connection);
    return true;
};

export const procesarWebhook = async (body, signature) => {
    if (!env.STRIPE_WEBHOOK_SECRET) {
        throw new AppError("Webhook de Stripe no configurado", 503, "WEBHOOK_NOT_CONFIGURED");
    }

    let event;
    try {
        event = stripeClient().webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
        throw new AppError("Firma de Stripe inválida", 400, "INVALID_WEBHOOK_SIGNATURE");
    }

    if (event.type !== "payment_intent.succeeded") return;
    const intent = event.data.object;
    const idPedido = Number(intent.metadata?.id_pedido);
    if (!Number.isSafeInteger(idPedido) || idPedido <= 0) {
        throw new AppError("Pedido de Stripe inválido", 400, "INVALID_PAYMENT_ORDER");
    }

    await ejecutarTransaccion(async (connection) => {
        const order = await pedidosRepository.obtenerBloqueado(idPedido, null, connection);
        const payment = await pagosRepository.obtenerPorPedido(idPedido, connection);
        if (!order || !payment) throw new Error(`Pago ${intent.id} sin pedido registrado`);
        await settle(order, payment, intent, connection);
    });
};
