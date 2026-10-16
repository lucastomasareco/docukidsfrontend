// Carpetas de la pantalla Docs. Viven en el BACKEND (tabla folders) y también se crean
// como subcarpetas de "Docukids" en el Drive de la persona (estructura A: Docukids / Salud / archivo).
// En el teléfono solo queda guardado el ORDEN de arrastre (a Drive no le importa el orden).
// Cada documento trae su folder_id: null = suelto, en la raíz "Docukids" (se ve en "A la vista").
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { ErrorAmigable, interpretarError } from './errores';

export type Carpeta = {
  id: string; // el id numérico del backend, como texto
  nombre: string;
  fija: boolean; // las 3 de base (is_base) se pueden renombrar pero no borrar
};

// Valor especial: el documento va suelto (folder_id = null), siempre a la vista.
export const SUELTO = 'suelto';

type CarpetaApi = { id: number; name: string; is_base: boolean };

const aCarpeta = (c: CarpetaApi): Carpeta => ({ id: String(c.id), nombre: c.name, fija: c.is_base });

// id de carpeta (o SUELTO) -> ids de documentos en el orden en que se quieren ver.
// Los documentos que no figuran (recién subidos) se muestran al final.
type Orden = Record<string, number[]>;

const claveOrden = (usuarioId: string) => `docukids:orden:${usuarioId}`;
// Clave de la versión anterior (carpetas solo en el teléfono). Se descarta: no se migra.
const claveVieja = (usuarioId: string) => `docukids:carpetas:${usuarioId}`;

function normalizarOrden(crudo: any): Orden {
  const orden: Orden = {};
  if (crudo && typeof crudo === 'object') {
    Object.keys(crudo).forEach((k) => {
      if (Array.isArray(crudo[k])) orden[k] = crudo[k].filter((n: any) => typeof n === 'number');
    });
  }
  return orden;
}

// Copia del orden sin ese documento (para cuando cambia de carpeta).
function sinDocumento(orden: Orden, docId: number): Orden {
  const nuevo: Orden = {};
  Object.keys(orden).forEach((k) => {
    nuevo[k] = orden[k].filter((id) => id !== docId);
  });
  return nuevo;
}

export function useCarpetas(usuarioId: string | null) {
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [cargando, setCargando] = useState<boolean>(!!usuarioId);
  const [error, setError] = useState<ErrorAmigable | null>(null);
  const [orden, setOrden] = useState<Orden>({});
  // Para qué usuario ya se leyó el orden guardado (evita guardar datos de uno en la clave de otro).
  const [ordenCargadoPara, setOrdenCargadoPara] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!usuarioId) return;
    setCargando(true);
    setError(null);
    try {
      const respuesta = await api.get('/folders');
      setCarpetas((respuesta.data.folders as CarpetaApi[]).map(aCarpeta));
    } catch (e) {
      setError(interpretarError(e, 'cargar las carpetas'));
    } finally {
      setCargando(false);
    }
  }, [usuarioId]);

  // Carpetas: se piden al backend al haber sesión (y de nuevo si cambia la persona).
  useEffect(() => {
    setCarpetas([]);
    setError(null);
    if (!usuarioId) {
      setCargando(false);
      return;
    }
    recargar();
  }, [usuarioId, recargar]);

  // Orden: se lee de lo guardado en el teléfono.
  useEffect(() => {
    let vigente = true;
    setOrden({});
    setOrdenCargadoPara(null);
    if (!usuarioId) return;
    AsyncStorage.removeItem(claveVieja(usuarioId)).catch(() => {});
    AsyncStorage.getItem(claveOrden(usuarioId))
      .then((texto) => {
        if (!vigente) return;
        if (texto) {
          try {
            setOrden(normalizarOrden(JSON.parse(texto)));
          } catch {
            // Guardado dañado: se empieza de cero.
          }
        }
        setOrdenCargadoPara(usuarioId);
      })
      .catch(() => {
        if (vigente) setOrdenCargadoPara(usuarioId);
      });
    return () => {
      vigente = false;
    };
  }, [usuarioId]);

  // Cada cambio de orden se guarda solo (sin avisar si falla: es algo solo visual).
  useEffect(() => {
    if (!usuarioId || ordenCargadoPara !== usuarioId) return;
    AsyncStorage.setItem(claveOrden(usuarioId), JSON.stringify(orden)).catch(() => {});
  }, [orden, ordenCargadoPara, usuarioId]);

  // En qué carpeta se muestra un documento (según su folder_id). Si la carpeta no está
  // en la lista, queda suelto: así nunca desaparece un documento.
  const carpetaDe = useCallback(
    (folderId: number | null): string => {
      if (folderId === null || folderId === undefined) return SUELTO;
      const id = String(folderId);
      return carpetas.some((c) => c.id === id) ? id : SUELTO;
    },
    [carpetas]
  );

  // Carpeta que se propone al subir: la primera de base ("Documentos"), o suelto si aún no hay.
  const carpetaPorDefecto = carpetas.find((c) => c.fija)?.id ?? SUELTO;

  // El documento cambió de carpeta: se olvida su lugar viejo y queda al final de la nueva.
  const olvidarOrden = useCallback((docId: number) => {
    setOrden((prev) => sinDocumento(prev, docId));
  }, []);

  // Arrastre: fija el orden completo de esa carpeta (idsEnOrden = todos sus documentos,
  // incluido este, en el orden final). El cambio de carpeta en el servidor lo hace la pantalla.
  const colocarOrden = useCallback((docId: number, carpetaId: string, idsEnOrden: number[]) => {
    setOrden((prev) => ({ ...sinDocumento(prev, docId), [carpetaId]: idsEnOrden }));
  }, []);

  // Ordena una lista de documentos según el orden guardado de esa carpeta.
  const ordenar = useCallback(
    <T extends { id: number }>(docs: T[], carpetaId: string): T[] => {
      const guardado = orden[carpetaId] ?? [];
      const posicion = (id: number) => {
        const i = guardado.indexOf(id);
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
      };
      return docs
        .map((d, i) => ({ d, i }))
        .sort((a, b) => posicion(a.d.id) - posicion(b.d.id) || a.i - b.i)
        .map((x) => x.d);
    },
    [orden]
  );

  // Crear, renombrar y borrar esperan al servidor (que también toca Drive).
  // Si algo falla lanzan el error: la pantalla lo muestra con useAvisos().
  const crearCarpeta = useCallback(async (nombre: string): Promise<Carpeta> => {
    const respuesta = await api.post('/folders', { name: nombre });
    const nueva = aCarpeta(respuesta.data.folder);
    setCarpetas((prev) => [...prev, nueva]);
    return nueva;
  }, []);

  const renombrarCarpeta = useCallback(async (id: string, nombre: string): Promise<void> => {
    const respuesta = await api.patch(`/folders/${id}`, { name: nombre });
    const actualizada = aCarpeta(respuesta.data.folder);
    setCarpetas((prev) => prev.map((c) => (c.id === id ? actualizada : c)));
  }, []);

  // Borra la carpeta, NUNCA sus documentos: el backend los pasa a la raíz "Docukids" (folder_id = null).
  const eliminarCarpeta = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/folders/${id}`);
    setCarpetas((prev) => prev.filter((c) => c.id !== id));
    setOrden((prev) => {
      const nuevo = { ...prev };
      delete nuevo[id];
      return nuevo;
    });
  }, []);

  // ¿Ya hay una carpeta con ese nombre (sin mirar mayúsculas)? exceptoId = la que se está editando.
  // El backend lo vuelve a controlar (409) como segunda barrera.
  const existeNombre = useCallback(
    (nombre: string, exceptoId?: string) =>
      carpetas.some((c) => c.id !== exceptoId && c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()),
    [carpetas]
  );

  return {
    carpetas,
    cargando,
    error,
    recargar,
    carpetaDe,
    carpetaPorDefecto,
    olvidarOrden,
    colocarOrden,
    ordenar,
    crearCarpeta,
    renombrarCarpeta,
    eliminarCarpeta,
    existeNombre,
  };
}
