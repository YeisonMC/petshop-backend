import { ejecutarTransaccion } from "../config/database.js";
import * as direccionesRepository from "../repositories/direcciones.repository.js";
import AppError from "../utils/app-error.js";

const bloquearCliente = async (idUsuario, connection) => {
    if (!await direccionesRepository.bloquearUsuario(idUsuario, connection)) {
        throw new AppError(
            "El usuario autenticado ya no está disponible",
            401,
            "AUTH_USER_NOT_FOUND"
        );
    }
};

const obtenerPropia = async (idUsuario, idDireccion, connection) => {
    const direccion = await direccionesRepository.obtenerActiva(
        idUsuario,
        idDireccion,
        connection
    );

    if (!direccion) {
        throw new AppError("La dirección no existe", 404, "ADDRESS_NOT_FOUND");
    }

    return direccion;
};

export const listar = async (idUsuario) => direccionesRepository.listarActivas(idUsuario);

export const crear = async (idUsuario, data) => {
    const idDireccion = await ejecutarTransaccion(async (connection) => {
        await bloquearCliente(idUsuario, connection);

        const existentes = await direccionesRepository.listarActivas(idUsuario, connection);
        const esPrincipal = existentes.length === 0 || data.es_principal === true;

        if (esPrincipal && existentes.length > 0) {
            await direccionesRepository.quitarPrincipal(idUsuario, connection);
        }

        return direccionesRepository.crear(idUsuario, data, esPrincipal, connection);
    });

    return direccionesRepository.obtenerActiva(idUsuario, idDireccion);
};

export const actualizar = async (idUsuario, idDireccion, data) => {
    await ejecutarTransaccion(async (connection) => {
        await bloquearCliente(idUsuario, connection);
        await obtenerPropia(idUsuario, idDireccion, connection);
        await direccionesRepository.actualizar(idUsuario, idDireccion, data, connection);
    });

    return direccionesRepository.obtenerActiva(idUsuario, idDireccion);
};

export const establecerPrincipal = async (idUsuario, idDireccion) => {
    await ejecutarTransaccion(async (connection) => {
        await bloquearCliente(idUsuario, connection);
        await obtenerPropia(idUsuario, idDireccion, connection);
        await direccionesRepository.quitarPrincipal(idUsuario, connection);
        await direccionesRepository.asignarPrincipal(idUsuario, idDireccion, connection);
    });

    return direccionesRepository.obtenerActiva(idUsuario, idDireccion);
};

export const eliminar = async (idUsuario, idDireccion) => {
    await ejecutarTransaccion(async (connection) => {
        await bloquearCliente(idUsuario, connection);
        const direccion = await obtenerPropia(idUsuario, idDireccion, connection);
        await direccionesRepository.desactivar(idUsuario, idDireccion, connection);

        if (direccion.es_principal) {
            const reemplazo = await direccionesRepository.primeraActiva(idUsuario, connection);

            if (reemplazo) {
                await direccionesRepository.asignarPrincipal(
                    idUsuario,
                    reemplazo.id_direccion,
                    connection
                );
            }
        }
    });
};
