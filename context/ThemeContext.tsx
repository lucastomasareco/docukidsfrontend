import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TEMAS, Tema, TemaId, TEMA_POR_DEFECTO } from './themes';

type ThemeContextType = {
  temaId: TemaId;
  tema: Tema;
  cambiarTema: (id: TemaId) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const CLAVE_STORAGE = 'docukids_tema';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [temaId, setTemaId] = useState<TemaId>(TEMA_POR_DEFECTO);

  // Al abrir la app, lee el tema guardado la última vez (si hay).
  useEffect(() => {
    AsyncStorage.getItem(CLAVE_STORAGE).then((guardado) => {
      if (guardado && guardado in TEMAS) {
        setTemaId(guardado as TemaId);
      }
    });
  }, []);

  const cambiarTema = (id: TemaId) => {
    setTemaId(id);
    AsyncStorage.setItem(CLAVE_STORAGE, id);
  };

  return (
    <ThemeContext.Provider value={{ temaId, tema: TEMAS[temaId], cambiarTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return context;
}
