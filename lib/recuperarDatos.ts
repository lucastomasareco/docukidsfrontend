// Recuperar datos tras volver a registrarse (v2.8).
// Si la persona eliminó su cuenta conservando Drive, sus carpetas siguen en su Drive.
// El backend las encuentra (GET /drive/recover/preview) y las vincula a hijos NUEVOS
// (POST /drive/recover) en vez de crear carpetas paralelas.
import { api } from './api';
import { migrarDriveEnSegundoPlano } from './migrarDrive';

export type CarpetaRecuperable = {
  drive_folder_id: string;
  name: string;
  old_child_id: number;
  documents: number;
  folders: string[];
};

export type ResultadoRecuperar = {
  hijos: number;
  documentos: number;
  omitidas: number;
};

// El backend acepta hasta 20 carpetas por pedido.
const MAX_POR_PEDIDO = 20;

// Busca carpetas recuperables. SILENCIOSA: si Google no está conectado, no hay internet o
// el servidor está despertando, simplemente no hay nada que ofrecer (devuelve []).
export async function buscarCarpetasRecuperables(): Promise<CarpetaRecuperable[]> {
  try {
    const respuesta = await api.get('/drive/recover/preview');
    const lista = respuesta.data?.candidates;
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

// Recupera las carpetas elegidas. Si el servidor falla, el error se propaga (la pantalla lo
// muestra) y lo ya recuperado queda guardado: se puede reintentar sin duplicar.
// Al final ordena los archivos (renombra con los IDs nuevos) llamando a /drive/migrate.
export async function recuperarCarpetas(ids: string[]): Promise<ResultadoRecuperar> {
  const total: ResultadoRecuperar = { hijos: 0, documentos: 0, omitidas: 0 };
  const sinRepetir = Array.from(new Set(ids));
  for (let i = 0; i < sinRepetir.length; i += MAX_POR_PEDIDO) {
    const respuesta = await api.post('/drive/recover', {
      folders: sinRepetir.slice(i, i + MAX_POR_PEDIDO),
    });
    total.hijos += respuesta.data?.recovered?.length ?? 0;
    total.documentos += Number(respuesta.data?.documents ?? 0);
    total.omitidas += Number(respuesta.data?.skipped ?? 0);
  }
  // Silenciosa: si falla, se completa la próxima vez que se entre a la app.
  await migrarDriveEnSegundoPlano();
  return total;
}

// "1 documento" / "3 documentos".
export function textoDocumentos(n: number): string {
  return `${n} ${n === 1 ? 'documento' : 'documentos'}`;
}
