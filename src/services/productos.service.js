const productosRepository = require("../repositories/productos.repository");

const obtenerProductos = async () => {
    const productos = await productosRepository.obtenerTodos();

    return productos;
};

module.exports = {
    obtenerProductos
};