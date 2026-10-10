// Textos de la guía de cada pantalla. Todo el contenido está acá para poder
// cambiarlo sin tocar el diseño (components/PanelAyuda.tsx).

export type PantallaAyuda = 'docs' | 'calendario' | 'hijos' | 'ajustes';

export type ConsejoAyuda = {
  icono: 'cloud-upload-outline' | 'hand-left-outline' | 'color-palette-outline' | 'calendar-outline'
    | 'add-circle-outline' | 'people-outline' | 'logo-google' | 'lock-closed-outline' | 'mail-outline'
    | 'checkmark-circle-outline' | 'trash-outline';
  texto: string;
};

export type AyudaDeUnaPantalla = {
  titulo: string;
  consejos: ConsejoAyuda[];
};

export const AYUDAS: Record<PantallaAyuda, AyudaDeUnaPantalla> = {
  docs: {
    titulo: 'Cómo usar Documentos',
    consejos: [
      { icono: 'cloud-upload-outline', texto: 'Tocá SUBIR DOCUMENTO y elegí una foto o un PDF (DNI, carnet de vacunas…).' },
      { icono: 'checkmark-circle-outline', texto: 'Si tiene fecha de vencimiento, la app la detecta y te pide confirmarla. Te avisamos por email antes de que venza.' },
      { icono: 'hand-left-outline', texto: 'Tocá un documento para abrirlo. Mantené presionado para cambiarle el nombre o borrarlo.' },
      { icono: 'color-palette-outline', texto: 'Verde: vigente. Naranja: vence en 30 días o menos. Rojo: vencido.' },
    ],
  },
  calendario: {
    titulo: 'Cómo usar el Calendario',
    consejos: [
      { icono: 'add-circle-outline', texto: 'Tocá un día sin turnos para agendar uno nuevo. Si no elegís hora, es de todo el día.' },
      { icono: 'calendar-outline', texto: 'Tocá un día con turnos para ver solo los de ese día. Tocalo de nuevo para ver todos.' },
      { icono: 'hand-left-outline', texto: 'Mantené presionado un turno para editarlo o eliminarlo.' },
      { icono: 'mail-outline', texto: 'Los turnos también se guardan en tu Google Calendar.' },
    ],
  },
  hijos: {
    titulo: 'Cómo usar Hijos',
    consejos: [
      { icono: 'people-outline', texto: 'Tocá Registrar hijo para crear su perfil. Podés agregar a todos los que quieras.' },
      { icono: 'hand-left-outline', texto: 'Mantené presionado un hijo para cambiarle el nombre o eliminarlo.' },
      { icono: 'checkmark-circle-outline', texto: 'El hijo que tocás queda elegido: sus documentos y turnos aparecen en Docs y Calendario.' },
    ],
  },
  ajustes: {
    titulo: 'Cómo usar Ajustes',
    consejos: [
      { icono: 'logo-google', texto: 'Conectá tu cuenta de Google: es necesaria para subir documentos, agendar turnos y recibir avisos por email.' },
      { icono: 'color-palette-outline', texto: 'Elegí los colores de la app en Apariencia.' },
      { icono: 'lock-closed-outline', texto: 'Desde acá podés cambiar tu contraseña o cerrar sesión.' },
    ],
  },
};

// Rutas de las pestañas -> pantalla de la guía.
export const PANTALLA_POR_RUTA: Record<string, PantallaAyuda> = {
  '/': 'docs',
  '/index': 'docs',
  '/calendario': 'calendario',
  '/hijos': 'hijos',
  '/ajustes': 'ajustes',
};
