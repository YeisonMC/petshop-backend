import express from "express";

import * as categoriasController from "../controllers/categorias.controller.js";
import asyncHandler from "../utils/async-handler.js";

const router = express.Router();

router.get("/", asyncHandler(categoriasController.obtenerCategorias));

export default router;
