import express from "express";

import * as productosController from "../controllers/productos.controller.js";
import validate from "../middlewares/validate.js";
import asyncHandler from "../utils/async-handler.js";
import {
    productosQuerySchema,
    productoSlugParamsSchema
} from "../validators/productos.validator.js";

const router = express.Router();

router.get(
    "/",
    validate(productosQuerySchema, "query"),
    asyncHandler(productosController.obtenerProductos)
);

router.get(
    "/:slug",
    validate(productoSlugParamsSchema, "params"),
    asyncHandler(productosController.obtenerProductoPorSlug)
);

export default router;
