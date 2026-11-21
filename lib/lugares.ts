// Lugar de un turno (v2.7): nombre, dirección y coordenadas, todo opcional.
// Habla con el backend (/places/search y /places/reverse), que consulta Nominatim
// (el buscador de OpenStreetMap). Este archivo no importa nada de React Native.
import { api } from './api';
import { esTurnoPasado } from './fechas';

export type Lugar = {
  nombre: string;
  direccion: string;
  lat: number | null;
  lon: number | null;
};

export const LUGAR_VACIO: Lugar = { nombre: '', direccion: '', lat: null, lon: null };

export type ResultadoLugar = { name: string | null; address: string | null; lat: number; lon: number };

// Campos que trae un turno desde el backend.
export type CamposLugarTurno = {
  location_name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function lugarDeTurno(t: CamposLugarTurno): Lugar {
  return {
    nombre: t.location_name ?? '',
    direccion: t.address ?? '',
    lat: t.latitude ?? null,
    lon: t.longitude ?? null,
  };
}

export const tieneUbicacion = (l: Lugar) => l.lat !== null && l.lon !== null;
export const tieneLugar = (l: Lugar) => !!(l.nombre.trim() || l.direccion.trim() || tieneUbicacion(l));

// Cuerpo para el backend. Al EDITAR siempre se mandan los cuatro campos (null = quitar).
// Al CREAR, si no hay lugar, no se manda nada.
export function camposParaBackend(l: Lugar, alEditar: boolean) {
  if (!alEditar && !tieneLugar(l)) return {};
  return {
    location_name: l.nombre.trim() || null,
    address: l.direccion.trim() || null,
    latitude: l.lat,
    longitude: l.lon,
  };
}

// Texto corto para mostrar en la tarjeta del turno.
export function tituloDeLugar(l: Lugar): string {
  return l.nombre.trim() || l.direccion.trim() || 'Ubicación en el mapa';
}

// "Cómo llegar": abre Google Maps (no necesita API key). Con coordenadas apunta al pin;
// sin ellas, busca por la dirección escrita.
export function enlaceComoLlegar(l: Lugar): string | null {
  if (tieneUbicacion(l)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lon}`;
  }
  const texto = [l.nombre, l.direccion].map((x) => x.trim()).filter(Boolean).join(', ');
  return texto ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(texto)}` : null;
}

export async function buscarLugares(texto: string): Promise<ResultadoLugar[]> {
  const r = await api.get('/places/search', { params: { q: texto } });
  return r.data.results as ResultadoLugar[];
}

export async function lugarDePunto(lat: number, lon: number): Promise<ResultadoLugar> {
  const r = await api.get('/places/reverse', { params: { lat, lon } });
  return r.data as ResultadoLugar;
}

// Si el buscador falló por un motivo propio (ocupado, caído), el backend manda un texto
// ya escrito para personas en "detail". Para cualquier otro error devuelve null y la
// pantalla usa el aviso común (sin internet, servidor despertando, etc.).
export function mensajeDeBuscador(e: any): string | null {
  const estado = e?.response?.status;
  const detalle = e?.response?.data?.detail;
  if ((estado === 429 || estado === 502) && typeof detalle === 'string') return detalle;
  return null;
}

// ---------- Últimos lugares de un hijo (v2.7, etapa 2) ----------

export type TurnoConLugar = CamposLugarTurno & {
  id: number;
  title: string;
  date: string; // 'YYYY-MM-DD'
  time: string | null;
};

export type UltimoLugar = {
  lugar: Lugar;
  // El turno más reciente que se hizo en ese lugar.
  turnoTitulo: string;
  fecha: string; // 'YYYY-MM-DD'
  // Cuántos turnos pasados hubo en ese lugar.
  veces: number;
};

const sinTildes = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Dos turnos son "el mismo lugar" si el pin cae a unos 10 metros (4 decimales), o, sin pin,
// si el nombre y la dirección escritos coinciden (sin importar mayúsculas ni tildes).
function claveDeLugar(l: Lugar): string {
  if (l.lat !== null && l.lon !== null) return `p:${l.lat.toFixed(4)},${l.lon.toFixed(4)}`;
  return `t:${sinTildes(l.nombre)}|${sinTildes(l.direccion)}`;
}

// De los turnos de un hijo, los lugares donde YA fue, del más reciente al más antiguo y sin repetir.
// Los turnos futuros no cuentan: la pregunta es "¿dónde fue la última vez?".
export function ultimosLugares(turnos: TurnoConLugar[], maximo = 5): UltimoLugar[] {
  const pasados = turnos
    .filter((t) => tieneLugar(lugarDeTurno(t)) && esTurnoPasado(t.date, t.time))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1; // más nuevo primero
      return (b.time || '').localeCompare(a.time || '');
    });

  const porClave = new Map<string, UltimoLugar>();
  for (const t of pasados) {
    const lugar = lugarDeTurno(t);
    const clave = claveDeLugar(lugar);
    const existente = porClave.get(clave);
    if (existente) {
      existente.veces += 1;
      // El nombre más reciente manda, pero si le faltaba un dato que un turno viejo sí tenía, se completa.
      if (!existente.lugar.nombre && lugar.nombre) existente.lugar.nombre = lugar.nombre;
      if (!existente.lugar.direccion && lugar.direccion) existente.lugar.direccion = lugar.direccion;
    } else {
      porClave.set(clave, { lugar, turnoTitulo: t.title, fecha: t.date, veces: 1 });
    }
  }
  return Array.from(porClave.values()).slice(0, maximo);
}

// ¿Hay turnos futuros con lugar? Sirve para explicar un listado vacío ("todavía no fue a ninguno, pero hay uno agendado").
export function hayProximosConLugar(turnos: TurnoConLugar[]): boolean {
  return turnos.some((t) => tieneLugar(lugarDeTurno(t)) && !esTurnoPasado(t.date, t.time));
}
