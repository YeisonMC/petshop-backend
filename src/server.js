const app = require("./app");
const env = require("./config/env");
const { verificarConexion, cerrarPool } = require("./config/database");

let server;
let shuttingDown = false;

const shutdown = (signal) => {
    if (shuttingDown || !server) {
        return;
    }

    shuttingDown = true;
    console.log(`\n${signal} recibido. Cerrando servidor...`);

    const forceShutdown = setTimeout(() => {
        console.error("Cierre forzado por tiempo de espera agotado");
        process.exit(1);
    }, 10000);

    forceShutdown.unref();

    server.close(async (error) => {
        try {
            await cerrarPool();
        } catch (poolError) {
            console.error("No se pudo cerrar el pool de MySQL:", poolError);
        }

        if (error) {
            console.error("Error al cerrar el servidor:", error);
            process.exit(1);
        }

        console.log("Servidor cerrado correctamente");
        process.exit(0);
    });
};

const iniciarServidor = async () => {
    await verificarConexion();
    console.log("Conexión con MySQL verificada");

    server = app.listen(env.PORT, "0.0.0.0", () => {
        console.log("=================================");
        console.log("     PETSHOP API INICIADA");
        console.log("=================================");
        console.log(`Servidor ejecutándose en puerto ${env.PORT}`);
        console.log(`Entorno: ${env.NODE_ENV}`);
    });

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));

    return server;
};

if (require.main === module) {
    iniciarServidor().catch(async (error) => {
        console.error("No se pudo iniciar la API:", error.message);

        try {
            await cerrarPool();
        } catch (poolError) {
            console.error("No se pudo cerrar el pool de MySQL:", poolError.message);
        }

        process.exit(1);
    });
}

module.exports = {
    iniciarServidor
};
