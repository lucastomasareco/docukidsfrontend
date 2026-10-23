import { api } from './api';

// Conexión con Google para la versión web (navegador) y la app de escritorio (Electron).
// No toca estados de pantalla: devuelve qué pasó y cada pantalla muestra sus avisos.
export type ResultadoGoogleWeb = 'ok' | 'bloqueado' | 'cancelado' | 'tiempo' | 'detenido' | 'externo';

export const estaEnElectron = () =>
  typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);

export async function conectarGoogleEnWeb(opciones: {
  verificar: () => Promise<boolean | null>;
  yaEstabaConectado?: boolean;
  seguir?: () => boolean;
}): Promise<ResultadoGoogleWeb> {
  const { verificar, yaEstabaConectado = false, seguir = () => true } = opciones;
  // En Electron, main.js abre el enlace en el navegador del sistema: no hay pestaña que vigilar.
  const electron = estaEnElectron();
  // La pestaña se abre YA (dentro del clic) para que el navegador no la bloquee.
  const pestana = electron ? null : window.open('', '_blank');
  if (!electron && !pestana) return 'bloqueado';
  try {
    // return_to: el backend solo lo acepta si coincide con WEB_ORIGIN.
    const respuesta = await api.get('/auth/google/url', {
      params: { return_to: `${window.location.origin}/ajustes` },
    });
    if (pestana) {
      pestana.location.href = respuesta.data.url;
    } else {
      window.open(respuesta.data.url, '_blank');
      // Ya figuraba conectado: no podemos notar el cambio, la persona nos avisa volviendo.
      if (yaEstabaConectado) return 'externo';
    }

    const limite = Date.now() + 3 * 60 * 1000; // máximo 3 minutos esperando
    let ok: boolean | null = null;
    let cerrada = false;
    while (seguir() && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 2500));
      cerrada = pestana ? pestana.closed : false;
      ok = await verificar();
      // Si ya estaba conectado, "conectado" no cambia: solo sabemos que terminó al cerrarse la pestaña.
      if ((ok && !yaEstabaConectado) || cerrada) break;
    }
    if (!seguir()) return 'detenido'; // salió de la pantalla
    try { pestana?.close(); } catch {}
    if (ok) return 'ok';
    return cerrada ? 'cancelado' : 'tiempo';
  } catch (e) {
    try { pestana?.close(); } catch {}
    throw e;
  }
}