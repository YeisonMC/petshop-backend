import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "./routes/auth.routes.js";
import adminAuthRoutes from "./routes/admin-auth.routes.js";
import adminCatalogRoutes from "./routes/admin-catalog.routes.js";
import adminInventoryRoutes from "./routes/admin-inventory.routes.js";
import carritoRoutes from "./routes/carrito.routes.js";
import categoriasRoutes from "./routes/categorias.routes.js";
import direccionesRoutes from "./routes/direcciones.routes.js";
import pedidosRoutes from "./routes/pedidos.routes.js";
import productosRoutes from "./routes/productos.routes.js";
import errorHandler from "./middlewares/error-handler.js";
import notFound from "./middlewares/not-found.js";

const app = express();
const publicDirectory = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../public"
);
const aosDirectory = path.join(publicDirectory, "../node_modules/aos/dist");

app.disable("x-powered-by");
// Solo Nginx en esta misma VM puede aportar la IP real del cliente.
app.set("trust proxy", "loopback");
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            styleSrc: ["'self'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"]
        }
    }
}));
app.use(express.json({ limit: "100kb" }));

if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
}

app.use(express.static(publicDirectory));
app.use("/vendor/aos", express.static(aosDirectory, { index: false, maxAge: "1d" }));

app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false
}));

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "API PetShop funcionando correctamente"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/inventario", adminInventoryRoutes);
app.use("/api/admin", adminCatalogRoutes);
app.use("/api/carrito", carritoRoutes);
app.use("/api/direcciones", direccionesRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/categorias", categoriasRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
