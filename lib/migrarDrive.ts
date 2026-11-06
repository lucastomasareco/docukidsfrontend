// Migración de documentos viejos a la carpeta de su hijo en Drive (Guía §13, regla 7).
// El backend (POST /drive/migrate) procesa de a 10 documentos por llamada y responde
// cuántos faltan. Aquí se repite la llamada hasta que no falte ninguno.
// Es SILENCIOSA: si algo falla (Google sin conectar, sin internet, etc.) no muestra
// ningún error al usuario; simplemente lo vuelve a intentar la próxima vez que entre.
import { api } from './api';

// Tope de seguridad: 30 tandas x 10 documentos = 300 documentos por entrada.
// Evita un bucle infinito si el servidor respondiera algo raro.
const MAX_TANDAS = 30;

// Para que no corran dos migraciones a la vez (por ejemplo, si la pantalla se recarga).
let enCurso = false;

export async function migrarDriveEnSegundoPlano(): Promise<void> {
  if (enCurso) return;
  enCurso = true;
  try {
    for (let i = 0; i < MAX_TANDAS; i++) {
      const respuesta = await api.post('/drive/migrate');
      const restantes = Number(respuesta.data?.remaining ?? 0);
      if (restantes <= 0) break; // ya no queda nada por migrar
    }
  } catch {
    // Silencioso a propósito. Lo ya migrado queda marcado en el servidor y la
    // próxima vez se sigue desde donde quedó.
  } finally {
    enCurso = false;
  }
}
