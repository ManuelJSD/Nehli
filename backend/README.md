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
- FFmpeg y FFprobe en el servidor. FFmpeg debe incluir los codificadores `libx264` y `aac` y los demultiplexores y decodificadores de los vídeos de tu biblioteca.

Comprueba que el backend puede ejecutar `ffmpeg -version` y `ffprobe -version` desde la misma cuenta con la que arrancas Node.js. Si los binarios están fuera del `PATH`, indica sus rutas en `.env`.

---

## ⚙️ Variables de Entorno

La API requiere de ciertas variables de entorno para funcionar de manera correcta, como por ejemplo la conexión a la base de datos y la llave maestra (firma) del registro JWT. 

**Debes crear en la raíz de esta carpeta `backend/` un archivo llamado `.env`** e importar ahí tus credenciales. Un ejemplo básico del contenido requerido es:

```ini
PORT=3000
HOST=localhost
CORS_ORIGIN=http://localhost:4200

# Clave Secreta para la generación y firma de los tokens
JWT_SECRET=TU_SUPER_SECRETO_AQUI

# Credenciales de conexión a MySQL
MYSQL_DATABASE=nehli_database
MYSQL_USER=nombre_user_bd
MYSQL_PASSWORD=contraseña_bd
MYSQL_HOST=localhost
CORS_ORIGIN=http://localhost:4200

# Biblioteca multimedia
VIDEO_FOLDER=./videos

# Opcional si los binarios están fuera del PATH
# FFMPEG_PATH=/ruta/a/ffmpeg
# FFPROBE_PATH=/ruta/a/ffprobe
```

`VIDEO_FOLDER` apunta a la biblioteca organizada en directorios de categorías. El catálogo reconoce las extensiones de vídeo habituales, incluidas MP4, MKV, AVI, MOV, WebM, FLV, MPEG y TS. Para archivos sin extensión o con una extensión poco habitual, FFprobe comprueba si contienen una pista de vídeo. Los archivos de acompañamiento habituales se dejan fuera del catálogo.

Nehli sirve directamente los MP4 compatibles y usa FFmpeg para generar HLS con H.264 hasta 1080p y AAC estéreo cuando necesita convertir el vídeo o seleccionar otra pista de audio. El reproductor permite elegir las pistas de audio y subtítulos incluidas en el archivo. Los subtítulos de texto se muestran mediante WebVTT. Los subtítulos de imagen se integran en el vídeo al seleccionarlos. La compatibilidad con archivos de origen depende de los formatos que pueda leer la instalación de FFmpeg del servidor.

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

## Portadas y fichas locales

Nehli compara el título con los resultados externos y usa el año de estreno cuando aparece entre paréntesis en el nombre. Si ninguna fuente devuelve una portada válida, se genera una captura del vídeo. Las fichas de películas también pueden mostrar un extracto de Wikipedia con enlace a la fuente. Para corregir una ficha, guarda un archivo de metadatos junto a los vídeos.

- Si el título está en una carpeta, usa `VIDEO_FOLDER/Series/Mi serie/metadata.json`.
- Si el vídeo está directamente en una categoría, usa el mismo nombre base. Junto a `Mi película (2024).mkv`, guarda `Mi película (2024).metadata.json`.

```json
{
  "title": "Mi película",
  "year": 2024,
  "synopsis": "La sinopsis que quieres mostrar.",
  "genres": ["Drama"],
  "cover": "portada.webp"
}
```

Los campos son opcionales y prevalecen sobre los datos externos. Guarda la imagen junto al JSON e indica su nombre en `cover`. Para cambiar solo la portada, en una carpeta basta con una imagen llamada `poster`, `cover` o `portada`. Para un vídeo suelto, usa una imagen con el mismo nombre base que el vídeo. Se admiten JPG, PNG, WebP y GIF.

La caché de fichas, portadas y capturas se guarda en `~/.cache/nehli-metadata`. Puedes cambiar su ubicación con `METADATA_CACHE_FOLDER`. Tras escanear la biblioteca, Nehli prepara las entradas en segundo plano y deja de iniciar tareas de preparación mientras hay reproducción activa.

Los segmentos HLS se reutilizan desde "~/.cache/nehli-segments". Puedes cambiar la carpeta con "SEGMENT_CACHE_FOLDER". La limpieza periódica conserva hasta 512 segmentos recientes y 512 MiB. Si el vídeo H.264 es compatible y los fotogramas clave permiten dividirlo en segmentos independientes, Nehli copia el vídeo al contenedor HLS. Los demás formatos y los subtítulos de imagen siguen usando la conversión habitual.
