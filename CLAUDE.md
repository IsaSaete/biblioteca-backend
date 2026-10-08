# CLAUDE.md — biblioteca-backend

Este archivo es un índice operativo, no una copia de la documentación. Antes de trabajar en algo, consulta el documento fuente correspondiente — no asumas ni inventes lo que ya está decidido ahí.

## Qué estamos construyendo

API para una biblioteca personal digital: catalogar libros por ISBN (Google Books/Open Library) y guardar citas de texto (el OCR ocurre en el cliente, aquí solo se recibe texto ya revisado). Producto de portfolio construido con estándares profesionales reales, por una única desarrolladora. Detalle completo: `../biblioteca-docs/product-brief-biblioteca-personal.md`.

## Estructura del proyecto

Arquitectura por dominio y capas (`domains/auth`, `domains/books`, `domains/quotes`, cada uno con `model/validator/mapper/service/controller/router/fixtures`), más `middleware/`, `shared/errors/`, `database/`, `config/`, `server/`. Estructura completa y el porqué de cada capa: `../biblioteca-docs/arquitectura-tecnica.md`.

## Papel de `biblioteca-docs`

`../biblioteca-docs` es el repositorio de documentación fuente compartida entre frontend y backend, y la fuente de verdad compartida del producto, la arquitectura, el diseño, la API y el backlog.

- Esos documentos no se duplican dentro de este repositorio.
- Antes de tomar una decisión que ya esté documentada, se consulta el documento correspondiente.
- Si una implementación requiere modificar una decisión documentada, no se hace unilateralmente: se solicita confirmación humana.
- La documentación solo se modifica cuando realmente exista una decisión, requisito, componente, ruta, contrato o estructura que deba quedar documentada; no se modifica por cambios puramente internos.

## Stack

Node.js + Express + TypeScript · MongoDB (Mongoose). Librerías complementarias y su papel: `arquitectura-tecnica.md`.

## Documentación fuente

Todos están en `../biblioteca-docs/`. Lee según lo que vayas a hacer — no leas un fichero entero si solo necesitas una parte.

| Cuando vas a… | Lee |
|---|---|
| Crear o cambiar un modelo, DTO, validador o tipo | `modelo-de-datos.md` |
| Crear o cambiar un endpoint (respuesta, errores, sesión) | `api-contract.md` (contrato compartido con el frontend) |
| Decidir estructura de carpetas, capas, middleware, índices de Mongo, rate limiting o variables de entorno | `arquitectura-tecnica.md` |
| Escribir un test, un commit o una rama, nombrar un archivo o dar formato a un error | `normas-desarrollo.md` |
| Saber qué construir en el sprint y sus criterios de aceptación | Solo la historia HU-xx en `backlog-historias-usuario.md` |
| Entender por qué existe algo a nivel de producto | `product-brief-biblioteca-personal.md` |
| Nunca por defecto | `historico/auditoria-pre-desarrollo.md` — decisiones ya resueltas; no reabrir lo cerrado ahí |

## Reglas que debe respetar (no negociables)

- **`api-contract.md` es un contrato compartido entre frontend y backend.** Si una implementación necesita un campo, parámetro, respuesta, endpoint o comportamiento que no está contemplado en el contrato: no lo inventes, no modifiques `api-contract.md` unilateralmente y detente para solicitar confirmación humana. La implementación se adapta al contrato existente salvo que exista una decisión explícita de cambiarlo.
- **Cero `any`** en todo el código — usar `unknown` + validación si el tipo no se conoce de antemano. `tsconfig strict` y ESLint lo bloquean, pero no intentes rodear la regla.
- **Toda lógica propia debe estar cubierta por tests:** cada endpoint tiene su test de integración (verifica el contrato) y cada función de `service/` con lógica propia, su test unitario. No se escriben tests mecánicos para código sin lógica propia (tipos, constantes, wrappers triviales). Descripciones en Gherkin y cuerpo en AAA.
- `service/` nunca importa nada de Express (`req`/`res`) — la lógica de negocio no sabe que existe HTTP.
- Toda corrección sobre `Libro` se guarda como override en `Ejemplar` — **`Libro` nunca se edita directamente**, es la regla de integridad más importante del proyecto (regla definida en `modelo-de-datos.md`).
- El hash de contraseña (`passwordHash`) y cualquier campo sensible **nunca sale de la capa `mapper`** hacia una respuesta de la API.
- Nombres de clases, variables, funciones y rutas **siempre en inglés**; documentación y textos visibles en la interfaz, en español. Convenciones de nombres de archivos y carpetas: `normas-desarrollo.md` y `arquitectura-tecnica.md` — no se inventa una distinta.

## Arquitectura (resumen operativo)

- Orden de capas: `router` → `controller` (solo HTTP) → `service` (lógica de negocio) → `model` (Mongoose).
- Errores: siempre una subclase de `AppError`; nunca un `throw` de un string o un error genérico — `handleError` da forma a la respuesta JSON estándar.
- Sesión: `accessToken` + `refreshToken` + `csrfToken` en cookies `httpOnly`/`Secure`/`SameSite=None` (excepto `csrfToken`, legible por el frontend). `/auth/refresh` rota el refresh token en cada uso. Cualquier cambio en esta estrategia (cookies, tokens, CORS, CSRF) requiere confirmación humana; el detalle está en la sección Sesión de `api-contract.md` y en `arquitectura-tecnica.md`.

## Comandos

```
npm run dev          # servidor de desarrollo (watch)
npm run build         # compilación TypeScript
npm run start          # arranca desde dist/ (producción)
npm run lint
npm run lint:fix
npm run typecheck     # tsc --noEmit
npm run test           # Jest (una vez)
npm run test:watch
```

## Testing

Jest: tests unitarios de `service/` (sin HTTP) y tests de integración de `router/` (endpoint completo), con fixtures reutilizables en `fixtures/` de cada dominio. Las reglas de fondo están arriba; la filosofía completa (Gherkin, AAA) está en `normas-desarrollo.md` y no se repite aquí.

## Git

Trunk Based Development. Ramas: `feature/`, `refactor/`, `bugfix/` + kebab-case, siempre desde `main` actualizado. **Nunca commitear directo a `main`** (única excepción: el primer commit de cada repositorio). Commits atómicos, imperativos, en inglés, con mayúscula inicial. Detalle completo: `normas-desarrollo.md`.

## Definition of Done

Un endpoint/historia se considera terminado cuando, y solo cuando:
- [ ] Los tests pasan (`npm run test`): cada endpoint con su test de integración y la lógica propia de `service/` con test unitario.
- [ ] `npm run lint` y `npm run typecheck` sin errores.
- [ ] Sin ningún `any` nuevo.
- [ ] La respuesta (éxito y error) coincide exactamente con `api-contract.md`. Si la implementación necesita algo que el contrato no contempla, se detiene y se solicita confirmación humana — no se improvisa la forma ni se modifica el contrato unilateralmente.
- [ ] Ninguna variable de entorno nueva sin añadirla a `config/` (validación al arrancar) y a `.env.example`.
- [ ] Documentación: **no todo cambio de código requiere modificar documentación.** Solo se actualiza `biblioteca-docs` cuando el cambio introduce o modifica realmente una decisión, requisito, componente público, ruta, endpoint, campo, contrato, comportamiento o estructura que deba quedar documentada — y en ese caso, en el mismo cambio, no después. Los cambios puramente internos que no alteran ninguna decisión documentada no tocan la documentación. Modificar una decisión ya documentada (o `api-contract.md`) requiere confirmación humana previa.

## Qué puede decidir por su cuenta

- Nombres internos de variables/funciones dentro de las convenciones ya fijadas.
- Estructura interna de un `service` (funciones privadas auxiliares) mientras la interfaz pública no cambie.
- Elegir entre dos formas igual de válidas de escribir un test, sin cambiar qué se testea.
- Orden de implementación dentro de una misma historia de usuario.
- Mensajes de log concretos, dentro del criterio ya fijado en `arquitectura-tecnica.md`.

## Qué NO puede decidir por su cuenta (requiere confirmación humana explícita)

- Cambiar el modelo de datos o el contrato de API (`api-contract.md`) — son fuente de verdad compartida con el frontend.
- Añadir una dependencia nueva no mencionada en `arquitectura-tecnica.md`.
- Modificar la configuración o la estrategia de sesión, cookies, CORS o CSRF.
- Cambiar la regla de inmutabilidad de `Libro`.
- Modificar o contradecir cualquier decisión ya escrita en `biblioteca-docs` — si algo parece no encajar, se pregunta antes de improvisar.
- Saltarse el Definition of Done "por rapidez".

## Criterio de este archivo

Si una información responde a «¿qué debe hacer Claude siempre?», va en este `CLAUDE.md`. Si responde a «¿cómo se hace X concretamente?», va en el `.md` especializado de `biblioteca-docs`.
