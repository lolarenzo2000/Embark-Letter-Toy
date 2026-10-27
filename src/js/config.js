/* ===================== CONFIGURACIÓN =====================
   Todo lo que quieras ajustar vive aquí.

   MODELOS FBX (carpeta assets/models):
   - logo.fbx                 → el logo
   - letters/E.fbx, M.fbx ... → una letra por archivo, nombrada con la letra

   size      → tamaño máximo (en unidades del juego) al que se escala el modelo.
               Se escala y centra solo, no importa en qué unidades lo exportaste.
   rotation  → [x, y, z] en GRADOS para corregir la orientación del modelo
               (por ejemplo [-90, 0, 0] si tu FBX viene acostado). */
const BASE = import.meta.env.BASE_URL;

export const CONFIG = {
  name: 'EMBARK',
  slogan: 'The future is for the curious',
  code: 'CURIOUS',               // código para empezar desde la pantalla de inicio

  models: {
    logo: { url: BASE + 'assets/models/logo.fbx', size: 4, rotation: [0, 0, 0] },
    letters: { dir: BASE + 'assets/models/letters/', ext: '.fbx', size: 5, rotation: [0, 0, 0] }
  },

  collectRadius: 7,             // qué tan cerca hay que pasar para recoger una letra

  // `letters` son índices del nombre: 0=E 1=M 2=B 3=A 4=R 5=K
  levels: [
    { type: 'boat',  letters: [0, 1], title: 'Nivel 1 · Mar' },
    { type: 'plane', letters: [2, 3], title: 'Nivel 2 · Cielo' },
    { type: 'ship',  letters: [4, 5], title: 'Nivel 3 · Espacio' }
  ]
};
