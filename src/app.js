const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const productosRoutes = require("./routes/productos.routes");

const app = express();

/* ================================
   MIDDLEWARES GENERALES
================================ */

app.use(helmet());

app.use(express.json());

app.use(morgan("dev"));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});

app.use(limiter);


/* ================================
   RUTA DE PRUEBA
================================ */

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "API PetShop funcionando correctamente"
    });
});


/* ================================
   RUTAS DEL SISTEMA
================================ */

app.use("/api/productos", productosRoutes);


module.exports = app;