import * as categoriasService from "../services/categorias.service.js";

export const obtenerCategorias = async (req, res) => {
    const categorias = await categoriasService.obtenerCategorias();

    return res.status(200).json({
        success: true,
        message: "Categorías obtenidas correctamente",
        cantidad: categorias.length,
        data: categorias
    });
};
