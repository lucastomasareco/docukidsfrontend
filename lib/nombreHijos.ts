// Nombre editable de la pantalla "Hijos".
// Docukids tiene un foco (el cuidado parental) pero un alcance amplio: la persona puede llamar a
// esta pantalla "peludos", "abuelos", "hijas", "diablitos"... El "Mis" es fijo y no se escribe:
//   · barra de arriba:  "Mis " + nombre   → "Mis peludos"
//   · barra de abajo:   nombre con mayúscula inicial → "Peludos"
// Se guarda solo en este dispositivo (ver ChildrenContext). No importa nada de React.

export const NOMBRE_HIJOS_POR_DEFECTO = 'hijos';

// Largo máximo: tiene que entrar completo en la barra de abajo del celular (letra de 12 px, 4 pestañas).
export const MAX_NOMBRE_HIJOS = 12;

// Atajos para tocar en el editor (la persona también puede escribir lo que quiera).
export const SUGERENCIAS_NOMBRE_HIJOS = ['hijos', 'hijas', 'niños', 'bebés', 'peludos', 'abuelos', 'diablitos'];

// Saca espacios de más y corta al largo máximo. Si la persona escribió "Mis peludos", se saca el
// "Mis" (ya viene puesto). Si queda vacío, vuelve a "hijos".
export function limpiarNombreHijos(texto: string | null | undefined): string {
  const sinMis = (texto ?? '').replace(/\s+/g, ' ').trim().replace(/^mis\s+/i, '');
  const limpio = sinMis.slice(0, MAX_NOMBRE_HIJOS).trim();
  return limpio || NOMBRE_HIJOS_POR_DEFECTO;
}

export function tituloDeHijos(nombre: string): string {
  return `Mis ${nombre}`;
}

export function etiquetaPestanaHijos(nombre: string): string {
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}
