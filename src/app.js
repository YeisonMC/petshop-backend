import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";

import categoriasRoutes from "./routes/categorias.routes.js";
import productosRoutes from "./routes/productos.routes.js";
import errorHandler from "./middlewares/error-handler.js";
import notFound from "./middlewares/not-found.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "100kb" }));

if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
}

app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false
}));

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "API PetShop funcionando correctamente"
    });
});

app.use("/api/productos", productosRoutes);
app.use("/api/categorias", categoriasRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
