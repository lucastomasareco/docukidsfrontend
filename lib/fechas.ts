// Helpers de fechas compartidos (Docs y Calendario).
// El backend siempre manda/recibe fechas ISO ('2026-10-10'); acá solo cambia
// cómo se MUESTRAN. Se parte el texto a mano (sin new Date) para que la zona
// horaria del teléfono nunca corra la fecha un día.

const REGEX_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

// '2026-10-10' -> '10/10/2026'. Si el texto no es una fecha ISO, lo devuelve igual.
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = REGEX_ISO.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// Fecha de hoy del teléfono en formato ISO ('AAAA-MM-DD').
export function fechaDeHoy(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

// ¿El turno ya pasó? Pasado = fecha anterior a hoy, o es hoy y la hora ya pasó.
// Un turno de hoy SIN hora cuenta como próximo (dura todo el día).
// 'hora' llega del backend como 'HH:MM:SS' (o null).
export function esTurnoPasado(fecha: string, hora: string | null): boolean {
  const hoy = fechaDeHoy();
  if (fecha < hoy) return true;
  if (fecha > hoy || !hora) return false;
  const ahora = new Date();
  const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
  return hora.slice(0, 5) < horaActual;
}

// Devuelve el mismo color con transparencia. Solo para colores '#RRGGBB'
// (los temas lo son). opacidad: 0 a 1 (0.5 = 50 %).
export function colorConOpacidad(hex: string, opacidad: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const alfa = Math.round(opacidad * 255).toString(16).padStart(2, '0');
  return `${hex}${alfa}`;
}
