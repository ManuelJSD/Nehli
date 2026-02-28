# 🎬 Nehli - Plataforma de Streaming VOD

[![Estado del Proyecto](https://img.shields.io/badge/Estado-En%20Desarrollo-orange.svg)]()
[![Licencia](https://img.shields.io/badge/Licencia-MIT-blue.svg)]()

**Nehli** es una plataforma web de streaming de video bajo demanda inspirada en Netflix. Este repositorio contiene el proyecto completo, dividido en dos partes principales: el frontend (interfaz de usuario) y el backend (API REST y lógica de negocio).

---

## 🏗️ Arquitectura del Proyecto

El proyecto está estructurado en un entorno de trabajo que incluye:

- **[Frontend](./frontend)**: Aplicación web cliente desarrollada en **Angular 15** con **PrimeNG**, un diseño premium/oscuro, y **Video.js** para la reproducción multimedia.
- **[Backend](./backend)**: API RESTful robusta desarrollada en **Node.js** con **Express** y **MySQL** para la gestión de datos.

---

## 🚀 Características Generales

- 🎥 Reproducción de video bajo demanda con interfaz de "Video.js" personalizada.
- 🎨 Diseño oscuro, moderno y premium, con animaciones y microinteracciones detalladas.
- 🔐 Sistema de autenticación seguro y gestión de usuarios mediante JWT.
- 🎬 Catálogo de contenido organizado por categorías, tendencias y temporadas.
- 📱 Ecosistema completamente responsivo (dispositivos móviles, tablets y escritorio).

---

## 🛠️ Tecnologías Principales

### Frontend
- **Angular 15**
- **PrimeNG** + PrimeIcons
- **Video.js**
- **RXJS**

### Backend
- **Node.js** + **Express**
- **MySQL**
- **JWT** (JSON Web Tokens)
- **Helmet / Express-Rate-Limit** (Seguridad)

---

## ⚙️ Requisitos Previos

Para ejecutar todo el proyecto en tu entorno local, necesitarás tener instalado:

- [Node.js](https://nodejs.org/) (v16 o superior recomendado)
- [Angular CLI](https://cli.angular.io/) (v15 o superior)
- Base de datos MySQL local o remota en funcionamiento.

---

## ▶️ Instalación y Ejecución

Al ser un proyecto Full-Stack, necesitas configurar y levantar ambas partes por separado.

### 1. Configuración del Backend (API)
Navega a la base de la carpeta backend, configura las credenciales de la base de datos e instala los paquetes necesarios:

```bash
cd backend
npm install
# Crea el archivo .env basándote en un .env.example o instrucciones del backend
npm start
```
*Para configuración detallada sobre las variables de entorno, revisa el [README del Backend](./backend/README.md).*

### 2. Configuración del Frontend (Cliente)
En una nueva instancia de tu terminal, ve al directorio de frontend y compila el entorno de desarrollo:

```bash
cd frontend
npm install
npm start
```
*Puedes ver más scripts y comandos útiles en el [README del Frontend](./frontend/README.md).*

---

## 🔗 Estructura de Navegación Rápida

- 📁 `frontend/` - Código fuente de la interfaz web en Angular.
- 📁 `backend/` - Node.js Express server y conexión a base de datos.
- 📄 `README.md` - Documentación general del proyecto (este archivo).

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
