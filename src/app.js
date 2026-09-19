const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const productosRoutes = require("./routes/productos.routes");
const categoriasRoutes = require("./routes/categorias.routes");
const notFound = require("./middlewares/not-found");
const errorHandler = require("./middlewares/error-handler");

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

module.exports = app;
