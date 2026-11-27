import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';
import { ErrorAmigable, interpretarError } from '../lib/errores';

export type Hijo = {
  id: number;
  name: string;
  birth_date: string | null;
  // Foto de perfil (issue #36): imagen chica en formato "data:image/jpeg;base64,...".
  avatar_url?: string | null;
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
  agregarHijo: (nombre: string, avatarUrl?: string | null) => Promise<{ error: unknown | null }>;
  // avatarUrl: texto = foto nueva · null = quitar la foto · sin pasarlo = dejar la que estaba.
  editarHijo: (id: number, nombre: string, avatarUrl?: string | null) => Promise<{ error: unknown | null }>;
  eliminarHijo: (id: number) => Promise<{ error: unknown | null }>;
  // Orden elegido arrastrando: lista completa de ids en el orden final.
  colocarOrdenHijos: (ids: number[]) => void;
  // Candado del arrastre (se recuerda en este dispositivo / navegador).
  arrastreBloqueado: boolean;
  alternarBloqueoArrastre: () => void;
};

// Orden de los hijos: SIEMPRE estable. Base = orden de creación (id); encima, el orden que la
// persona armó arrastrando. Los hijos nuevos (sin posición guardada) van al final.
// Antes el orden lo decidía el servidor, que devuelve la fila editada al final de la lista.
function ordenarHijos(lista: Hijo[], orden: number[]): Hijo[] {
  const base = [...lista].sort((a, b) => a.id - b.id);
  const posicion = new Map<number, number>(orden.map((id, i) => [id, i]));
  const conOrden = base.filter((h) => posicion.has(h.id)).sort((a, b) => posicion.get(a.id)! - posicion.get(b.id)!);
  const nuevos = base.filter((h) => !posicion.has(h.id));
  return [...conOrden, ...nuevos];
}

// Solo se guardan en el dispositivo (igual que el orden de los documentos): no hay llamadas al servidor.
const claveOrdenHijos = (usuarioId: string) => `docukids:ordenHijos:${usuarioId}`;
const claveBloqueoHijos = (usuarioId: string) => `docukids:ordenHijosBloqueado:${usuarioId}`;

const ChildrenContext = createContext<ChildrenContextType | undefined>(undefined);

export function ChildrenProvider({ children }: { children: ReactNode }) {
  const [hijosCrudos, setHijosCrudos] = useState<Hijo[]>([]);
  const [orden, setOrden] = useState<number[]>([]);
  const [arrastreBloqueado, setArrastreBloqueado] = useState(false);
  // Para qué usuario ya se leyó lo guardado (evita pisar los datos de uno con los de otro).
  const [ordenCargadoPara, setOrdenCargadoPara] = useState<string | null>(null);
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<ErrorAmigable | null>(null);
  const { session } = useAuth();

  const cargarHijos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await api.get('/children');
      const lista: Hijo[] = respuesta.data.children;
      setHijosCrudos(lista);
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

  // Con sesión, los hijos se cargan solos (así Docs y Calendario no dependen de
  // que alguien visite antes la pestaña Hijos). Sin sesión (cerrar sesión o cuenta
  // eliminada) no debe quedar nada de la persona anterior en memoria.
  // Se usa el id del usuario y no el objeto "session": Supabase renueva ese objeto
  // cada tanto y recargaríamos sin necesidad.
  const usuarioId = session?.user?.id ?? null;
  useEffect(() => {
    if (usuarioId) {
      cargarHijos();
    } else {
      setHijosCrudos([]);
      setSeleccionadoId(null);
      setError(null);
    }
  }, [usuarioId, cargarHijos]);

  const hijos = useMemo(() => ordenarHijos(hijosCrudos, orden), [hijosCrudos, orden]);

  // Lee el orden y el candado guardados en el dispositivo.
  useEffect(() => {
    setOrden([]);
    setArrastreBloqueado(false);
    setOrdenCargadoPara(null);
    if (!usuarioId) return;
    let vigente = true;
    Promise.all([
      AsyncStorage.getItem(claveOrdenHijos(usuarioId)),
      AsyncStorage.getItem(claveBloqueoHijos(usuarioId)),
    ])
      .then(([textoOrden, textoBloqueo]) => {
        if (!vigente) return;
        try {
          const crudo = textoOrden ? JSON.parse(textoOrden) : [];
          if (Array.isArray(crudo)) setOrden(crudo.filter((n: unknown) => typeof n === 'number'));
        } catch {}
        setArrastreBloqueado(textoBloqueo === '1');
        setOrdenCargadoPara(usuarioId);
      })
      .catch(() => {
        if (vigente) setOrdenCargadoPara(usuarioId);
      });
    return () => {
      vigente = false;
    };
  }, [usuarioId]);

  // Cada cambio se guarda solo (sin avisar si falla: es algo solo visual).
  useEffect(() => {
    if (!usuarioId || ordenCargadoPara !== usuarioId) return;
    AsyncStorage.setItem(claveOrdenHijos(usuarioId), JSON.stringify(orden)).catch(() => {});
  }, [orden, ordenCargadoPara, usuarioId]);
  useEffect(() => {
    if (!usuarioId || ordenCargadoPara !== usuarioId) return;
    AsyncStorage.setItem(claveBloqueoHijos(usuarioId), arrastreBloqueado ? '1' : '0').catch(() => {});
  }, [arrastreBloqueado, ordenCargadoPara, usuarioId]);

  const colocarOrdenHijos = useCallback((ids: number[]) => setOrden(ids), []);
  const alternarBloqueoArrastre = useCallback(() => setArrastreBloqueado((b) => !b), []);

  const agregarHijo = useCallback(
    async (nombre: string, avatarUrl?: string | null) => {
      try {
        // La foto viaja en el MISMO pedido que crea al hijo: no hay llamadas extra.
        await api.post('/children', avatarUrl ? { name: nombre, avatar_url: avatarUrl } : { name: nombre });
        await cargarHijos();
        return { error: null };
      } catch (e) {
        return { error: e ?? new Error('Error desconocido') };
      }
    },
    [cargarHijos]
  );

  const editarHijo = useCallback(
    async (id: number, nombre: string, avatarUrl?: string | null) => {
      try {
        // Solo se manda avatar_url si cambió: así editar el nombre no toca la foto.
        await api.put(`/children/${id}`, avatarUrl === undefined ? { name: nombre } : { name: nombre, avatar_url: avatarUrl });
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
        colocarOrdenHijos,
        arrastreBloqueado,
        alternarBloqueoArrastre,
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