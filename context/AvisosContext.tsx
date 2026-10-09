import { createContext, useContext } from 'react';
import type { NombreIcono } from '../components/AvisoError';
import type { ErrorAmigable } from '../lib/errores';

export type OpcionesConfirmar = {
  titulo: string;
  mensaje?: string;
  textoConfirmar?: string; // por defecto "Aceptar"
  textoCancelar?: string; // por defecto "Cancelar"
  // true para acciones que no se pueden deshacer (borrar): el botón de confirmar
  // sale en rojo y el de cancelar queda arriba, como opción segura.
  peligro?: boolean;
  icono?: NombreIcono;
};

export type OpcionesAviso = {
  icono?: NombreIcono;
  etiquetaAccion?: string;
  onAccion?: () => void;
  duracion?: number; // milisegundos; por defecto 5 s (8 s si tiene botón)
};

export type AvisosContextType = {
  // Traduce el error y muestra el aviso que baja desde arriba.
  //   que:         lo que se intentaba, ej. "subir el documento".
  //   onReintentar: si se pasa, el aviso ofrece "Reintentar" cuando corresponde.
  mostrarError: (e: unknown, opciones?: { que?: string; onReintentar?: () => void }) => ErrorAmigable;
  // Aviso corto que no es un error (ej. "Falta el nombre").
  mostrarAviso: (titulo: string, mensaje: string, opciones?: OpcionesAviso) => void;
  // Reemplaza a Alert.alert con botones. Devuelve true si la persona confirmó.
  confirmar: (opciones: OpcionesConfirmar) => Promise<boolean>;
  // Ejecuta el botón de un error (reintentar / ir a Ajustes / volver a iniciar sesión).
  ejecutarAccion: (error: ErrorAmigable, onReintentar?: () => void) => void;
};

export const AvisosContext = createContext<AvisosContextType | undefined>(undefined);

export function useAvisos() {
  const context = useContext(AvisosContext);
  if (!context) throw new Error('useAvisos debe usarse dentro de AvisosProvider');
  return context;
}
