# DocuKids - Frontend

**DocuKids** es una aplicación APK diseñada para ayudar a padres y tutores a gestionar y organizar la documentación de sus hijos de forma centralizada. La plataforma se integra de manera nativa con las herramientas de Google:
- **Google Drive / Gmail:** Para organizar, escanear y almacenar documentos importantes (certificados de vacunación, fichas escolares, estudios médicos).
- **Google Calendar:** Para agendar, sincronizar y recibir alertas de turnos médicos, eventos escolares y actividades extraescolares.

---

## 🚀 Requisitos e Instalación

### Prerrequisitos
- Node.js (versión 18.x o superior recomendada)
- npm, yarn o pnpm como gestor de paquetes

### Pasos para ejecutar el proyecto localmente

1. **Clonar el repositorio:**
   git clone https://github.com/lucastomasareco/docukidsfrontend.git
   cd docukidsfrontend

2. **Instalar dependencias:**
   npm install

3. **Configurar las variables de entorno:**
   Crea un archivo `.env` en la raíz del proyecto basándote en la plantilla `.env.example`:
   cp .env.example .env

   Define las variables necesarias en el archivo `.env`:
   REACT_APP_API_URL=http://localhost:8000/api
   REACT_APP_GOOGLE_CLIENT_ID=tu_google_client_id_aqui

4. **Ejecutar la aplicación en entorno de desarrollo:**
   npm start
   # o bien: npm run dev

   La aplicación estará disponible en `http://localhost:3000`.

---

## 📁 Estructura del Proyecto

El código fuente está organizado de forma modular para garantizar escalabilidad y mantenibilidad:

docukidsfrontend/

├── public/               # Archivos públicos estáticos

├── src/

│   ├── assets/             # Imágenes, íconos y recursos visuales

│   ├── components/         # Componentes reutilizables (Botones, Inputs, Navbar, Modales)

│   ├── config/             # Configuración de integración con Google APIs y Axios

│   ├── hooks/              # Custom Hooks para gestión de estado o llamadas async

│   ├── pages/              # Vistas principales (Home, Documentos, Turnos, Perfil)

│   ├── services/           # Servicios para peticiones HTTP a APIs (Drive, Calendar, Backend)

│   ├── styles/             # Archivos de estilos globales o módulos CSS/Tailwind

│   ├── App.js              # Enrutamiento y componente principal

│   └── index.js            # Punto de entrada de React

├── .env.example            # Plantilla de variables de entorno (sin credenciales)

├── .gitignore              # Archivos y carpetas excluidos del control de versiones

├── package.json            # Dependencias y scripts del proyecto

└── README.md               # Documentación del proyecto

---

## 🔒 Control de Versiones y `.gitignore`

- **Archivos excluidos:** El archivo `.gitignore` está configurado para omitir la carpeta `node_modules/`, archivos de entorno (`.env`, `.env.local`), carpetas de compilación (`build/`, `dist/`) y logs de errores.
- **Seguridad:** No existen credenciales, claves API privadas ni datos sensibles commiteados en el repositorio.
- 
