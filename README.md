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
