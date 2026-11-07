// Papelera de documentos (v3.0).
// Al borrar un documento, su archivo va a la papelera de Drive (30 días). El backend los lista en
// GET /trash/documents y los restaura con POST /trash/documents/{id}/restore.
import { api } from './api';

export type DocumentoBorrado = {
  drive_file_id: string;
  name: string;
  type: string | null;
  child_id: number;
  child_name: string;
  folder_id: number | null;
  expiry_date: string | null;
  no_expiry: boolean;
  mime_type: string | null;
  days_left: number; // días que le quedan en la papelera de Drive (máx. 30)
};

export async function listarPapelera(): Promise<DocumentoBorrado[]> {
  const respuesta = await api.get('/trash/documents');
  const lista = respuesta.data?.documents;
  return Array.isArray(lista) ? lista : [];
}

export async function restaurarDocumento(driveFileId: string): Promise<void> {
  await api.post(`/trash/documents/${encodeURIComponent(driveFileId)}/restore`);
}

export function textoDias(dias: number): string {
  if (dias <= 1) return 'Último día para restaurarlo';
  return `Te quedan ${dias} días para restaurarlo`;
}
