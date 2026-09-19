const productosService = require("../services/productos.service");

const obtenerProductos = async (req, res) => {
    try {
        const productos = await productosService.obtenerProductos();

        return res.status(200).json({
            success: true,
            message: "Productos obtenidos correctamente",
            cantidad: productos.length,
            data: productos
        });

    } catch (error) {
        console.error("Error al obtener productos:", error);

        return res.status(500).json({
            success: false,
            message: "Error interno al obtener los productos"
        });
    }
};

module.exports = {
    obtenerProductos
};