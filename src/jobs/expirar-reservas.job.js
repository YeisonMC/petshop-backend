import { expirarVencidas } from "../services/pedidos.service.js";

const INTERVAL_MS = 60 * 1000;

export const iniciarExpiracionReservas = () => {
    let currentRun = null;

    const run = () => {
        if (currentRun) return;

        currentRun = expirarVencidas()
            .catch((error) => {
                console.error("No se pudieron liberar todas las reservas vencidas:", error);
            })
            .finally(() => { currentRun = null; });
    };

    const timer = setInterval(run, INTERVAL_MS);
    timer.unref();
    run();

    return async () => {
        clearInterval(timer);
        if (currentRun) await currentRun;
    };
};
