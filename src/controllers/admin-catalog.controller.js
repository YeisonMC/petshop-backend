import * as service from "../services/admin-catalog.service.js";

const ok = (res, data, message = "Operación completada") =>
    res.status(200).json({ success: true, message, data });
const created = (res, data) => res.status(201).json({ success: true, data });

export const resumen = async (req, res) => ok(res, await service.resumen());

export const listarMarcas = async (req, res) => ok(res, await service.listarMarcas());
export const crearMarca = async (req, res) => created(res, await service.crearMarca(req.validated.body));
export const actualizarMarca = async (req, res) => ok(
    res, await service.actualizarMarca(req.validated.params.id, req.validated.body)
);

export const listarCategorias = async (req, res) => ok(res, await service.listarCategorias());
export const crearCategoria = async (req, res) => created(res, await service.crearCategoria(req.validated.body));
export const actualizarCategoria = async (req, res) => ok(
    res, await service.actualizarCategoria(req.validated.params.id, req.validated.body)
);

export const listarProductos = async (req, res) => {
    const result = await service.listarProductos(req.validated.query);
    res.status(200).json({ success: true, ...result });
};
export const obtenerProducto = async (req, res) => ok(
    res, await service.obtenerProducto(req.validated.params.id)
);
export const crearProducto = async (req, res) => created(res, await service.crearProducto(req.validated.body));
export const actualizarProducto = async (req, res) => ok(
    res, await service.actualizarProducto(req.validated.params.id, req.validated.body)
);
export const crearVariante = async (req, res) => created(
    res, await service.crearVariante(req.validated.params.id, req.validated.body)
);
export const actualizarVariante = async (req, res) => ok(
    res, await service.actualizarVariante(req.validated.params.idVariante, req.validated.body)
);
export const crearImagen = async (req, res) => created(
    res, await service.crearImagen(req.validated.params.id, req.validated.body)
);
export const actualizarImagen = async (req, res) => ok(
    res, await service.actualizarImagen(req.validated.params.idImagen, req.validated.body)
);
export const eliminarImagen = async (req, res) => {
    await service.eliminarImagen(req.validated.params.idImagen);
    res.status(204).end();
};
