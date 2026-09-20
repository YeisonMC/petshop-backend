import * as categoriasRepository from "../repositories/categorias.repository.js";

export const obtenerCategorias = async () => {
    const categorias = await categoriasRepository.obtenerTodas();

    return categorias.map((categoria) => ({
        ...categoria,
        cantidad_productos: Number(categoria.cantidad_productos)
    }));
};
