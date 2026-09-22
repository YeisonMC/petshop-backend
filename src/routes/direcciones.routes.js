import express from "express";

import * as direccionesController from "../controllers/direcciones.controller.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";
import validate from "../middlewares/validate.js";
import asyncHandler from "../utils/async-handler.js";
import ROLES from "../utils/roles.js";
import {
    actualizarDireccionSchema,
    crearDireccionSchema,
    direccionParamsSchema
} from "../validators/direcciones.validator.js";

const router = express.Router();

router.use(authenticate, authorize(ROLES.CLIENTE_WEB));

router.get("/", asyncHandler(direccionesController.listar));
router.post("/", validate(crearDireccionSchema), asyncHandler(direccionesController.crear));
router.patch(
    "/:id/principal",
    validate(direccionParamsSchema, "params"),
    asyncHandler(direccionesController.establecerPrincipal)
);
router.patch(
    "/:id",
    validate(direccionParamsSchema, "params"),
    validate(actualizarDireccionSchema),
    asyncHandler(direccionesController.actualizar)
);
router.delete(
    "/:id",
    validate(direccionParamsSchema, "params"),
    asyncHandler(direccionesController.eliminar)
);

export default router;
