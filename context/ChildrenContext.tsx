import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';
import { ErrorAmigable, interpretarError } from '../lib/errores';

export type Hijo = {
  id: number;
  name: string;
  birth_date: string | null;
};

type ChildrenContextType = {
  hijos: Hijo[];
  seleccionadoId: number | null;
  cargando: boolean;
  // Error de la última carga, ya traducido a un mensaje para personas.
  error: ErrorAmigable | null;
  seleccionarHijo: (id: number) => void;
  cargarHijos: () => Promise<void>;
  // Si falla, devuelve el error original (sin traducir) para que la pantalla lo muestre.
  agregarHijo: (nombre: string) => Promise<{ error: unknown | null }>;
  editarHijo: (id: number, nombre: string) => Promise<{ error: unknown | null }>;
  eliminarHijo: (id: number) => Promise<{ error: unknown | null }>;
};

const ChildrenContext = createContext<ChildrenContextType | undefined>(undefined);

export function ChildrenProvider({ children }: { children: ReactNode }) {
  const [hijos, setHijos] = useState<Hijo[]>([]);
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<ErrorAmigable | null>(null);
  const { session } = useAuth();

  // Sin sesión (cerrar sesión o cuenta eliminada) no debe quedar nada de la
  // persona anterior en memoria.
  useEffect(() => {
    if (!session) {
      setHijos([]);
      setSeleccionadoId(null);
      setError(null);
    }
  }, [session]);

  const cargarHijos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await api.get('/children');
      const lista: Hijo[] = respuesta.data.children;
      setHijos(lista);
      // Si el seleccionado ya no existe (o no había ninguno), elegimos el primero.
      setSeleccionadoId((actual) => {
        if (actual !== null && lista.some((h) => h.id === actual)) return actual;
        return lista.length > 0 ? lista[0].id : null;
      });
    } catch (e) {
      setError(interpretarError(e, 'cargar a tus hijos'));
    } finally {
      setCargando(false);
    }
  }, []);

  const agregarHijo = useCallback(
    async (nombre: string) => {
      try {
        await api.post('/children', { name: nombre });
        await cargarHijos();
        return { error: null };
      } catch (e) {
        return { error: e ?? new Error('Error desconocido') };
      }
    },
    [cargarHijos]
  );

  const editarHijo = useCallback(
    async (id: number, nombre: string) => {
      try {
        await api.put(`/children/${id}`, { name: nombre });
        await cargarHijos();
        return { error: null };
      } catch (e) {
        return { error: e ?? new Error('Error desconocido') };
      }
    },
    [cargarHijos]
  );

  const eliminarHijo = useCallback(
    async (id: number) => {
      try {
        await api.delete(`/children/${id}`);
        await cargarHijos();
        return { error: null };
      } catch (e) {
        return { error: e ?? new Error('Error desconocido') };
      }
    },
    [cargarHijos]
  );

  const seleccionarHijo = useCallback((id: number) => {
    setSeleccionadoId(id);
  }, []);

  return (
    <ChildrenContext.Provider
      value={{
        hijos,
        seleccionadoId,
        cargando,
        error,
        seleccionarHijo,
        cargarHijos,
        agregarHijo,
        editarHijo,
        eliminarHijo,
      }}
    >
      {children}
    </ChildrenContext.Provider>
  );
}

export function useChildren() {
  const context = useContext(ChildrenContext);
  if (!context) throw new Error('useChildren debe usarse dentro de ChildrenProvider');
  return context;
}