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
3. **Asignar empresas** — lee las compañías con Estado `Pendiente` **de la
   pestaña `Trabajo`** (no de toda `Total compañías`), las distribuye lo
   más balanceadamente posible entre 8 pestañas `Ejecutivo 1`..`Ejecutivo 8`
   (también por fórmula) y, en `Total compañías`, marca su Estado como
   `Asignado` y escribe el nombre del ejecutivo en la columna `Ejecutivo`.

### Sobre el "vinculado" entre pestañas

Las pestañas `Trabajo` y `Ejecutivo N` contienen **fórmulas** que apuntan a
filas específicas de `Total compañías`. Esto significa:

- Cambios hechos en `Total compañías` se reflejan automáticamente en las
  pestañas derivadas (propagación instantánea).
- Si se cambia el **Estado** en una pestaña derivada, un script de Apps
  Script (`onEdit`) actualiza `Total compañías` y restaura la fórmula
  en la celda editada, logrando **sincronización bidireccional** de Estado.
- Las columnas **Id**, **Nombre** y **Ejecutivo** están protegidas
  (solo lectura con advertencia) en las pestañas derivadas; únicamente
  la columna **Estado** es editable.
- Al correr **Asignar empresas**, el botón escribe los valores `Asignado`
  y el nombre del ejecutivo directamente en `Total compañías!C:D`; las
  fórmulas de las columnas C y D de las pestañas `Ejecutivo N` se actualizan
  automáticamente.

## Configuración paso a paso

### 1. Crear (o seleccionar) un proyecto en Google Cloud

1. Abre <https://console.cloud.google.com/> e inicia sesión con el Gmail
   que vas a usar.
2. En el selector de proyectos (barra superior) elige **New Project**.
   Ponle un nombre como `acquirerManagement` (o selecciona uno existente).
   Espera a que se cree y asegúrate de tenerlo seleccionado.

### 2. Habilitar las APIs necesarias

En el menú lateral: **APIs & Services → Library**. Busca y presiona
**Enable** en cada una:

- **Google Sheets API**
- **Google Drive API**
- **Apps Script API** — necesaria para instalar el script de sincronización
  bidireccional de Estado.

Puedes verificar que las tres quedaron activas en
**APIs & Services → Enabled APIs & services**.

### 3. Configurar la pantalla de consentimiento OAuth (solo la primera vez)

**APIs & Services → OAuth consent screen**

- **User type**: `External` (a menos que tengas Google Workspace, en cuyo
  caso `Internal` también sirve).
- Campos obligatorios:
  - *App name*: `Acquirer Management`
  - *User support email*: tu Gmail
  - *Developer contact*: tu Gmail
- Presiona **Save and Continue**.
- **Scopes**: déjalo vacío y presiona **Save and Continue**. Los scopes
  los solicita la app en tiempo de ejecución desde `js/auth.js`, no hace
  falta declararlos aquí.
- **Test users**: presiona **+ Add Users** y agrega cada Gmail que vaya
  a usar la app (al menos el tuyo). Mientras la app esté en estado
  *Testing*, solo los usuarios listados pueden autenticarse.
- Guarda.

### 4. Crear el OAuth 2.0 Client ID

**APIs & Services → Credentials → + Create Credentials → OAuth client ID**

- **Application type**: `Web application`
- **Name**: cualquier cosa, p. ej. `acquirerManagement local`
- **Authorized JavaScript origins** → **+ Add URI**:
  - `http://localhost:8080`
  - (más adelante) cualquier origen de producción al que vayas a desplegar
- **Authorized redirect URIs**: déjalo vacío. Este flujo usa el
  *token client* de GIS, que no necesita redirect URIs.
- Presiona **Create**. El diálogo muestra el *Client ID* — cópialo. Se ve
  así: `123456789012-abc…xyz.apps.googleusercontent.com`.

### 5. Pegar el Client ID en el código

Abre `js/auth.js` y reemplaza la línea:

```js
export const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
```

con tu Client ID real (mantén las comillas).

### 6. Servir la app en el puerto 8080

Los módulos ES y Google Identity Services **no** funcionan desde `file://`,
y el puerto debe coincidir exactamente con el origen registrado en el
paso 4. Abre una terminal en la carpeta del proyecto:

```bash
cd /c/Programming/lsolano/acquirerManagement
```

Luego elige una opción:

- **Python** (si está instalado): `python -m http.server 8080`
- **Node**: `npx http-server -p 8080 -c-1`
- **VS Code**: instala la extensión *Live Server*, haz clic derecho en
  `index.html` → *Open with Live Server*, y configura su puerto a 8080
  en los *settings* de la extensión.

Abre <http://localhost:8080> en el navegador. Deberías ver la interfaz
en español con un encabezado azul.

### 7. Preparar una Google Sheet de destino

La app **no** crea archivos de hoja de cálculo — escribe pestañas dentro
de una hoja que ya es tuya. Ve a <https://sheets.google.com> y crea una
hoja vacía, por ejemplo `Acquirer Test`. No hace falta dejarla abierta.

### 8. Primera corrida

1. En la SPA presiona **Iniciar sesión con Google**.
2. Elige el Gmail que agregaste como *test user*. Concede permisos de
   Sheets, Drive y Apps Script cuando te los pida.
3. Presiona **Seleccionar de Drive**. Tu hoja aparece en el diálogo —
   haz clic en ella.
4. Presiona los tres botones en orden:
   - **Generar compañías** → crea `Total compañías` con 1,000 filas e
     instala el script de sincronización de Estado.
   - **Separar Compañias** → crea `Trabajo` con 280 filas Pendiente.
   - **Asignar Empresas** → toma las compañías Pendiente de `Trabajo`,
     crea `Ejecutivo 1..8` y marca las filas como `Asignado`.

## Errores comunes

| Error | Causa | Solución |
|---|---|---|
| `redirect_uri_mismatch` | El URL del navegador no coincide con un *JavaScript origin* registrado. | Asegúrate de estar en `http://localhost:8080` exactamente — no `127.0.0.1`, no otro puerto. |
| `access_denied` / `403: access denied` | La app está en modo *Testing* y tu Gmail no está en la lista de *test users*. | Agrégalo en **OAuth consent screen → Test users** y vuelve a iniciar sesión. |
| `Sheets API 403` | Las APIs no están habilitadas, o el token no tiene el scope correcto. | Revisa el paso 2. Presiona **Cerrar sesión** y vuelve a entrar para que los scopes se soliciten otra vez. |
| Página en blanco, `Failed to resolve module specifier` en la consola | Abriste el archivo con `file://`. | Sírvelo con `http://localhost:8080`. |
| En el log aparece `Configura tu Google OAuth Client ID en js/auth.js…` | No pegaste el Client ID en `js/auth.js`. | Paso 5. |
| `Solo hay N compañías con Estado "Pendiente" (se necesitan 280)` | Ya corriste **Asignar Empresas** (o cambiaste estados a mano), así que quedan menos de 280 filas `Pendiente`. | Vuelve a correr **Generar compañías** para reiniciar el maestro. |
| `Apps Script API 403` | La Apps Script API no está habilitada en tu proyecto de GCP. | Paso 2: habilita **Apps Script API** en *APIs & Services → Library*. |
| El script de sincronización no se dispara al editar | El script se instala al correr **Generar compañías**. Si cambiaste de hoja, vuelve a correr ese botón. | Presiona **Generar compañías** de nuevo. El script se instala una vez por hoja. |

## Estructura

```
acquirerManagement/
├── index.html
├── css/
│   └── app.css
├── js/
│   ├── app.js         # lógica de UI, handlers de los 3 botones
│   ├── appsScript.js  # instala script onEdit para sincronización de Estado
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
- `script.projects` — para crear e instalar el script de sincronización.
- `userinfo.email`, `userinfo.profile` — para mostrar el correo del
  usuario conectado.
