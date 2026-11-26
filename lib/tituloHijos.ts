// Título editable de la pantalla "Hijos" (el de la barra de arriba).
// Docukids está pensado para el cuidado parental, pero la persona puede llamarlo como quiera:
// "Mis hijas", "Mis peludos", "Mis abuelos"... Se guarda solo en este dispositivo (ver ChildrenContext).
// No importa nada de React: así la lógica se puede probar con Node solo.

export const TITULO_HIJOS_POR_DEFECTO = 'Mis hijos';

// Largo máximo: que entre en la barra de arriba, incluso en el celular.
export const MAX_TITULO_HIJOS = 24;

// Atajos para tocar en el editor (la persona también puede escribir lo que quiera).
export const SUGERENCIAS_TITULO_HIJOS = ['Mis hijos', 'Mis hijas', 'Mis bebés', 'Mis peludos', 'Mis abuelos', 'Mis diablitos'];

// Saca espacios de más y corta al largo máximo. Si queda vacío, vuelve al título de siempre.
export function limpiarTituloHijos(texto: string | null | undefined): string {
  const limpio = (texto ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITULO_HIJOS).trim();
  return limpio || TITULO_HIJOS_POR_DEFECTO;
}
