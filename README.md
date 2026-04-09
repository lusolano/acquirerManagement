# Acquirer Management

SPA (vanilla JS, no build step) para administrar compañías en Google Sheets.
Inicia sesión con Gmail, elige una hoja de Drive y genera/separa/asigna
compañías con tres botones.

## Funcionalidades

1. **Generar compañías** — crea la pestaña `Total compañías` con 1,000
   compañías aleatorias (Id, Nombre en español, Estado con lista desplegable
   `Pendiente`/`Asignado`/`Listo`).
2. **Separar compañías** — crea la pestaña `Trabajo` con 280 compañías
   seleccionadas al azar, usando fórmulas `='Total compañías'!A{n}` para que
   las dos pestañas permanezcan vinculadas.
3. **Asignar empresas** — crea 8 pestañas `Ejecutivo 1`..`Ejecutivo 8`, cada
   una con una porción balanceada (125) de las 1,000 compañías, también
   vinculadas por fórmula a `Total compañías`.

### Sobre el "vinculado" entre pestañas

Las pestañas `Trabajo` y `Ejecutivo N` contienen **fórmulas** que apuntan a
filas específicas de `Total compañías`. Esto significa:

- Cambios hechos en `Total compañías` se reflejan automáticamente en las
  pestañas derivadas (propagación instantánea).
- Si se selecciona un nuevo valor en la lista desplegable de una pestaña
  derivada, la fórmula de esa celda se reemplaza por un valor literal
  (comportamiento estándar de Google Sheets). La recomendación es editar
  el estado desde `Total compañías`.

## Requisitos previos

1. **Proyecto en Google Cloud Console** con las APIs habilitadas:
   - Google Sheets API
   - Google Drive API
2. **Credenciales OAuth 2.0 (Web application)**:
   - Authorized JavaScript origins:
     - `http://localhost:8080` (desarrollo local)
     - el dominio final de despliegue, si aplica
   - Copia el *Client ID* generado.
3. **Pega el Client ID** en `js/auth.js`:

   ```js
   export const GOOGLE_CLIENT_ID = '123456789-abc.apps.googleusercontent.com';
   ```

## Correr localmente

Como son archivos estáticos, cualquier servidor HTTP funciona. Con Python:

```bash
cd acquirerManagement
python -m http.server 8080
```

Abre <http://localhost:8080> en el navegador.

> **Nota**: `file://` no funciona porque el módulo `auth.js` carga el script
> de Google Identity Services y los módulos ES no se pueden importar desde
> `file://`.

## Estructura

```
acquirerManagement/
├── index.html
├── css/
│   └── app.css
├── js/
│   ├── app.js         # lógica de UI, handlers de los 3 botones
│   ├── auth.js        # Google Identity Services (token client)
│   ├── config.js      # persistencia en localStorage
│   ├── drive.js       # listar Google Sheets del usuario
│   ├── sheets.js      # crear pestañas, escribir filas, fórmulas, validación
│   └── companies.js   # generador de nombres de empresas en español
└── README.md
```

## Alcances OAuth solicitados

- `drive.readonly` — para listar las hojas del usuario en el selector.
- `spreadsheets` — para crear pestañas y escribir datos.
- `userinfo.email`, `userinfo.profile` — para mostrar el correo del
  usuario conectado.
