# PetShop Backend

API de la capa de aplicación del e-commerce PetShop. Está construida con Node.js,
Express y MySQL, y mantiene el flujo:

```text
Route -> Controller -> Service -> Repository -> MySQL
```

## Requisitos

- Node.js 18 o superior.
- MySQL 8.0 o superior.
- Base de datos `petshop_ecommerce` disponible.

## Configuración

1. Copiar `.env.example` como `.env`.
2. Completar las credenciales de MySQL y definir un `JWT_SECRET` aleatorio de
   al menos 32 caracteres, sin versionar el archivo `.env`.
3. Instalar dependencias con `npm ci`.

## Migraciones de base de datos

Después de crear la base con el esquema inicial, aplicar una sola vez, en orden,
los archivos SQL de `db/migrations/` con una cuenta administradora de MySQL.
La cuenta usada por la API no necesita permisos `ALTER`. La migración
`20260924_add_reserva_expira_at_to_pedidos.sql` agrega a `pedidos` una fecha de
vencimiento nullable para la futura reserva de inventario. Los pedidos existentes
conservan `NULL`; todavía no se crean reservas ni se ejecuta una tarea de
expiración.

## Comandos

```bash
npm run dev
npm start
npm test
```

## Endpoints actuales

- `POST /api/auth/registro`: registra un usuario con el rol `CLIENTE_WEB`.
- `POST /api/auth/login`: autentica al usuario y devuelve un token JWT.
- `GET /api/auth/perfil`: devuelve el perfil asociado al token Bearer.
- `GET /api/carrito`: obtiene el carrito activo del cliente autenticado.
- `POST /api/carrito/items`: agrega una variante al carrito.
- `PATCH /api/carrito/items/:idVariante`: reemplaza la cantidad de una variante.
- `DELETE /api/carrito/items/:idVariante`: elimina una variante del carrito.
- `GET /api/direcciones`: lista las direcciones activas del cliente autenticado.
- `POST /api/direcciones`: crea una dirección; la primera será principal.
- `PATCH /api/direcciones/:id`: actualiza los datos de una dirección propia.
- `PATCH /api/direcciones/:id/principal`: establece una dirección propia como principal.
- `DELETE /api/direcciones/:id`: desactiva una dirección propia.
- `POST /api/pedidos`: crea un pedido desde el carrito activo y reserva stock durante 30 minutos.
- `GET /api/pedidos`: lista los pedidos del cliente autenticado.
- `GET /api/pedidos/:id`: consulta un pedido propio con sus detalles.
- `PATCH /api/pedidos/:id/cancelar`: cancela un pedido pendiente y libera su reserva.
- `GET /api/productos`: catálogo paginado. Acepta `page`, `limit`, `search`,
  `categoria`, `id_marca` y `destacado`.
- `GET /api/productos/:slug`: detalle de un producto con categorías, variantes,
  stock, imágenes y resumen de reseñas.
- `GET /api/categorias`: categorías activas y cantidad de productos activos.

Las rutas no incluyen una versión (`v1`) porque el alcance actual de PC2 no la
requiere y todavía no existen clientes externos que necesiten compatibilidad
entre versiones.

Para consultar una ruta protegida, enviar el token recibido durante el registro
o inicio de sesión:

```http
Authorization: Bearer <token>
```

El precio de los productos del carrito se obtiene siempre desde MySQL. Las
operaciones de escritura validan el stock disponible y se ejecutan dentro de
una transacción.

Las rutas de direcciones requieren un token `CLIENTE_WEB`. El cliente solo puede
consultar y modificar sus propias direcciones. `DELETE` realiza una baja lógica
para conservar las direcciones que puedan estar vinculadas a pedidos; si se
desactiva la principal, la dirección activa más antigua pasa a ser principal.
Los campos opcionales (`alias_direccion`, `direccion_linea2`, `codigo_postal` y
`referencia`) se pueden borrar enviando `null` en `PATCH`.

Para crear un pedido, el cliente debe tener una dirección activa y al menos una
variante en su carrito. El cuerpo es, por ejemplo, `{ "id_direccion": 1 }`;
`observaciones` es opcional. El servidor vuelve a consultar precio,
disponibilidad y stock en MySQL: no acepta un total enviado por el cliente.
La operación guarda los detalles con el precio vigente, incrementa
`inventario.stock_reservado`, registra el movimiento `RESERVA` y marca el
carrito como `CONVERTIDO` dentro de una misma transacción. `stock_actual` no
disminuye hasta que exista un flujo de pago aprobado. Por ahora el costo de
envío y los descuentos son cero; el total es provisional para esta demo.

Una tarea del servidor revisa cada minuto los pedidos `PENDIENTE` cuyo
`reserva_expira_at` venció. Los marca `CANCELADO` y registra `LIBERACION`,
igual que la cancelación manual. Los pedidos históricos con vencimiento `NULL`
no se consideran reservas nuevas. En movimientos de tipo `RESERVA` y
`LIBERACION`, `stock_anterior` y `stock_nuevo` registran el stock físico sin
cambios; la cantidad y el tipo de movimiento indican la variación reservada.

### Prueba manual de pedidos

Con los productos de demostración actuales no se necesitan `INSERT` adicionales.
Inicia sesión en Bruno y usa el token Bearer en las rutas protegidas. Consulta
`GET /api/direcciones`; si no tienes una dirección, créala con
`POST /api/direcciones`. Para encontrar una variante vendible también puedes
ejecutar esta consulta de solo lectura en DBeaver:

```sql
SELECT vp.id_variante, p.nombre, vp.sku,
       COALESCE(vp.precio_oferta, vp.precio) AS precio_actual,
       i.stock_actual - i.stock_reservado AS stock_disponible
FROM variantes_producto vp
JOIN productos p ON p.id_producto = vp.id_producto
JOIN inventario i ON i.id_variante = vp.id_variante
WHERE vp.activo = TRUE AND p.estado = 'ACTIVO'
  AND i.stock_actual > i.stock_reservado
ORDER BY vp.id_variante;
```

Agrega una variante con `POST /api/carrito/items` usando
`{ "id_variante": 2, "cantidad": 1 }`. Después llama a `POST /api/pedidos`
con `{ "id_direccion": ID_DE_TU_DIRECCION }`. Consulta el resultado con
`GET /api/pedidos` o `GET /api/pedidos/:id`; cancela la reserva con
`PATCH /api/pedidos/:id/cancelar`. No hagas un `INSERT` directo en `pedidos`:
la API también debe actualizar el inventario y el carrito en la misma
transacción.
