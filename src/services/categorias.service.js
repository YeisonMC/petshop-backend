const categoriasRepository = require("../repositories/categorias.repository");

const obtenerCategorias = async () => {
    const categorias = await categoriasRepository.obtenerTodas();

    return categorias.map((categoria) => ({
        ...categoria,
        cantidad_productos: Number(categoria.cantidad_productos)
    }));
};

module.exports = {
    obtenerCategorias
};
