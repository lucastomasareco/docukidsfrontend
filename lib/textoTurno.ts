import { enlaceComoLlegar, lugarDeTurno, tieneLugar, CamposLugarTurno } from './lugares';
import { fechaCorta } from './fechas';

// Arma el texto de un turno para copiarlo y pegarlo en WhatsApp (texto plano, sin archivos).
// Incluye: de quién es, qué turno, día y hora, lugar con enlace de Google Maps, notas y los
// NOMBRES de los documentos a llevar (los documentos en sí no se envían).
// Cada dato va en su propia línea; el enlace va solo en su línea para que WhatsApp lo vuelva tocable.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// '2026-11-27' -> 'viernes'. Se arma con año/mes/día sueltos (hora local) para que la zona horaria no corra el día.
function nombreDelDia(iso: string): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  if (!anio || !mes || !dia) return '';
  return DIAS[new Date(anio, mes - 1, dia).getDay()] ?? '';
}

type TurnoParaCopiar = CamposLugarTurno & {
  title: string;
  date: string; // 'YYYY-MM-DD'
  time: string | null; // 'HH:MM:SS'
  notes: string | null;
  documents?: { name: string }[];
};

export function textoDeTurno(turno: TurnoParaCopiar, nombreHijo?: string): string {
  const lineas: string[] = [];

  lineas.push(`📅 *${turno.title.trim()}*${nombreHijo ? ` – ${nombreHijo}` : ''}`);

  const dia = nombreDelDia(turno.date);
  const hora = turno.time ? `${turno.time.slice(0, 5)} hs` : 'todo el día';
  lineas.push(`🕒 ${dia ? `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ` : ''}${fechaCorta(turno.date)} · ${hora}`);

  const lugar = lugarDeTurno(turno);
  if (tieneLugar(lugar)) {
    const nombre = lugar.nombre.trim();
    const direccion = lugar.direccion.trim();
    if (nombre) lineas.push(`📍 ${nombre}`);
    if (direccion) lineas.push(nombre ? direccion : `📍 ${direccion}`);
    const enlace = enlaceComoLlegar(lugar);
    if (enlace) lineas.push(enlace);
  }

  const notas = (turno.notes ?? '').trim();
  if (notas) lineas.push(`📝 ${notas}`);

  const documentos = (turno.documents ?? []).map((d) => d.name.trim()).filter(Boolean);
  if (documentos.length > 0) {
    lineas.push(`📄 Llevar: ${documentos.join(', ')}`);
  }

  return lineas.join('\n');
}
