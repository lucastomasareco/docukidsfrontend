// Carpetas de la pantalla Docs. Son SOLO VISUALES: viven en este teléfono
// (AsyncStorage) y no tocan el backend ni Drive. Los archivos siguen igual en Drive;
// acá solo se guarda "qué documento se muestra en qué carpeta".
// Si se desinstala la app, las carpetas vuelven a las 3 de base.
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Carpeta = {
  id: string;
  nombre: string;
  fija: boolean; // las 3 de base se pueden renombrar pero no borrar
};

// Valor especial: el documento va suelto, siempre a la vista, fuera de toda carpeta.
export const SUELTO = 'suelto';
// Carpeta a la que va todo documento que no tiene una asignada (los que ya existían).
export const CARPETA_POR_DEFECTO = 'documentos';

const CARPETAS_BASE: Carpeta[] = [
  { id: 'documentos', nombre: 'Documentos', fija: true },
  { id: 'salud', nombre: 'Salud', fija: true },
  { id: 'escuela', nombre: 'Escuela', fija: true },
];

type Datos = {
  carpetas: Carpeta[];
  // id del documento (como texto) -> id de carpeta, o SUELTO
  asignacion: Record<string, string>;
  // id de carpeta (o SUELTO) -> ids de documentos en el orden en que se quieren ver.
  // Los documentos que no figuran (recién subidos) se muestran al final.
  orden: Record<string, number[]>;
};

const DATOS_INICIALES: Datos = { carpetas: CARPETAS_BASE, asignacion: {}, orden: {} };

const claveStorage = (usuarioId: string) => `docukids:carpetas:${usuarioId}`;

// Revisa lo guardado: si está dañado se ignora; si faltan las 3 de base, se vuelven a poner.
function normalizar(crudo: any): Datos | null {
  if (!crudo || !Array.isArray(crudo.carpetas) || typeof crudo.asignacion !== 'object' || !crudo.asignacion) {
    return null;
  }
  const carpetas: Carpeta[] = crudo.carpetas
    .filter((c: any) => c && typeof c.id === 'string' && typeof c.nombre === 'string')
    .map((c: any) => ({ id: c.id, nombre: c.nombre, fija: CARPETAS_BASE.some((b) => b.id === c.id) }));
  const faltantes = CARPETAS_BASE.filter((b) => !carpetas.some((c) => c.id === b.id));
  const orden: Record<string, number[]> = {};
  if (crudo.orden && typeof crudo.orden === 'object') {
    Object.keys(crudo.orden).forEach((k) => {
      if (Array.isArray(crudo.orden[k])) orden[k] = crudo.orden[k].filter((n: any) => typeof n === 'number');
    });
  }
  return { carpetas: [...faltantes, ...carpetas], asignacion: crudo.asignacion, orden };
}

// Copia del orden sin ese documento (para cuando cambia de carpeta).
function sinDocumento(orden: Record<string, number[]>, docId: number): Record<string, number[]> {
  const nuevo: Record<string, number[]> = {};
  Object.keys(orden).forEach((k) => {
    nuevo[k] = orden[k].filter((id) => id !== docId);
  });
  return nuevo;
}

export function useCarpetas(usuarioId: string | null) {
  const [datos, setDatos] = useState<Datos>(DATOS_INICIALES);
  // Para qué usuario ya se leyó lo guardado. Evita guardar datos de un usuario en la clave de otro.
  const [cargadoPara, setCargadoPara] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setDatos(DATOS_INICIALES);
    setCargadoPara(null);
    if (!usuarioId) return;
    AsyncStorage.getItem(claveStorage(usuarioId))
      .then((texto) => {
        if (!vigente) return;
        if (texto) {
          try {
            const leido = normalizar(JSON.parse(texto));
            if (leido) setDatos(leido);
          } catch {
            // Guardado dañado: se empieza de cero.
          }
        }
        setCargadoPara(usuarioId);
      })
      .catch(() => {
        if (vigente) setCargadoPara(usuarioId);
      });
    return () => {
      vigente = false;
    };
  }, [usuarioId]);

  // Cada cambio se guarda solo (sin avisar si falla: es algo solo visual).
  useEffect(() => {
    if (!usuarioId || cargadoPara !== usuarioId) return;
    AsyncStorage.setItem(claveStorage(usuarioId), JSON.stringify(datos)).catch(() => {});
  }, [datos, cargadoPara, usuarioId]);

  // En qué carpeta se muestra un documento (o SUELTO).
  const carpetaDe = useCallback(
    (docId: number): string => {
      const guardada = datos.asignacion[String(docId)];
      if (guardada === SUELTO) return SUELTO;
      if (guardada && datos.carpetas.some((c) => c.id === guardada)) return guardada;
      return CARPETA_POR_DEFECTO;
    },
    [datos]
  );

  // Pasa el documento a otra carpeta; queda al final de ella.
  const moverDocumento = useCallback((docId: number, carpetaId: string) => {
    setDatos((prev) => ({
      ...prev,
      asignacion: { ...prev.asignacion, [String(docId)]: carpetaId },
      orden: sinDocumento(prev.orden, docId),
    }));
  }, []);

  // Arrastre: pasa el documento a la carpeta y fija el orden completo de esa carpeta
  // (idsEnOrden = todos sus documentos, incluido este, en el orden final).
  const colocarDocumento = useCallback((docId: number, carpetaId: string, idsEnOrden: number[]) => {
    setDatos((prev) => ({
      ...prev,
      asignacion: { ...prev.asignacion, [String(docId)]: carpetaId },
      orden: { ...sinDocumento(prev.orden, docId), [carpetaId]: idsEnOrden },
    }));
  }, []);

  // Ordena una lista de documentos según el orden guardado de esa carpeta.
  const ordenar = useCallback(
    <T extends { id: number }>(docs: T[], carpetaId: string): T[] => {
      const guardado = datos.orden[carpetaId] ?? [];
      const posicion = (id: number) => {
        const i = guardado.indexOf(id);
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
      };
      return docs
        .map((d, i) => ({ d, i }))
        .sort((a, b) => posicion(a.d.id) - posicion(b.d.id) || a.i - b.i)
        .map((x) => x.d);
    },
    [datos]
  );

  const crearCarpeta = useCallback((nombre: string) => {
    const id = `c${Date.now()}`;
    setDatos((prev) => ({ ...prev, carpetas: [...prev.carpetas, { id, nombre, fija: false }] }));
    return id;
  }, []);

  const renombrarCarpeta = useCallback((id: string, nombre: string) => {
    setDatos((prev) => ({
      ...prev,
      carpetas: prev.carpetas.map((c) => (c.id === id ? { ...c, nombre } : c)),
    }));
  }, []);

  // Borra la carpeta, NUNCA sus documentos: al quedar sin asignación vuelven a "Documentos".
  const eliminarCarpeta = useCallback((id: string) => {
    setDatos((prev) => {
      const asignacion: Record<string, string> = {};
      Object.keys(prev.asignacion).forEach((doc) => {
        if (prev.asignacion[doc] !== id) asignacion[doc] = prev.asignacion[doc];
      });
      const orden = { ...prev.orden };
      delete orden[id];
      return { carpetas: prev.carpetas.filter((c) => c.id !== id), asignacion, orden };
    });
  }, []);

  // ¿Ya hay una carpeta con ese nombre (sin mirar mayúsculas)? exceptoId = la que se está editando.
  const existeNombre = useCallback(
    (nombre: string, exceptoId?: string) =>
      datos.carpetas.some((c) => c.id !== exceptoId && c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()),
    [datos]
  );

  return {
    carpetas: datos.carpetas,
    carpetaDe,
    moverDocumento,
    colocarDocumento,
    ordenar,
    crearCarpeta,
    renombrarCarpeta,
    eliminarCarpeta,
    existeNombre,
  };
}
