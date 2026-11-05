import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { useChildren } from './ChildrenContext';
import { ErrorAmigable, interpretarError } from '../lib/errores';
import {
  Familia,
  CodigoInvitacion,
  firmaDe,
  leerFamilia,
  crearFamilia as apiCrearFamilia,
  generarInvitacion,
  unirseConCodigo,
  salirDeFamilia,
  quitarMiembro as apiQuitarMiembro,
  disolverFamilia as apiDisolverFamilia,
} from '../lib/familia';

// Igual que en ChildrenContext: si algo falla, la acción devuelve el error
// ORIGINAL (sin traducir) para que la pantalla lo muestre con mostrarError.
type Resultado = { error: unknown | null };

type FamilyContextType = {
  familia: Familia | null; // null = sin familia (o todavía sin cargar)
  cargando: boolean;
  // Error de la última carga manual, ya traducido. Las recargas silenciosas no lo tocan.
  error: ErrorAmigable | null;
  // silencioso: no muestra "cargando" ni guarda el error (para recargar al entrar a una pantalla).
  cargarFamilia: (opciones?: { silencioso?: boolean }) => Promise<void>;
  crearFamilia: () => Promise<Resultado>;
  invitar: () => Promise<Resultado & { codigo?: CodigoInvitacion }>;
  unirse: (codigo: string) => Promise<Resultado>;
  salir: () => Promise<Resultado>;
  quitarMiembro: (usuarioId: string) => Promise<Resultado>;
  disolver: () => Promise<Resultado>;
};

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

// Al volver a la app no se pregunta más seguido que esto (evita pedidos de más).
const MIN_MS_ENTRE_LECTURAS = 5000;

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [familia, setFamilia] = useState<Familia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<ErrorAmigable | null>(null);
  const { session } = useAuth();
  const { cargarHijos } = useChildren();

  // Huella de la pertenencia en la última lectura (undefined = todavía no se leyó).
  const firmaRef = useRef<string | undefined>(undefined);
  // Para ignorar respuestas viejas si la persona cambió de sesión mientras cargaba.
  const peticionRef = useRef(0);
  const ultimaLecturaRef = useRef(0);

  // Lee GET /family. Los hijos se recargan si se pide (recargarHijos) o si la
  // pertenencia cambió desde la lectura anterior (ej.: el titular te quitó).
  // Siempre UNA sola recarga de hijos.
  const leer = useCallback(
    async (opciones: { silencioso?: boolean; recargarHijos?: boolean } = {}) => {
      const { silencioso = false, recargarHijos = false } = opciones;
      const numero = ++peticionRef.current;
      if (!silencioso) {
        setCargando(true);
        setError(null);
      }
      try {
        const lectura = await leerFamilia();
        if (numero !== peticionRef.current) return;
        const firma = firmaDe(lectura);
        const cambio = firmaRef.current !== undefined && firmaRef.current !== firma;
        firmaRef.current = firma;
        ultimaLecturaRef.current = Date.now();
        setFamilia(lectura);
        setError(null); // una lectura buena borra un error anterior
        if (recargarHijos || cambio) await cargarHijos();
      } catch (e) {
        if (numero !== peticionRef.current) return;
        // Una recarga silenciosa que falla no molesta: se queda lo que ya se mostraba.
        if (!silencioso) setError(interpretarError(e, 'cargar tu familia'));
      } finally {
        if (numero === peticionRef.current) setCargando(false);
      }
    },
    [cargarHijos]
  );

  const cargarFamilia = useCallback(
    (opciones?: { silencioso?: boolean }) => leer({ silencioso: opciones?.silencioso }),
    [leer]
  );

  // Con sesión se lee sola; sin sesión no debe quedar nada de la persona anterior.
  // Se usa el id del usuario y no el objeto "session" (Supabase lo renueva seguido).
  const usuarioId = session?.user?.id ?? null;
  useEffect(() => {
    if (usuarioId) {
      firmaRef.current = undefined; // primera lectura de esta sesión: no cuenta como cambio
      leer();
    } else {
      peticionRef.current++;
      firmaRef.current = undefined;
      setFamilia(null);
      setError(null);
      setCargando(false);
    }
  }, [usuarioId, leer]);

  // Sin sondeo automático: se vuelve a leer al volver a la app (en web, al volver a la pestaña).
  useEffect(() => {
    if (!usuarioId) return;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && Date.now() - ultimaLecturaRef.current > MIN_MS_ENTRE_LECTURAS) {
        leer({ silencioso: true });
      }
    });
    return () => sub.remove();
  }, [usuarioId, leer]);

  // --- Acciones. Todas devuelven { error } y, si salió bien, releen la familia. ---

  const crearFamilia = useCallback(async (): Promise<Resultado> => {
    try {
      await apiCrearFamilia();
      await leer({ silencioso: true });
      return { error: null };
    } catch (e) {
      return { error: e ?? new Error('Error desconocido') };
    }
  }, [leer]);

  // Generar el código no cambia quién forma la familia: no se recargan los hijos.
  const invitar = useCallback(async () => {
    try {
      const codigo = await generarInvitacion();
      await leer({ silencioso: true });
      return { error: null, codigo };
    } catch (e) {
      return { error: e ?? new Error('Error desconocido') };
    }
  }, [leer]);

  // Unirse, salir, quitar y disolver cambian lo que ve la persona: hijos otra vez.
  // (Docs y Calendario recargan solos al volver a su pestaña o al cambiar de hijo.)
  const unirse = useCallback(
    async (codigo: string): Promise<Resultado> => {
      try {
        await unirseConCodigo(codigo);
        await leer({ silencioso: true, recargarHijos: true });
        return { error: null };
      } catch (e) {
        return { error: e ?? new Error('Error desconocido') };
      }
    },
    [leer]
  );

  const salir = useCallback(async (): Promise<Resultado> => {
    try {
      await salirDeFamilia();
      await leer({ silencioso: true, recargarHijos: true });
      return { error: null };
    } catch (e) {
      return { error: e ?? new Error('Error desconocido') };
    }
  }, [leer]);

  const quitarMiembro = useCallback(
    async (usuarioIdAQuitar: string): Promise<Resultado> => {
      try {
        await apiQuitarMiembro(usuarioIdAQuitar);
        await leer({ silencioso: true, recargarHijos: true });
        return { error: null };
      } catch (e) {
        return { error: e ?? new Error('Error desconocido') };
      }
    },
    [leer]
  );

  const disolver = useCallback(async (): Promise<Resultado> => {
    try {
      await apiDisolverFamilia();
      await leer({ silencioso: true, recargarHijos: true });
      return { error: null };
    } catch (e) {
      return { error: e ?? new Error('Error desconocido') };
    }
  }, [leer]);

  const value = useMemo(
    () => ({ familia, cargando, error, cargarFamilia, crearFamilia, invitar, unirse, salir, quitarMiembro, disolver }),
    [familia, cargando, error, cargarFamilia, crearFamilia, invitar, unirse, salir, quitarMiembro, disolver]
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) throw new Error('useFamily debe usarse dentro de FamilyProvider');
  return context;
}
