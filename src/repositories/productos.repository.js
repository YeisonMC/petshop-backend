const pool = require("../config/database");

const obtenerTodos = async () => {
    const [rows] = await pool.query(`
        SELECT
            id_producto,
            id_marca,
            nombre,
            slug,
            descripcion_corta,
            destacado,
            estado,
            created_at
        FROM productos
        ORDER BY id_producto ASC
    `);

    return rows;
};

module.exports = {
    obtenerTodos
};