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
