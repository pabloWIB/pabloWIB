# pablo.wib.digital

El portfolio personal. Sitio estático sin paso de compilación: cada página es un
HTML con su CSS y su JS dentro. Lo despliega el proyecto de Vercel `pablo-wib`
desde `main`.

No confundirlo con `www.wib.digital`, que es el sitio del estudio y sale del
repo privado `WIB` (Next.js).

## Estructura

```
index.html      hero, Selected work, Clients, formulario de contacto
gracias.html    confirmación a la que redirige el formulario
404.html        página de error
api/lead.js     endpoint del formulario, envía por Resend
favicon.ico     el mismo icono que el resto de sitios de WIB
favicon-96x96.png
apple-touch-icon.png
1.png           imagen del README de perfil
```

Los iconos se sirven desde aquí a propósito. Antes venían enlazados desde
`slite.wib.digital`, que dejó de existir el 06/09/2026 y dejó el sitio sin
favicon.

## Sistema de diseño

Los tokens están duplicados en cada página porque no hay CSS compartido. Si se
cambia uno, hay que cambiarlo en las tres.

| Token | Valor | Uso |
|---|---|---|
| `--ink` | `#0B0B0B` | fondo oscuro, texto sobre claro |
| `--paper` | `#F4F4F1` | fondo claro, texto sobre oscuro |
| `--smoke` | `#7C7C79` | texto secundario |
| `--line` | `rgba(11,11,11,.16)` | filetes sobre claro |
| `--line-inv` | `rgba(244,244,241,.22)` | filetes sobre oscuro |

Tipografías: **Bricolage Grotesque** (display, 800), **Instrument Sans** (texto),
**JetBrains Mono** (etiquetas y datos). Se cargan de Google Fonts.

Reglas que sostienen el aspecto: sin degradados, sin cajas de color, sin bordes
de acento. Las separaciones son filetes de 1px, y las rejillas los consiguen con
`gap: 1px` sobre un contenedor cuyo fondo es el color de línea. **Cuidado:** con
ese truco, cualquier celda de rejilla que quede sin rellenar se ve como un bloque
del color de línea. Por eso `.lead` declara sus columnas explícitamente en vez de
usar `auto-fit`.

El tamaño de fuente más pequeño del sitio es `.72rem` (11,5px). No bajar de ahí.

## La sección Clients

`ul.roster` en `index.html`. El criterio para entrar es **cliente real con
dominio propio y vivo**, no maquetas ni demos. Para añadir uno:

```html
<li><a href="https://dominio.com/" rel="noopener" target="_blank">
  <b>Nombre</b>
  <span>Sector &middot; Ciudad</span>
  <em>dominio.com</em>
</a></li>
```

El sector sale de lo que el propio cliente dice en su `<title>` o su meta
description, no de lo que uno recuerde.

## Formulario de leads

El navegador valida y muestra el estado; el envío real lo hace `api/lead.js`
para que la clave de Resend no llegue al cliente.

Recorrido: validación en `submit` → `POST /api/lead` → redirección a
`gracias.html`. Si el endpoint falla, el botón se rehabilita y el mensaje
propone WhatsApp. Los errores de validación marcan el campo con
`data-invalid`, mueven el foco y escriben en `#lead-status`, que es
`aria-live="polite"`.

`api/lead.js` valida otra vez en servidor, limita a 5 envíos por IP cada 15
minutos y descarta los que rellenan el honeypot (`input[name="website"]`,
oculto fuera de pantalla) respondiendo como si hubieran funcionado.

### Variables de entorno

En Vercel, proyecto `pablo-wib`, Settings → Environment Variables. Son las
mismas tres que ya usa el proyecto `wib`:

| Variable | Para qué |
|---|---|
| `RESEND_API_KEY` | la clave de Resend |
| `RESEND_TO_EMAIL` | dónde llegan los leads |
| `RESEND_FROM_EMAIL` | remitente en un dominio verificado en Resend |

**Sin `RESEND_API_KEY` y `RESEND_TO_EMAIL` el formulario responde 500 y el
visitante ve el mensaje de error.** El resto del sitio funciona igual.

## QA responsive

Verificado con Playwright en 320, 360, 390, 480, 768, 1024, 1280, 1440 y 1920 px.
Sin desbordamiento horizontal en ninguna página ni anchura, sin errores de
consola y sin peticiones fallidas.

Dos elementos aparecen como "fuera del viewport" y es correcto: `a.skip` (el
enlace de salto) y `p.lead__hp` (el honeypot), ambos en `left: -9999px`.

Los campos del formulario tienen `min-height: 2.75rem` para que el área táctil
llegue a 44px; con la altura por defecto se quedaban en 28px.

Para repetirlo:

```bash
npx playwright install chromium
# servir el repo y recorrer los anchos midiendo scrollWidth vs clientWidth
```

## Despliegue

Push a `main`. Vercel construye sin comando de build y publica la raíz tal cual;
`api/lead.js` se despliega como función serverless. `404.html` en la raíz lo
sirve Vercel automáticamente para rutas que no existen.
