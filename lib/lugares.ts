// Lugar de un turno (v2.7): nombre, dirección y coordenadas, todo opcional.
// Habla con el backend (/places/search y /places/reverse), que consulta Nominatim
// (el buscador de OpenStreetMap). Este archivo no importa nada de React Native.
import { api } from './api';

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
