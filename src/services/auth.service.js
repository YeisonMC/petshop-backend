import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import env from "../config/env.js";
import * as authRepository from "../repositories/auth.repository.js";
import AppError from "../utils/app-error.js";
import ROLES from "../utils/roles.js";

const serializeUser = (user) => ({
    id_usuario: user.id_usuario,
    nombres: user.nombres,
    apellidos: user.apellidos,
    correo: user.correo,
    telefono: user.telefono,
    dni: user.dni,
    ruc: user.ruc,
    rol: user.rol,
    fecha_registro: user.fecha_registro,
    ultimo_acceso: user.ultimo_acceso
});

const createAccessToken = (user) => jwt.sign(
    { rol: user.rol },
    env.JWT_SECRET,
    {
        subject: String(user.id_usuario),
        expiresIn: env.JWT_EXPIRES_IN
    }
);

const createAuthResponse = (user) => ({
    usuario: serializeUser(user),
    accessToken: createAccessToken(user),
    tokenType: "Bearer",
    expiresIn: env.JWT_EXPIRES_IN
});

export const registrarCliente = async (data) => {
    const existingUser = await authRepository.obtenerPorCorreo(data.correo);

    if (existingUser) {
        throw new AppError(
            "Ya existe una cuenta registrada con ese correo",
            409,
            "USER_ALREADY_EXISTS"
        );
    }

    const clientRole = await authRepository.obtenerRolActivoPorNombre(
        ROLES.CLIENTE_WEB
    );

    if (!clientRole) {
        throw new AppError(
            "El rol de cliente no está configurado",
            500,
            "CLIENT_ROLE_NOT_CONFIGURED"
        );
    }

    const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS);
    const idUsuario = await authRepository.crearUsuario({
        ...data,
        idRol: clientRole.id_rol,
        passwordHash
    });
    const user = await authRepository.obtenerPorId(idUsuario);

    return createAuthResponse(user);
};

export const iniciarSesion = async ({ correo, password }) => {
    const user = await authRepository.obtenerPorCorreo(correo);
    const validPassword = user
        ? await bcrypt.compare(password, user.password_hash)
        : false;

    if (!user || !validPassword) {
        throw new AppError(
            "El correo o la contraseña son incorrectos",
            401,
            "INVALID_CREDENTIALS"
        );
    }

    if (!user.estado) {
        throw new AppError(
            "La cuenta se encuentra deshabilitada",
            403,
            "ACCOUNT_DISABLED"
        );
    }

    await authRepository.actualizarUltimoAcceso(user.id_usuario);
    const updatedUser = await authRepository.obtenerPorId(user.id_usuario);

    return createAuthResponse(updatedUser);
};

export const obtenerPerfil = async (idUsuario) => {
    const user = await authRepository.obtenerPorId(idUsuario);

    if (!user) {
        throw new AppError(
            "El usuario autenticado ya no existe",
            401,
            "AUTH_USER_NOT_FOUND"
        );
    }

    if (!user.estado) {
        throw new AppError(
            "La cuenta se encuentra deshabilitada",
            403,
            "ACCOUNT_DISABLED"
        );
    }

    return serializeUser(user);
};
