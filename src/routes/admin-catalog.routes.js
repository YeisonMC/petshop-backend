import express from "express";

import * as controller from "../controllers/admin-catalog.controller.js";
import authenticate from "../middlewares/authenticate.js";
import requireCatalogAdmin from "../middlewares/require-catalog-admin.js";
import validate from "../middlewares/validate.js";
import asyncHandler from "../utils/async-handler.js";
import {
    adminListQuerySchema, actualizarCategoriaSchema, actualizarImagenSchema,
    actualizarMarcaSchema, actualizarProductoAdminSchema, actualizarVarianteSchema,
    categoriaSchema, idParamsSchema, imageParamsSchema, imagenSchema,
    marcaSchema, productoAdminSchema, varianteSchema, variantParamsSchema
} from "../validators/admin-catalog.validator.js";

const router = express.Router();
router.use(authenticate, asyncHandler(requireCatalogAdmin));
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

router.get("/resumen", asyncHandler(controller.resumen));
router.get("/marcas", asyncHandler(controller.listarMarcas));
router.post("/marcas", validate(marcaSchema), asyncHandler(controller.crearMarca));
router.patch("/marcas/:id", validate(idParamsSchema, "params"),
    validate(actualizarMarcaSchema), asyncHandler(controller.actualizarMarca));

router.get("/categorias", asyncHandler(controller.listarCategorias));
router.post("/categorias", validate(categoriaSchema), asyncHandler(controller.crearCategoria));
router.patch("/categorias/:id", validate(idParamsSchema, "params"),
    validate(actualizarCategoriaSchema), asyncHandler(controller.actualizarCategoria));

router.get("/productos", validate(adminListQuerySchema, "query"),
    asyncHandler(controller.listarProductos));
router.post("/productos", validate(productoAdminSchema), asyncHandler(controller.crearProducto));
router.get("/productos/:id", validate(idParamsSchema, "params"),
    asyncHandler(controller.obtenerProducto));
router.patch("/productos/:id", validate(idParamsSchema, "params"),
    validate(actualizarProductoAdminSchema), asyncHandler(controller.actualizarProducto));
router.post("/productos/:id/variantes", validate(idParamsSchema, "params"),
    validate(varianteSchema), asyncHandler(controller.crearVariante));
router.patch("/variantes/:idVariante", validate(variantParamsSchema, "params"),
    validate(actualizarVarianteSchema), asyncHandler(controller.actualizarVariante));

router.post("/productos/:id/imagenes", validate(idParamsSchema, "params"),
    validate(imagenSchema), asyncHandler(controller.crearImagen));
router.patch("/imagenes/:idImagen", validate(imageParamsSchema, "params"),
    validate(actualizarImagenSchema), asyncHandler(controller.actualizarImagen));
router.delete("/imagenes/:idImagen", validate(imageParamsSchema, "params"),
    asyncHandler(controller.eliminarImagen));

export default router;
