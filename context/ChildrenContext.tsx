import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { api } from '../lib/api';

export type Hijo = {
  id: number;
  name: string;
  birth_date: string | null;
};

type ChildrenContextType = {
  hijos: Hijo[];
  seleccionadoId: number | null;
  cargando: boolean;
  error: string | null;
  seleccionarHijo: (id: number) => void;
  cargarHijos: () => Promise<void>;
  agregarHijo: (nombre: string) => Promise<{ error: string | null }>;
};

const ChildrenContext = createContext<ChildrenContextType | undefined>(undefined);

export function ChildrenProvider({ children }: { children: ReactNode }) {
  const [hijos, setHijos] = useState<Hijo[]>([]);
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (e: any) {
      const detalle = e?.response?.data?.detail || e?.message || 'Error desconocido';
      setError(detalle);
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
      } catch (e: any) {
        const detalle = e?.response?.data?.detail || e?.message || 'Error desconocido';
        return { error: detalle };
      }
    },
    [cargarHijos]
  );

  const seleccionarHijo = useCallback((id: number) => {
    setSeleccionadoId(id);
  }, []);

  return (
    <ChildrenContext.Provider
      value={{ hijos, seleccionadoId, cargando, error, seleccionarHijo, cargarHijos, agregarHijo }}
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