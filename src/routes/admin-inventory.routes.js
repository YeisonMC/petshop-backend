import express from "express";

import * as controller from "../controllers/admin-inventory.controller.js";
import authenticate from "../middlewares/authenticate.js";
import requireCatalogAdmin from "../middlewares/require-catalog-admin.js";
import validate from "../middlewares/validate.js";
import asyncHandler from "../utils/async-handler.js";
import {
    inventoryAdjustmentSchema, inventoryListQuerySchema,
    inventoryParamsSchema, inventorySettingsSchema
} from "../validators/admin-inventory.validator.js";

const router = express.Router();
router.use(authenticate, asyncHandler(requireCatalogAdmin));
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

router.get("/", validate(inventoryListQuerySchema, "query"), asyncHandler(controller.listar));
router.patch("/:idVariante", validate(inventoryParamsSchema, "params"),
    validate(inventorySettingsSchema), asyncHandler(controller.configurar));
router.post("/:idVariante/ajustes", validate(inventoryParamsSchema, "params"),
    validate(inventoryAdjustmentSchema), asyncHandler(controller.ajustar));
router.get("/:idVariante/movimientos", validate(inventoryParamsSchema, "params"),
    asyncHandler(controller.listarMovimientos));

export default router;
