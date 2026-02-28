# 🎬 Nehli - Frontend

Este directorio contiene la aplicación cliente de **Nehli**, desarrollada en **Angular 15**. Se encarga de proveer una interfaz de usuario moderna, oscura y cinematográfica adaptada al estilo de plataformas de streaming premium.

---

## 🚀 Características del Cliente

- Reproductor de video integrado y personalizado mediante [Video.js](https://videojs.com/).
- Componentes modulares y visualmente atractivos gracias al uso e integración de [PrimeNG](https://primeng.org/) y PrimeIcons.
- Consumo e intercepción fluida de la API REST para el backend de Nehli.
- Sistema de enrutamiento y guardias de navegación entre catálogo, previsualización, login y registro.
- Interfaz y disposición del diseño completamente responsiva para cualquier tamaño de pantalla.
- Implementación de animaciones premium y optimización del CSS global para mantener coherencia en el diseño.

---

## 📦 Stack Tecnológico

- **Framework:** Angular 15
- **Estilos:** CSS3 / Variables de Diseño Globales / Interacciones UI Premium
- **Toolkit de Interfaz:** PrimeNG + PrimeIcons
- **Reproductor Multimedia:** Video.js
- **Reactividad:** RxJS, Zone.js

---

## 🔧 Requisitos Previos

- Node.js >= 16
- Angular CLI >= 15

---

## ▶️ Ejecución en Local

Sigue estos pasos para levantar el entorno de desarrollo del frontend en tu máquina local:

```bash
# 1. Asegúrate de estar en el directorio del frontend
cd frontend

# 2. Instalar todas las dependencias requeridas
npm install

# 3. Levantar el servidor de desarrollo en vivo de Angular
npm start
```

Una vez que compile y arranque, la aplicación abrirá su servidor y estará disponible habitualmente en `http://localhost:4200/`. La pantalla de desarrollo recargará automáticamente el navegador si realizas cambios y guardas en el código fuente.

---

## 🛠️ Scripts de Ayuda Disponibles

Dentro del directorio del frontend, están habilitados los siguientes comandos en el archivo package.json:

- `npm start` → Inicia el servidor de desarrollo local con Angular CLI.
- `npm run build` → Compila toda la aplicación y genera los estáticos de producción (en una carpeta `dist/`).
- `npm test` → Ejecuta la suite de pruebas y tests unitarios configurados (Karma/Jasmine).

---

## 🔗 Redirecciones Rápidas

- [🏠 Volver al README Principal](../README.md)
- [⚙️ Ir al README del Backend](../backend/README.md)
