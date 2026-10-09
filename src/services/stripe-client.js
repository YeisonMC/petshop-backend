import Stripe from "stripe";

import env from "../config/env.js";
import AppError from "../utils/app-error.js";

let testClient;
let client;

export const stripeClient = () => {
    if (testClient) return testClient;

    if (!env.STRIPE_SECRET_KEY) {
        throw new AppError("Stripe no está configurado", 503, "PAYMENTS_NOT_CONFIGURED");
    }

    client ??= new Stripe(env.STRIPE_SECRET_KEY);
    return client;
};

export const configurarStripeParaPruebas = (fakeClient) => {
    if (env.NODE_ENV !== "test") {
        throw new Error("Stripe solo puede reemplazarse durante las pruebas");
    }

    testClient = fakeClient;
};
