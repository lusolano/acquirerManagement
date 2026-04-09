# Acquirer Management

SPA (vanilla JS, no build step) para administrar compañías en Google Sheets.
Inicia sesión con Gmail, elige una hoja de Drive y genera/separa/asigna
compañías con tres botones.

## Funcionalidades

1. **Generar compañías** — crea la pestaña `Total compañías` con 1,000
   compañías aleatorias. Cada fila tiene cuatro columnas:
   - **Id**: número aleatorio de 6 dígitos.
   - **Nombre**: nombre de empresa en español.
   - **Estado**: lista desplegable con `Pendiente` / `Asignado` / `Listo`.
     Todas inician en `Pendiente`.
   - **Ejecutivo**: vacío por defecto.
2. **Separar compañías** — crea la pestaña `Trabajo` con 280 compañías
   seleccionadas al azar **de entre las que tengan Estado `Pendiente`**,
   usando fórmulas `='Total compañías'!A{n}` para que ambas pestañas
   permanezcan vinculadas.
3. **Asignar empresas** — lee las compañías con Estado `Pendiente`, las
   distribuye lo más balanceadamente posible entre 8 pestañas
   `Ejecutivo 1`..`Ejecutivo 8` (también por fórmula) y, en `Total compañías`,
   marca su Estado como `Asignado` y escribe el nombre del ejecutivo en la
   columna `Ejecutivo`. Como resultado, correr el botón dos veces seguidas
   no re-asigna las mismas compañías: después del primer clic ya no quedan
   filas `Pendiente`.

### Sobre el "vinculado" entre pestañas

Las pestañas `Trabajo` y `Ejecutivo N` contienen **fórmulas** que apuntan a
filas específicas de `Total compañías`. Esto significa:

- Cambios hechos en `Total compañías` se reflejan automáticamente en las
  pestañas derivadas (propagación instantánea).
- Si se selecciona un nuevo valor en la lista desplegable de una pestaña
  derivada, la fórmula de esa celda se reemplaza por un valor literal
  (comportamiento estándar de Google Sheets). La recomendación es editar
  el estado desde `Total compañías`.
- Al correr **Asignar empresas**, el botón escribe los valores `Asignado`
  y el nombre del ejecutivo directamente en `Total compañías!C:D`; las
  fórmulas de las columnas C y D de las pestañas `Ejecutivo N` se actualizan
  automáticamente.

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
