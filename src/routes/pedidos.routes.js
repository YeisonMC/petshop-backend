import express from "express";

import * as pedidosController from "../controllers/pedidos.controller.js";
import * as pagosController from "../controllers/pagos.controller.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";
import validate from "../middlewares/validate.js";
import asyncHandler from "../utils/async-handler.js";
import ROLES from "../utils/roles.js";
import { crearPedidoSchema, pedidoParamsSchema } from "../validators/pedidos.validator.js";

const router = express.Router();

router.use(authenticate, authorize(ROLES.CLIENTE_WEB));

router.get("/", asyncHandler(pedidosController.listar));
router.post("/", validate(crearPedidoSchema), asyncHandler(pedidosController.crear));
router.post(
    "/:id/pago/intento",
    validate(pedidoParamsSchema, "params"),
    asyncHandler(pagosController.crearIntento)
);
router.get(
    "/:id/pago",
    validate(pedidoParamsSchema, "params"),
    asyncHandler(pagosController.obtenerEstado)
);
router.get(
    "/:id",
    validate(pedidoParamsSchema, "params"),
    asyncHandler(pedidosController.obtener)
);
router.patch(
    "/:id/cancelar",
    validate(pedidoParamsSchema, "params"),
    asyncHandler(pedidosController.cancelar)
);

export default router;
