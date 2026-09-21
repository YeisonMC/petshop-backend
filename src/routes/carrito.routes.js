import express from "express";

import * as carritoController from "../controllers/carrito.controller.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";
import validate from "../middlewares/validate.js";
import asyncHandler from "../utils/async-handler.js";
import ROLES from "../utils/roles.js";
import {
    actualizarItemSchema,
    agregarItemSchema,
    itemParamsSchema
} from "../validators/carrito.validator.js";

const router = express.Router();

router.use(authenticate, authorize(ROLES.CLIENTE_WEB));

router.get("/", asyncHandler(carritoController.obtener));

router.post(
    "/items",
    validate(agregarItemSchema),
    asyncHandler(carritoController.agregarItem)
);

router.patch(
    "/items/:idVariante",
    validate(itemParamsSchema, "params"),
    validate(actualizarItemSchema),
    asyncHandler(carritoController.actualizarItem)
);

router.delete(
    "/items/:idVariante",
    validate(itemParamsSchema, "params"),
    asyncHandler(carritoController.eliminarItem)
);

export default router;
