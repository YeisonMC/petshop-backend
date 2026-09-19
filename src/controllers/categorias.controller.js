const categoriasService = require("../services/categorias.service");

const obtenerCategorias = async (req, res) => {
    const categorias = await categoriasService.obtenerCategorias();

    return res.status(200).json({
        success: true,
        message: "Categorías obtenidas correctamente",
        cantidad: categorias.length,
        data: categorias
    });
};

module.exports = {
    obtenerCategorias
};
