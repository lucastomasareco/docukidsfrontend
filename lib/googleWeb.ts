import { api } from './api';

// Conexión con Google para la versión web (navegador).
// No hay "app a la que volver": abrimos Google en una pestaña nueva, preguntamos
// al backend cada pocos segundos si ya quedó conectado y, cuando es así, cerramos la pestaña.
// La pestaña se abre YA (dentro del clic) para que el navegador no la bloquee.
export type ResultadoGoogleWeb = 'ok' | 'bloqueado' | 'cancelado' | 'tiempo';

export async function conectarGoogleEnWeb(
  verificar: () => Promise<boolean | null>,
  seguir: () => boolean = () => true
): Promise<ResultadoGoogleWeb> {
  const pestana = window.open('', '_blank');
  if (!pestana) return 'bloqueado';
  try {
    // return_to: el backend solo acepta la dirección exacta de la web (variable WEB_ORIGIN).
    const respuesta = await api.get('/auth/google/url', {
      params: { return_to: `${window.location.origin}/ajustes` },
    });
    pestana.location.href = respuesta.data.url;

    const limite = Date.now() + 3 * 60 * 1000; // máximo 3 minutos esperando
    while (seguir() && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 2500));
      const cerrada = pestana.closed;
      const ok = await verificar();
      if (ok) {
        try { pestana.close(); } catch {}
        return 'ok';
      }
      if (cerrada) return 'cancelado';
    }
    try { pestana.close(); } catch {}
    return 'tiempo';
  } catch (e) {
    try { pestana.close(); } catch {}
    throw e;
  }
}
