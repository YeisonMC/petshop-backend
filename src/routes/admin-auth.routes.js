import express from "express";
import rateLimit from "express-rate-limit";

import * as controller from "../controllers/admin-auth.controller.js";
import authenticate from "../middlewares/authenticate.js";
import requireCatalogAdmin from "../middlewares/require-catalog-admin.js";
import validate from "../middlewares/validate.js";
import asyncHandler from "../utils/async-handler.js";
import { loginSchema } from "../validators/auth.validator.js";

const router = express.Router();
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false
});

router.post("/login", loginLimiter, validate(loginSchema), asyncHandler(controller.login));
router.get("/perfil", authenticate, asyncHandler(requireCatalogAdmin), asyncHandler(controller.perfil));

export default router;
