# Visor XYZ Molecular

Proyecto simple: visor web para archivos `.xyz`, con generación de enlaces y códigos QR para compartir y abrir en móvil.

Características
- Carga local de archivos `.xyz` y render con Three.js.
- Carga desde una URL pública (por ejemplo un raw de GitHub).
- Generación de enlace que embebe el contenido (base64) o que referencia una URL externa.
- Generación de código QR que apunta al visor con parámetros.

Archivos
- `index.html` — interfaz web y visor.
- `viewer.js` — lógica de parseo y render.
- `style.css` — estilos.
- `examples/` — ejemplos `water.xyz` y `methane.xyz`.

Cómo usar
1. Abrir `index.html` en un navegador (localmente o desplegado en GitHub Pages).
2. Seleccionar un archivo `.xyz` o pegar una URL pública a uno.
3. Pulsar "Renderizar" para ver la molécula.
4. Para generar un QR: elige "Embeder" (crea una URL con el archivo en base64) o "Usar URL externa" (la URL que pegaste). Pulsar "Generar QR".
5. Escanea el QR con el móvil; abrirá el visor con la molécula cargada.

Publicación en GitHub Pages
1. Crear nuevo repositorio en GitHub y subir estos archivos (por ejemplo en la rama `main`).
2. En los ajustes del repositorio, activar GitHub Pages seleccionando la rama `main` y la carpeta `/`.
3. Una vez publicada, obtén la URL del sitio. Si subiste también tus archivos `.xyz` a la carpeta `examples/`, puedes usar la URL raw de GitHub (https://raw.githubusercontent.com/<usuario>/<repo>/main/examples/water.xyz) y generar un QR con la opción "Usar URL externa".

Notas
- Los archivos embebidos con base64 quedan dentro de la URL; para archivos grandes el QR puede fallar (limitación de tamaño de QR). Para moléculas grandes sube el `.xyz` al repositorio y usa la opción "Usar URL externa" apuntando al raw.
- Este visor es minimalista y pretende ser punto de partida; mejoras posibles: paleta de colores por elemento, mejor detección de enlaces, modelado de esferas con radios más precisos, selección/etiquetado, descargar imagen, etc.

RMSD y comparación de estructuras
- La funcionalidad de comparación muestra dos `.xyz` superpuestos y calcula un RMSD "sin alineado": se asume correspondencia por orden de átomos y no se aplica la rototranslación de Kabsch. Si necesitas RMSD alineado (más correcto para comparar conformaciones), puedo añadir el algoritmo Kabsch y una opción para aplicarlo antes de calcular el RMSD.

Nota sobre Three.js
- Este proyecto fija Three.js a la versión r146 en los includes para mantener compatibilidad con la exportación global de `THREE.OrbitControls` via `examples/js/controls/OrbitControls.js`. Versiones r150+ cambian el empaquetado y pueden producir el error "OrbitControls is not a constructor".

Si quieres, puedo:
- Añadir soporte para formatos adicionales (PDB, SDF).
- Hacer un pequeño script de subida automatizada a GitHub desde tu máquina.
- Preparar un deploy automático en GitHub Actions que publique en GitHub Pages.
