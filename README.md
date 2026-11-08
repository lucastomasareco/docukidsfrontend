# DocuKids - Frontend

DocuKids ayuda a madres, padres y tutores a gestionar los documentos de sus hijos en un solo lugar. Es una aplicación web (con soporte para generar APK mediante EAS) que se conecta a un backend propio, el cual se integra con Google Drive, Google Calendar y Gmail.

Web: https://docukidsfrontend.vercel.app/

## Requisitos e instalación

- Node.js 18 o superior
- npm

1. Clonar: `git clone https://github.com/lucastomasareco/docukidsfrontend.git` y entrar a la carpeta.
2. Instalar dependencias: `npm install`
3. Crear un archivo `.env` en la raíz con:

   EXPO_PUBLIC_API_URL=http://localhost:8000
   EXPO_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima

4. Levantar la web en desarrollo: `npm run web` (queda en http://localhost:8081).
5. Generar la versión de producción: `npm run build` (salida en `dist/`).

Pruebas E2E: con la app levantada, `npx playwright test`.

## Estructura del proyecto

docukidsfrontend/
├── app/            # Rutas (Expo Router): (auth) login/registro, (tabs) Documentos, Calendario, Hijos, Ajustes
├── assets/         # Íconos e imágenes
├── components/     # Componentes reutilizables
├── context/        # Estado global (sesión, hijos, familia, tema, avisos)
├── lib/            # Lógica y llamadas al backend
├── e2e/            # Pruebas end-to-end (Playwright)
├── docs/           # Entregas, presentación, manual y documentación técnica
├── app.json, vercel.json, eas.json, playwright.config.ts
└── package.json

## Control de versiones

El `.gitignore` excluye `node_modules/`, `.env`, `.expo/` y `dist/`. No hay credenciales en el repositorio.
