# Curiosity Voyage (Vite + Three.js)

El logo se convierte en bote, avión y nave, y hay que encontrar las letras del nombre explorando.

## Uso

Requiere Node 18 o superior.

```bash
npm install
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # genera dist/ para publicar
npm run preview    # prueba el build local
```

El contenido de `dist/` se puede subir a cualquier hosting estático (usa rutas relativas).

## Tus modelos FBX

Van en `public/assets/models/` (Vite los sirve tal cual):

```
public/assets/models/
├── logo.fbx
└── letters/
    ├── E.fbx  M.fbx  B.fbx  A.fbx  R.fbx  K.fbx
```

- Una letra por archivo, nombrada con la letra en **mayúscula**.
- Se centran y escalan solos. Si alguno sale acostado o girado, corrige `rotation` (grados) en `src/js/config.js`, por ejemplo `[-90, 0, 0]`.
- Texturas: mejor embebidas en el FBX; si son externas, ponlas junto al FBX.
- Si falta un archivo, el juego usa un reemplazo temporal y avisa arriba de la pantalla cuál no encontró.

## Estructura

```
index.html
vite.config.js
public/assets/models/    tus FBX
src/css/style.css        interfaz
src/js/config.js         nombre, eslogan, código, niveles, rutas y tamaños de modelos
src/js/main.js           lógica del juego
src/js/models.js         carga de FBX, normalización y reemplazos
src/js/vehicles.js       bote, avión y nave (procedurales)
src/js/worlds.js         escenarios
src/js/utils.js          utilidades y audio
```

## Jugar

- **Iniciar:** clic en el logo o el nombre, Enter, o escribir el código (`CURIOUS` por defecto).
- **W / S** acelerar y frenar, **A / D** girar, **Espacio / Shift** subir y bajar (avión y nave).
- Las letras solo se ven de cerca; la barra de **señal** indica qué tan cerca estás sin dar dirección.
- Al encontrar todas las letras, el vehículo vuelve a ser logo y aparece el eslogan.
