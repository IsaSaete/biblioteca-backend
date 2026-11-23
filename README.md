# Glosa · backend

[![CI](https://github.com/IsaSaete/biblioteca-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/IsaSaete/biblioteca-backend/actions/workflows/ci.yml)

API REST de **Glosa**, una biblioteca personal digital: cataloga los libros físicos que tienes y guarda tus citas favoritas de cada uno.

🌐 **[glosaapp.com](https://glosaapp.com)** · La web está en [biblioteca-frontend](https://github.com/IsaSaete/biblioteca-frontend).

## Qué hace

- **Cuentas y sesión:** registro con verificación de correo, acceso, renovación de sesión, recuperación y cambio de contraseña y de email, descarga de todos los datos y eliminación de la cuenta.
- **Biblioteca:** alta de libros por ISBN, por búsqueda de texto o a mano; listado paginado con búsqueda, orden y filtros; ficha con los datos de cada ejemplar, etiquetas, favoritos y préstamos.
- **Lista de deseos y citas** vinculadas a cada libro.
- **Catálogo externo:** consulta [Google Books](https://developers.google.com/books) y [Open Library](https://openlibrary.org/developers/api) (si uno no responde o le falta algo, completa con el otro) y normaliza sus categorías a un único género de un catálogo propio.
- Estadísticas para la pantalla de inicio.

### Un modelo inspirado en Discogs

El **`Libro`** (la edición identificada por su ISBN) es **compartido e inmutable**: ninguna persona lo edita. Lo personal vive en el **`Ejemplar`** de cada usuaria (estado, ubicación, notas, etiquetas…), que además puede guardar correcciones de los datos del libro (`overrides`) sin afectar a nadie más.

## Stack

| Área          | Tecnología                                                                    |
| ------------- | ----------------------------------------------------------------------------- |
| Servidor      | Node.js 22, Express 5, TypeScript (estricto, sin `any`)                       |
| Base de datos | MongoDB con Mongoose 9                                                        |
| Validación    | Zod                                                                           |
| Seguridad     | JWT en cookies, protección CSRF, `helmet`, `express-rate-limit`, `bcrypt`     |
| Correo        | [Resend](https://resend.com)                                                  |
| Registro      | `pino` y `pino-http`                                                          |
| Calidad       | Jest, supertest, `mongodb-memory-server`, ESLint, Prettier, Husky, commitlint |

## Requisitos

- Node.js 22 o superior y npm.
- Una base de datos MongoDB: un clúster gratuito de [MongoDB Atlas](https://www.mongodb.com/atlas) o una instancia local.
- Una clave de API de [Google Books](https://developers.google.com/books/docs/v1/using#APIKey) y una de [Resend](https://resend.com).

## Puesta en marcha

```bash
git clone https://github.com/IsaSaete/biblioteca-backend.git
cd biblioteca-backend
npm ci
cp .env.example .env     # y rellena las variables (tabla siguiente)
npm run start:dev
```

La API queda en `http://localhost:4000`. Comprueba que responde con `GET /` (devuelve `{ "message": "pong" }`). Para usarla con la web, arranca también [biblioteca-frontend](https://github.com/IsaSaete/biblioteca-frontend).

### Variables de entorno

| Variable                                                         | Obligatoria | Descripción                                                                                             |
| ---------------------------------------------------------------- | :---------: | ------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                                                    |     sí      | Cadena de conexión. Si la contraseña lleva símbolos (`@`, `:`, `/`…), codifícala.                       |
| `FRONTEND_URL`                                                   |     sí      | Origen de la web, para CORS y para los enlaces de los correos.                                          |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`                    |     sí      | Secretos de los tokens, de al menos 32 caracteres.                                                      |
| `RESEND`                                                         |     sí      | Clave de API de Resend.                                                                                 |
| `GOOGLE_BOOKS_API_KEY`                                           |     sí      | Clave de API de Google Books.                                                                           |
| `NODE_ENV`                                                       |     no      | `development` en local (imprime en consola los enlaces de los correos). Si falta se asume `production`. |
| `PORT`                                                           |     no      | Por defecto `4000`.                                                                                     |
| `EXTRA_ALLOWED_ORIGINS`                                          |     no      | Otros orígenes permitidos por CORS, separados por comas y sin comodines.                                |
| `COOKIE_SAME_SITE`, `API_PUBLIC_PATH_PREFIX`, `TRUST_PROXY_HOPS` |     no      | Para servir la API detrás del proxy de la web (`lax`, `/api` y los saltos reales).                      |
| `EMAIL_FROM`, `EMAIL_REPLY_TO`                                   |     no      | Remitente y dirección de respuesta de los correos.                                                      |

## Scripts

| Comando                       | Qué hace                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run start:dev`           | Servidor de desarrollo con recarga                                                                                                         |
| `npm run build` · `npm start` | Compila a `dist/` y arranca                                                                                                                |
| `npm test` · `test:watch`     | Tests                                                                                                                                      |
| `npm run lint` · `lint:fix`   | ESLint                                                                                                                                     |
| `npm run typecheck`           | Comprueba los tipos sin compilar                                                                                                           |
| `npm run migrate:genres`      | Mantenimiento: normaliza los géneros ya guardados. Es una **prueba** que no escribe nada; solo con `-- --apply` modifica la base de datos. |

## Estructura

```
src/
├── domains/        # auth, books, quotes, wishlist, stats
│   └── books/      # router · controller · service · validator · model · mapper · provider · utils
├── middleware/     # sesión, CORS, CSRF y manejo de errores
├── config/         # variables de entorno validadas con Zod
├── database/       # conexión a MongoDB
└── server/         # aplicación Express
```

Cada dominio sigue las mismas capas: la ruta recibe, el controlador delega, el servicio contiene la lógica y el modelo la persiste.

## API

Cinco grupos de recursos y un endpoint de salud:

| Grupo      | Rutas principales                                                                                                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`     | `POST /auth/register`, `/login`, `/logout`, `/refresh`; recuperación de contraseña; `GET /auth/me` y perfil, avatar, verificación y cambio de email y de contraseña; `GET /auth/me/export` (descarga de datos); `DELETE /auth/me` |
| `books`    | `GET /books`, `GET /books/:id`, `POST /books`, `PATCH /books/:id/ejemplar`, `DELETE /books/:id`; `GET /books/lookup-isbn?isbn=`, `GET /books/search-external?q=`, `GET /books/tags`                                               |
| `wishlist` | `GET` y `POST /wishlist`, `PATCH` y `DELETE /wishlist/:id`, `POST /wishlist/:id/acquire`                                                                                                                                          |
| `quotes`   | `GET` y `POST /quotes`, `GET`, `PATCH` y `DELETE /quotes/:id`, `GET /quotes/books`                                                                                                                                                |
| `stats`    | `GET /stats`                                                                                                                                                                                                                      |
| Salud      | `GET /` → `{ "message": "pong" }` (sin sesión; útil como Health Check)                                                                                                                                                            |

Las rutas protegidas exigen la cookie de sesión y, las que modifican datos, la cabecera `X-CSRF-Token`. Los errores tienen siempre la forma `{ "error": { "code", "message", "field"? } }`.

## Tests

```bash
npm test
```

Los tests de integración llaman a los endpoints con `supertest` contra una MongoDB en memoria (`mongodb-memory-server`, que descarga un binario de MongoDB la primera vez). No necesitas ninguna base de datos ni claves reales para ejecutarlos.

## Despliegue

El backend se publica en **Render**; la base de datos es **MongoDB Atlas**. Se construye con `npm install && npm run build` y se arranca con `npm start`; `GET /` sirve de Health Check. Las variables de la tabla anterior se definen en Render.

> **No definas `NODE_ENV` en Render.** Esa variable también afecta a la construcción y, con `production`, `npm install` omite las dependencias de desarrollo y falla. Sin definirla, el código asume `production` al ejecutarse, que es lo que se quiere.

En producción la web y la API comparten origen: Netlify reenvía `/api/*` al backend, por lo que se usa `COOKIE_SAME_SITE=lax` y `API_PUBLIC_PATH_PREFIX=/api`.

## Cómo contribuir

Se trabaja con **Trunk Based Development**: ramas cortas `feature/`, `bugfix/` o `refactor/` desde `main` actualizado, una PR por rama y commits pequeños, atómicos, en inglés e imperativos (máximo 72 caracteres). Cada endpoint lleva su test de integración.

## Licencia

© 2026 Isabel Sáenz. **Todos los derechos reservados.** El código se publica únicamente para que pueda consultarse como parte de un portfolio: no se concede permiso para usarlo, copiarlo, modificarlo ni distribuirlo, en todo o en parte, sin autorización expresa y por escrito de su autora.

---

Proyecto de portfolio de Isabel Sáenz ([@IsaSaete](https://github.com/IsaSaete)).
