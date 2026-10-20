import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { PANTALLA_POR_RUTA, type PantallaAyuda } from '../lib/ayudas';

// Pantallas cuya guía se abre sola la primera vez.
const ABRE_SOLA: PantallaAyuda[] = ['docs', 'calendario', 'hijos'];

// Guía por pantalla:
// - La PRIMERA vez que la persona entra a Docs, Calendario e Hijos, la guía de esa
//   pantalla se abre sola (una vez por pantalla). Ajustes nunca se abre sola.
// - Cerrarla (con "Cerrar", tocando afuera o con el botón de arriba) solo afecta a
//   ESA pantalla: las otras guías se abren igual la primera vez que se entra.
// - Después solo se abre con el botón "¿Cómo se usa esta pantalla?" de arriba.
// - Al cambiar de pestaña la guía se cierra.
// "Ya vista" se guarda en el dispositivo, por usuario y por pantalla.

type AyudaContextType = {
  // Pantalla actual (null si la ruta no es una pestaña conocida).
  pantalla: PantallaAyuda | null;
  abierta: boolean;
  // Abre si está cerrada y cierra si está abierta.
  alternar: () => void;
};

const AyudaContext = createContext<AyudaContextType | undefined>(undefined);

const clave = (usuarioId: string, pantalla: PantallaAyuda) =>
  `docukids_ayuda_vista_${usuarioId}_${pantalla}`;

export function AyudaProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session } = useAuth();
  const usuarioId = session?.user?.id ?? null;
  const pantalla = PANTALLA_POR_RUTA[pathname] ?? null;

  const [abierta, setAbierta] = useState(false);

  // Para que "alternar" sea estable (no se rearma en cada render) leemos la
  // pantalla desde una referencia.
  const pantallaRef = useRef<PantallaAyuda | null>(pantalla);
  pantallaRef.current = pantalla;
  const abiertaRef = useRef(false);
  abiertaRef.current = abierta;

  useEffect(() => {
    // Al llegar a una pestaña la guía empieza cerrada.
    setAbierta(false);
    if (!pantalla || !usuarioId || !ABRE_SOLA.includes(pantalla)) return;

    let cancelado = false;
    (async () => {
      try {
        const k = clave(usuarioId, pantalla);
        const yaVista = await AsyncStorage.getItem(k);
        if (cancelado || yaVista) return;
        await AsyncStorage.setItem(k, '1');
        if (!cancelado) setAbierta(true);
      } catch {
        // Si el teléfono no deja leer o guardar, mejor no molestar con la guía.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [pantalla, usuarioId]);

  const alternar = useCallback(() => {
    if (!pantallaRef.current) return;
    // Cerrar no toca las demás pantallas: la guía de cada una se abre sola su primera vez.
    setAbierta(!abiertaRef.current);
  }, []);

  const value = useMemo(() => ({ pantalla, abierta, alternar }), [pantalla, abierta, alternar]);

  return <AyudaContext.Provider value={value}>{children}</AyudaContext.Provider>;
}

export function useAyuda() {
  const context = useContext(AyudaContext);
  if (!context) throw new Error('useAyuda debe usarse dentro de AyudaProvider');
  return context;
}
