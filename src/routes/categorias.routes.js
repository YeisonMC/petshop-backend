const express = require("express");

const categoriasController = require("../controllers/categorias.controller");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.get("/", asyncHandler(categoriasController.obtenerCategorias));

module.exports = router;
