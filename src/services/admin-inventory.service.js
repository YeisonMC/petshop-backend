import { ejecutarTransaccion } from "../config/database.js";
import * as catalogRepository from "../repositories/admin-catalog.repository.js";
import * as repository from "../repositories/admin-inventory.repository.js";
import AppError from "../utils/app-error.js";

const normalize = (row) => ({
    ...row,
    stock_actual: Number(row.stock_actual),
    stock_reservado: Number(row.stock_reservado),
    stock_disponible: row.stock_disponible == null
        ? Number(row.stock_actual) - Number(row.stock_reservado)
        : Number(row.stock_disponible),
    stock_minimo: Number(row.stock_minimo),
    variante_activa: row.variante_activa == null ? undefined : Boolean(row.variante_activa)
});

export const listar = async (filters) => {
    const { rows, total } = await repository.listar(filters);
    return {
        data: rows.map(normalize),
        pagination: {
            page: filters.page,
            limit: filters.limit,
            total,
            totalPages: Math.ceil(total / filters.limit)
        }
    };
};

export const configurar = async (idVariante, data) => ejecutarTransaccion(async (connection) => {
    const inventory = await repository.obtenerBloqueado(idVariante, connection);
    if (!inventory) throw new AppError("La variante no tiene inventario", 404, "INVENTORY_NOT_FOUND");
    await repository.actualizarConfiguracion(idVariante, data, connection);
    return normalize({ ...inventory, ...data });
});

export const ajustar = async (idVariante, data, idAdmin) => ejecutarTransaccion(async (connection) => {
    const inventory = await repository.obtenerBloqueado(idVariante, connection);
    if (!inventory) throw new AppError("La variante no tiene inventario", 404, "INVENTORY_NOT_FOUND");

    const anterior = Number(inventory.stock_actual);
    const reservado = Number(inventory.stock_reservado);
    const nuevo = anterior + data.cantidad;
    if (nuevo < reservado) {
        throw new AppError(
            "No puedes dejar el stock físico por debajo del stock reservado",
            409,
            "STOCK_BELOW_RESERVED"
        );
    }
    if (nuevo > 2147483647) {
        throw new AppError("El stock excede el límite permitido", 400, "STOCK_LIMIT_EXCEEDED");
    }
    await repository.actualizarStock(idVariante, nuevo, connection);
    await repository.registrarMovimiento({
        idVariante,
        tipo: data.cantidad > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO",
        cantidad: Math.abs(data.cantidad),
        motivo: data.motivo,
        referencia: `ADMIN:${idAdmin}`,
        anterior,
        nuevo
    }, connection);
    return normalize({ ...inventory, stock_actual: nuevo });
});

export const listarMovimientos = async (idVariante) => {
    if (!await catalogRepository.obtenerVariante(idVariante)) {
        throw new AppError("La variante no existe", 404, "VARIANT_NOT_FOUND");
    }
    return repository.listarMovimientos(idVariante);
};
