const express = require("express");

const productosController = require("../controllers/productos.controller");
const validate = require("../middlewares/validate");
const asyncHandler = require("../utils/async-handler");
const {
    productosQuerySchema,
    productoSlugParamsSchema
} = require("../validators/productos.validator");

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

module.exports = router;
