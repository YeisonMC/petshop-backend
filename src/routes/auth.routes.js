import express from "express";

import * as authController from "../controllers/auth.controller.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";
import validate from "../middlewares/validate.js";
import asyncHandler from "../utils/async-handler.js";
import ROLES from "../utils/roles.js";
import { loginSchema, registroSchema } from "../validators/auth.validator.js";

const router = express.Router();

router.post(
    "/registro",
    validate(registroSchema),
    asyncHandler(authController.registrar)
);

router.post(
    "/login",
    validate(loginSchema),
    asyncHandler(authController.login)
);

router.get(
    "/perfil",
    authenticate,
    authorize(ROLES.CLIENTE_WEB),
    asyncHandler(authController.perfil)
);

export default router;
