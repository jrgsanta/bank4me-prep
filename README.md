# Bank4Me PDF Prep Microservice 🖋️

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![pdf-lib](https://img.shields.io/badge/PDF--Lib-v1.17.1-blue)

Este microservicio es una herramienta técnica diseñada para la **preparación automatizada de documentos PDF** destinados a procesos de firma digital grafométrica. Su función principal es inyectar el campo de formulario `SignatureField1` necesario para que los periféricos de firma (tabletas Wacom, Topaz, etc.) identifiquen el área de captura en la plataforma **Bank4Me**.

---

## 📖 Tabla de Contenidos
1. [Características](#-características)
2. [Arquitectura del Sistema](#-arquitectura-del-sistema)
3. [Requisitos e Instalación](#-requisitos-e-instalación)
4. [Configuración (documentos.json)](#-configuración-documentosjson)
5. [Uso del Microservicio](#-uso-del-microservicio)
6. [Solución de Problemas (FAQ)](#-solución-de-problemas-faq)

---

## 🚀 Características

* **Posicionamiento por Etiqueta:** Escaneo dinámico de texto para localizar etiquetas como `[FIRMA_AQUI]` y posicionar la firma automáticamente.
* **Posicionamiento por Coordenadas:** Definición manual de ejes (X, Y) y número de página para documentos estándar.
* **Interfaz de Usuario:** Frontend minimalista (SPA) para carga de archivos y previsualización.
* **Compatibilidad AcroForm:** Generación de campos de formulario compatibles con los estándares de firma ISO.

---

## 🏗️ Arquitectura del Sistema

El flujo de trabajo sigue un modelo de microservicio clásico:

1. **Frontend:** El usuario selecciona un archivo y un tipo de documento.
2. **Backend:** Node.js recibe el buffer del PDF, busca la posición de firma y utiliza `pdf-lib` para modificar el diccionario interno del documento.
3. **Salida:** Se devuelve un PDF modificado que contiene la infraestructura de formulario necesaria.



---

## 🛠️ Requisitos e Instalación

### Requisitos previos
- **Node.js**: v16.x o superior.
- **npm**: v7.x o superior.

### Instalación
```bash
# Clonar el repositorio
git clone [https://github.com/jrgsanta/bank4me-prep.git](https://github.com/jrgsanta/bank4me-prep.git)
cd bank4me-prep

# Limpiar instalaciones previas e instalar dependencias actualizadas
rm -rf node_modules package-lock.json
npm install

## ⚙️ Configuración (`documentos.json`)

El sistema es totalmente dinámico. Puedes añadir nuevos documentos editando este fichero sin necesidad de modificar el código fuente:

```json
[
  {
    "id": "CONTRATO_01",
    "nombre": "Contrato de Apertura",
    "tieneEtiqueta": true,
    "etiqueta": "[FIRMA_AQUI]"
  },
  {
    "id": "MANDATO_SEPA",
    "nombre": "Mandato SEPA (Fijo)",
    "tieneEtiqueta": false,
    "x": 450,
    "y": 120,
    "pagina": 0
  }
]

## 🚀 Uso del Microservicio
Para poner en marcha el servicio de preparación de documentos, sigue estos pasos:

Inicia el servidor:

Bash
npm run dev
Acceso web: Abre tu navegador en http://localhost:3000.

Procesamiento: * Selecciona tu archivo PDF (puedes usar test-gen.js para crear uno de prueba si no tienes uno con etiquetas).

Elige el tipo de documento del desplegable.

Pulsa en Procesar para obtener el PDF listo para la tableta de firma.

## 🔧 Solución de Problemas (FAQ)
¿Error: form.createSignature is not a function?
Este error ocurre si Node.js carga una versión antigua de pdf-lib de la caché o del sistema.
Solución: Asegúrate de que tu package.json indique "pdf-lib": "1.17.1". El proyecto incluye un bloque de "Plan B" en app.js que utiliza campos de texto con el ID técnico correcto como fallback si la función de firma nativa no está disponible en el entorno local.

¿No se encuentra la etiqueta en el PDF?
Asegúrate de que el PDF no esté "rasterizado" (es decir, que no sea una imagen escaneada). La búsqueda de coordenadas requiere que el PDF mantenga su capa de texto digital. Puedes verificarlo intentando seleccionar el texto con el ratón en cualquier lector de PDF.

## 📂 Estructura del Proyecto
app.js: Servidor Express y lógica de inyección de campos mediante coordenadas o etiquetas.

index.html: Interfaz web de usuario (Frontend SPA).

documentos.json: Base de datos de configuración de tipos de documentos.

test-gen.js: Utilidad para generar documentos PDF de prueba con etiquetas de anclaje.


### Un último detalle
Este fichero resume todo el flujo de trabajo: el contexto de **Bank4Me**, los retos técnicos con las versiones de la librería y la guía de puesta en marcha.

¿Te gustaría que añadiera una sección sobre cómo integrar esto con un **almacenamiento en la nube (como AWS S3)** o prefieres dejarlo como un microservicio local por ahora?