import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { PANTALLA_POR_RUTA, type PantallaAyuda } from '../lib/ayudas';

// Guía por pantalla (versión de escritorio):
// - NUNCA se abre sola: solo cuando la persona toca el botón "¿Cómo se usa?".
// - El mismo botón (o "Cerrar" / tocar fuera de la ventana) la cierra.
// - Al cambiar de pestaña la guía se cierra.

type AyudaContextType = {
  // Pantalla actual (null si la ruta no es una pestaña conocida).
  pantalla: PantallaAyuda | null;
  abierta: boolean;
  // Abre si está cerrada y cierra si está abierta.
  alternar: () => void;
};

const AyudaContext = createContext<AyudaContextType | undefined>(undefined);

export function AyudaProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pantalla = PANTALLA_POR_RUTA[pathname] ?? null;
  const [abierta, setAbierta] = useState(false);

  // Al llegar a una pestaña la guía empieza cerrada.
  useEffect(() => {
    setAbierta(false);
  }, [pantalla]);

  const alternar = useCallback(() => {
    if (!pantalla) return;
    setAbierta((actual) => !actual);
  }, [pantalla]);

  const value = useMemo(() => ({ pantalla, abierta, alternar }), [pantalla, abierta, alternar]);

  return <AyudaContext.Provider value={value}>{children}</AyudaContext.Provider>;
}

export function useAyuda() {
  const context = useContext(AyudaContext);
  if (!context) throw new Error('useAyuda debe usarse dentro de AyudaProvider');
  return context;
}
