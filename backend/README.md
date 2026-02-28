# ⚙️ Nehli - Backend

Este directorio encapsula la API REST de **Nehli**, diseñada dinámicamente usando **Node.js** con el popular framework web **Express**. Se encarga de administrar toda la lógica principal, gestionar el control de los usuarios de la base de datos y proveer todos los servicios de streaming y autenticación al cliente.

---

## 🚀 Características de la API

- API RESTful completa con distintos endpoints agrupados por controladores y rutas (usuarios, videos, musica, etc).
- Arquitectura robusta basada en la interacción con la base de datos **MySQL**.
- Sistema de inicio de sesión, autorización y control seguro de identidades mediante el uso de **JSON Web Tokens (JWT)**.
- Validadores para proteger la integridad de los datos ingresados.
- Medidas activas de mitigación contra vulnerabilidades (cors, helmet, express-rate-limit).
- Separación de credenciales a través de un archivo de entorno protegido (`.env`).

---

## 📦 Stack Tecnológico

- **Entorno de Ejecución:** Node.js
- **Manejo del HTTP / Servidor:** Express.js
- **Persistencia Base de Datos:** MySQL
- **Autenticación (Auth):** JWT (jsonwebtoken), bcryptjs
- **Seguridad y Optimizaciones:** Helmet, express-rate-limit, cors

---

## 🔧 Requisitos Previos

- Node.js >= 16
- Servidor MySQL ejecutándose correctamente de manera local (XAMPP, Docker) o servidor remoto.

---

## ⚙️ Variables de Entorno

La API requiere de ciertas variables de entorno para funcionar de manera correcta, como por ejemplo la conexión a la base de datos y la llave maestra (firma) del registro JWT. 

**Debes crear en la raíz de esta carpeta `backend/` un archivo llamado `.env`** e importar ahí tus credenciales. Un ejemplo básico del contenido requerido es:

```ini
PORT=3000
HOST=localhost

# Clave Secreta para la generación y firma de los tokens
JWT_SECRET=TU_SUPER_SECRETO_AQUI

# Credenciales de conexión a MySQL
MYSQL_DATABASE=nehli_database
MYSQL_USER=nombre_user_bd
MYSQL_PASSWORD=contraseña_bd
MYSQL_HOST=localhost
```

---

## ▶️ Instalación y Ejecución

Guía para levantar las rutas del backend en tu máquina:

```bash
# 1. Asegúrate de encontrarte situado en este directorio (backend)
cd backend

# 2. Descarga e instala los módulos y dependencias de NPM
npm install

# 3. Arranca el entorno de la API (Ejecución común o con Nodemon si está disponible)
npm start
```

Por defecto, los servicios de la aplicación serán desplegados y escucharán a través del puerto configurado, el cual suele ser `http://localhost:3000/`.

---

## 🔗 Redirecciones Rápidas

- [🏠 Volver al README Principal](../README.md)
- [🧩 Ir al README del Frontend](../frontend/README.md)
