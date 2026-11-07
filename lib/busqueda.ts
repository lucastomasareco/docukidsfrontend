// Buscador de la pantalla Docs. Busca por nombre de documento Y por nombre de carpeta, en el
// hijo que se está viendo. No distingue mayúsculas ni tildes: "DNI", "Dni" y "dni" dan lo mismo.
//
// Cómo se interpreta lo que se escribe (cada palabra es una "condición"):
//   - una palabra cumple si está en el nombre del documento (en cualquier parte) o si es el
//     comienzo de una palabra del nombre de su carpeta ("salud", "doc" -> "Documentos").
//   - el documento aparece si cumple TODAS las palabras: "salud cartilla" = la cartilla de Salud;
//     "documentos dni" = el DNI dentro de la carpeta Documentos.
//   - si no hay resultados, se ignoran las palabras que no existen en ningún documento ni carpeta
//     (ej. "documento dni" cuando no hay carpeta "Documento") y se busca con las demás.
//   - una carpeta también aparece sola (aunque esté vacía) si su nombre cumple todas las palabras.
import { SUELTO } from './carpetas';

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const palabrasDe = (texto: string) => normalizar(texto).split(/\s+/).filter(Boolean);

export type ResultadoBusqueda = {
  activa: boolean; // hay algo escrito
  docs: Set<number>; // ids de documentos que coinciden
  carpetas: Set<string>; // ids de carpetas que se muestran (por nombre o por tener coincidencias)
  sueltos: boolean; // hay coincidencias fuera de las carpetas ("A la vista")
};

type DocBusqueda = { id: number; name: string; folder_id: number | null };
type CarpetaBusqueda = { id: string; nombre: string };

export function buscarDocumentos(
  texto: string,
  documentos: DocBusqueda[],
  carpetas: CarpetaBusqueda[],
  carpetaDe: (folderId: number | null) => string
): ResultadoBusqueda {
  const palabras = palabrasDe(texto);
  if (palabras.length === 0) return { activa: false, docs: new Set(), carpetas: new Set(), sueltos: false };

  const nombres = new Map(documentos.map((d) => [d.id, normalizar(d.name)]));
  const palabrasCarpeta = new Map(carpetas.map((c) => [c.id, palabrasDe(c.nombre)]));

  const enNombre = (p: string, d: DocBusqueda) => (nombres.get(d.id) ?? '').includes(p);
  const enCarpeta = (p: string, carpetaId: string) => (palabrasCarpeta.get(carpetaId) ?? []).some((w) => w.startsWith(p));
  const cumple = (p: string, d: DocBusqueda) => enNombre(p, d) || enCarpeta(p, carpetaDe(d.folder_id));
  const existeEnAlgunLado = (p: string) => documentos.some((d) => cumple(p, d)) || carpetas.some((c) => enCarpeta(p, c.id));

  const calcular = (ps: string[]): ResultadoBusqueda => {
    const docs = new Set<number>();
    const idsCarpetas = new Set<string>();
    let sueltos = false;
    documentos.forEach((d) => {
      if (!ps.every((p) => cumple(p, d))) return;
      docs.add(d.id);
      const c = carpetaDe(d.folder_id);
      if (c === SUELTO) sueltos = true;
      else idsCarpetas.add(c);
    });
    carpetas.forEach((c) => {
      if (ps.every((p) => enCarpeta(p, c.id))) idsCarpetas.add(c.id);
    });
    return { activa: true, docs, carpetas: idsCarpetas, sueltos };
  };

  let r = calcular(palabras);
  if (r.docs.size === 0 && r.carpetas.size === 0) {
    const utiles = palabras.filter(existeEnAlgunLado);
    if (utiles.length > 0 && utiles.length < palabras.length) r = calcular(utiles);
  }
  return r;
}

export const hayResultados = (r: ResultadoBusqueda) => r.docs.size > 0 || r.carpetas.size > 0;
