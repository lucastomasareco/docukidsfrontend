// Llamadas al backend para la función de familias (Guía §12) y utilidades puras.
// No importa nada de React: así la lógica se puede probar con Node solo.
//
// Los errores NO se traducen acá: cada función deja pasar el error de Axios y
// quien la llama lo muestra con useAvisos().mostrarError (lib/errores.ts).

import { api } from './api';

export type RolFamilia = 'owner' | 'member';

export type MiembroFamilia = {
  id: string;
  email: string;
  role: RolFamilia;
};

export type Familia = {
  id: number;
  role: RolFamilia; // el rol de QUIEN CONSULTA
  members: MiembroFamilia[]; // el titular va primero
  // Solo los ve el titular y solo mientras el código está vigente.
  invite_code?: string;
  invite_expires_at?: string; // ISO 8601 en UTC con "+00:00"
};

export type CodigoInvitacion = {
  invite_code: string;
  invite_expires_at: string;
};

// --- Llamadas ---------------------------------------------------------------

// null = la persona todavía no tiene familia.
export async function leerFamilia(): Promise<Familia | null> {
  const r = await api.get('/family');
  return (r.data?.family as Familia | null) ?? null;
}

export async function crearFamilia(): Promise<Familia> {
  const r = await api.post('/family');
  return r.data.family as Familia;
}

export async function generarInvitacion(): Promise<CodigoInvitacion> {
  const r = await api.post('/family/invite');
  return r.data as CodigoInvitacion;
}

export async function unirseConCodigo(codigo: string): Promise<Familia> {
  const r = await api.post('/family/join', { code: normalizarCodigo(codigo) });
  return r.data.family as Familia;
}

export async function salirDeFamilia(): Promise<void> {
  await api.post('/family/leave');
}

export async function quitarMiembro(usuarioId: string): Promise<void> {
  await api.delete(`/family/members/${encodeURIComponent(usuarioId)}`);
}

export async function disolverFamilia(): Promise<void> {
  await api.delete('/family');
}

// --- Utilidades puras -------------------------------------------------------

// Lo que la persona escribe o pega: se pasa a mayúsculas y se sacan espacios
// y guiones ("abc 234" o "ABC-234" → "ABC234").
export function normalizarCodigo(texto: string): string {
  return (texto ?? '').toUpperCase().replace(/[\s-]+/g, '');
}

// Un código es de 6 caracteres. Sirve para habilitar el botón "Unirme".
export function codigoCompleto(texto: string): boolean {
  return normalizarCodigo(texto).length === 6;
}

// Huella de QUIÉN forma la familia (no incluye el código de invitación).
// Si cambia entre dos lecturas, cambió la pertenencia y hay que recargar los hijos.
export function firmaDe(familia: Familia | null): string {
  if (!familia) return 'sin-familia';
  const ids = familia.members.map((m) => m.id).sort().join(',');
  return `${familia.id}|${familia.role}|${ids}`;
}

// Milisegundos que le quedan al código; 0 si no hay código o ya venció.
export function msRestantes(familia: Familia | null, ahora: number = Date.now()): number {
  const vence = familia?.invite_expires_at;
  if (!familia?.invite_code || !vence) return 0;
  const t = new Date(vence).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, t - ahora);
}

export function codigoVigente(familia: Familia | null, ahora: number = Date.now()): boolean {
  return msRestantes(familia, ahora) > 0;
}

// "Vence en 23 h 59 min" / "Vence en 45 min" / "Venció".
export function textoVencimiento(ms: number): string {
  if (ms <= 0) return 'Venció';
  const minutosTotales = Math.ceil(ms / 60000);
  const h = Math.floor(minutosTotales / 60);
  const m = minutosTotales % 60;
  if (h === 0) return `Vence en ${m} min`;
  return m === 0 ? `Vence en ${h} h` : `Vence en ${h} h ${m} min`;
}

// "ABC234" → "ABC 234" (más fácil de leer y de dictar). Si no tiene 6 caracteres, se deja igual.
export function formatearCodigo(codigo: string): string {
  const c = normalizarCodigo(codigo);
  return c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c;
}

// Fecha y hora de vencimiento, en la hora del aparato ("jue 6 nov, 11:30").
// Devuelve '' si la fecha no es válida.
export function formatearVence(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// El mensaje que se comparte o se copia para pasárselo a la otra persona.
export function textoInvitacion(codigo: string, venceIso: string | undefined): string {
  const vence = formatearVence(venceIso);
  return (
    `Te invito a mi familia en Docukids. Tu código es ${formatearCodigo(codigo)}` +
    (vence ? ` y sirve hasta el ${vence}` : '') +
    `. Abrí Ajustes → Familia → "Unirme con código" y escribilo.`
  );
}

// Texto de la confirmación de "Eliminar cuenta", según el rol (Guía §12):
//  - titular: la familia se disuelve y el miembro queda con la cuenta vacía;
//  - miembro: solo sale; los datos del titular no se tocan.
// Si todavía no se sabe la familia (null), el texto de siempre.
export function mensajeEliminarCuenta(familia: Familia | null, borrarDrive: boolean = false): string {
  if (familia?.role === 'member') {
    return (
      'Saldrás de la familia y se borrará tu usuario. ' +
      'Los hijos, documentos y turnos son del titular: no se tocan.\n\n' +
      'Esto no se puede deshacer.'
    );
  }
  const otro = familia?.members.find((m) => m.role === 'member');
  const sobreFamilia =
    familia?.role === 'owner'
      ? otro
        ? `Como sos el titular, tu familia se disuelve: ${otro.email} se queda con la cuenta vacía y ya no verá nada de esto.\n\n`
        : 'Tu familia también se disuelve.\n\n'
      : '';
  return (
    'Se borrarán tus hijos, documentos y turnos guardados en Docukids, y tu usuario. ' +
    'Esto no se puede deshacer.\n\n' +
    sobreFamilia +
    (borrarDrive
      ? 'La carpeta Docukids de tu Google Drive, con todos tus archivos, irá a la papelera de Drive: podrás recuperarla desde ahí durante unos 30 días. '
      : 'Tus archivos en Google Drive NO se borran: seguirán en tu Drive. ') +
    'Los eventos de Google Calendar tampoco. ' +
    'Dejarás de recibir avisos por email.'
  );
}
