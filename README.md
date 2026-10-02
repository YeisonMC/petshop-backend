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
vencimiento nullable. Los pedidos existentes conservan `NULL`. El flujo actual
crea reservas temporales y ejecuta una tarea de expiración cada minuto.

## Comandos

```bash
npm run dev
npm start
npm test
npm run smoke:admin
npm run smoke:admin:sql
```

`smoke:admin` realiza consultas de solo lectura contra la base configurada y
comprueba las rutas públicas. También comprueba las rutas administrativas si
ya existe una cuenta activa `ADMIN_CATALOGO`; de lo contrario informa que las
omitió. No modifica productos ni inventario. Para verificar el login y las
rutas protegidas sin una cuenta administrativa permanente, ejecuta
`npm run smoke:admin -- --temporary-admin`. Esta opción crea una cuenta de
prueba aleatoria y la elimina al terminar; no la uses en una base donde no
permitas escrituras temporales.

`smoke:admin:sql` verifica las escrituras de todas las tablas del catálogo y
un movimiento de inventario dentro de una sola transacción. Siempre hace
`ROLLBACK` y comprueba que el producto de prueba no permanezca en la base.

## Catálogo público y panel administrativo

- `/`: catálogo público con búsqueda, filtros, ordenamiento, paginación y detalle.
  Las animaciones AOS se sirven desde la dependencia local y respetan
  `prefers-reduced-motion`.
- `/admin/`: acceso separado y panel de catálogo e inventario. La página es
  pública, pero todas sus APIs requieren un token válido de un usuario activo
  con rol activo `ADMIN_CATALOGO`. La autorización se vuelve a comprobar contra
  la base de datos en cada solicitud.

Para crear la primera cuenta administrativa, verifica que el rol
`ADMIN_CATALOGO` exista y esté activo. Define temporalmente las variables
`ADMIN_NOMBRES`, `ADMIN_APELLIDOS`, `ADMIN_CORREO` y `ADMIN_PASSWORD` en la
sesión del terminal y ejecuta `npm run admin:create`. El script valida los
datos, genera un hash bcrypt real y rechaza correos ya registrados. No guardes
la contraseña administrativa en Git, `.env.example` ni en el historial del
terminal. Por ejemplo, en Bash puedes solicitarla sin eco:

```bash
read -r -p "Nombres: " ADMIN_NOMBRES
read -r -p "Apellidos: " ADMIN_APELLIDOS
read -r -p "Correo: " ADMIN_CORREO
read -r -s -p "Contraseña: " ADMIN_PASSWORD; echo
export ADMIN_NOMBRES ADMIN_APELLIDOS ADMIN_CORREO ADMIN_PASSWORD
npm run admin:create
unset ADMIN_NOMBRES ADMIN_APELLIDOS ADMIN_CORREO ADMIN_PASSWORD
```

El panel usa `sessionStorage` para el token: cerrar la pestaña termina la
sesión local. En producción se debe servir todo por HTTPS. El inicio de sesión
administrativo tiene un límite adicional de 10 intentos cada 15 minutos por IP.

## Nginx y límite de solicitudes

Node escucha únicamente en `127.0.0.1:3000`; accede al sitio y a la API por el
dominio HTTPS de Nginx, no por el puerto 3000 público. En el bloque `location /`
del servidor HTTPS, configura la conexión con estas cabeceras:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
}
```

Usa `$remote_addr` en lugar de `$proxy_add_x_forwarded_for` para reemplazar
cualquier cabecera enviada por el visitante. Express solo confía en un proxy
local. El límite general es de 300 solicitudes por IP cada 15 minutos y solo
se aplica a `/api`; las páginas, CSS, JavaScript e imágenes no lo consumen.
Mantén la regla pública del puerto 3000 cerrada en el NSG de Azure; expón solo
80/443 y el acceso SSH restringido que necesites.

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
  `categoria`, `id_marca`, `destacado` y `sort` (`destacados`, `recientes`,
  `precio_asc`, `precio_desc`, `nombre`).
- `GET /api/productos/:slug`: detalle de un producto con categorías, variantes,
  stock, imágenes y resumen de reseñas.
- `GET /api/categorias`: categorías activas y cantidad de productos activos.

### APIs administrativas

Todas las rutas siguientes requieren `Authorization: Bearer <token>` obtenido
de `POST /api/admin/auth/login` con una cuenta `ADMIN_CATALOGO`.

| Método | Ruta | Uso |
| --- | --- | --- |
| POST | `/api/admin/auth/login` | Iniciar sesión administrativa |
| GET | `/api/admin/auth/perfil` | Verificar la sesión |
| GET | `/api/admin/resumen` | Indicadores de catálogo y stock bajo |
| GET, POST | `/api/admin/marcas` | Listar y crear marcas |
| PATCH | `/api/admin/marcas/:id` | Editar o desactivar marca |
| GET, POST | `/api/admin/categorias` | Listar y crear categorías |
| PATCH | `/api/admin/categorias/:id` | Editar o desactivar categoría |
| GET, POST | `/api/admin/productos` | Listar y crear productos |
| GET, PATCH | `/api/admin/productos/:id` | Detallar y editar producto |
| POST | `/api/admin/productos/:id/variantes` | Crear variante y su inventario en cero |
| PATCH | `/api/admin/variantes/:idVariante` | Editar precio, oferta o estado de variante |
| POST | `/api/admin/productos/:id/imagenes` | Añadir imagen HTTPS |
| PATCH, DELETE | `/api/admin/imagenes/:idImagen` | Editar o quitar imagen |
| GET | `/api/admin/inventario` | Listar existencias y reservas |
| PATCH | `/api/admin/inventario/:idVariante` | Configurar mínimo y ubicación |
| POST | `/api/admin/inventario/:idVariante/ajustes` | Ajustar stock físico con motivo |
| GET | `/api/admin/inventario/:idVariante/movimientos` | Consultar últimos 50 movimientos |

`POST /api/admin/inventario/:idVariante/ajustes` acepta una `cantidad` positiva
o negativa y un `motivo` de al menos 5 caracteres. El ajuste se hace dentro de
una transacción, deja un movimiento con referencia al administrador y nunca
permite que el stock físico quede por debajo del reservado. Desactivar un
producto, marca, categoría o variante es preferible a eliminarlo porque puede
haber pedidos históricos relacionados. Las imágenes sí pueden quitarse.

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
