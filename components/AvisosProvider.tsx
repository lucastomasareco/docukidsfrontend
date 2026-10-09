import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { AvisosContext, AvisosContextType, OpcionesConfirmar } from '../context/AvisosContext';
import { ErrorAmigable, interpretarError } from '../lib/errores';
import { Aviso, AvisoFlotante, ICONO_POR_TIPO, tieneBoton } from './AvisoError';
import VentanaConfirmar from './VentanaConfirmar';

// Va en app/_layout.tsx, DENTRO de AuthProvider y ThemeProvider.
// Dibuja por encima de todas las pantallas:
//   - el aviso que baja desde arriba (errores de acciones y avisos cortos)
//   - la ventana de confirmación
export default function AvisosProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { cerrarSesion } = useAuth();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [confirmacion, setConfirmacion] = useState<OpcionesConfirmar | null>(null);
  const resolverConfirmacion = useRef<((valor: boolean) => void) | null>(null);
  const contador = useRef(0);

  // router y cerrarSesion cambian de identidad en cada render. Los guardamos en
  // una referencia para que las funciones de abajo sean SIEMPRE las mismas:
  // si no, cualquier pantalla que las use dentro de un useCallback se
  // recargaría sola una y otra vez.
  const vivo = useRef({ router, cerrarSesion });
  vivo.current = { router, cerrarSesion };

  const ejecutarAccion = useCallback((error: ErrorAmigable, onReintentar?: () => void) => {
    if (error.accion === 'reintentar') onReintentar?.();
    else if (error.accion === 'ajustes') vivo.current.router.navigate('/(tabs)/ajustes');
    else if (error.accion === 'login') vivo.current.cerrarSesion();
  }, []);

  const mostrarError = useCallback<AvisosContextType['mostrarError']>(
    (e, opciones = {}) => {
      const error = interpretarError(e, opciones.que);
      const conBoton = tieneBoton(error, Boolean(opciones.onReintentar));
      setAviso({
        id: ++contador.current,
        titulo: error.titulo,
        mensaje: error.mensaje,
        icono: ICONO_POR_TIPO[error.tipo],
        etiquetaAccion: conBoton ? error.etiquetaAccion : null,
        onAccion: conBoton ? () => ejecutarAccion(error, opciones.onReintentar) : undefined,
      });
      return error;
    },
    [ejecutarAccion]
  );

  const mostrarAviso = useCallback<AvisosContextType['mostrarAviso']>((titulo, mensaje, opciones = {}) => {
    setAviso({
      id: ++contador.current,
      titulo,
      mensaje,
      icono: opciones.icono ?? 'information-circle-outline',
      etiquetaAccion: opciones.etiquetaAccion ?? null,
      onAccion: opciones.onAccion,
      duracion: opciones.duracion,
    });
  }, []);

  const confirmar = useCallback<AvisosContextType['confirmar']>((opciones) => {
    return new Promise<boolean>((resolve) => {
      // Si ya había una pregunta abierta, se da por cancelada.
      resolverConfirmacion.current?.(false);
      resolverConfirmacion.current = resolve;
      setConfirmacion(opciones);
    });
  }, []);

  const responder = useCallback((valor: boolean) => {
    resolverConfirmacion.current?.(valor);
    resolverConfirmacion.current = null;
    setConfirmacion(null);
  }, []);

  // Solo cierra si el aviso que se va es el que sigue en pantalla (si ya llegó
  // uno nuevo, no lo borra).
  const cerrarAviso = useCallback((id: number) => setAviso((actual) => (actual?.id === id ? null : actual)), []);

  // Valor estable: no cambia aunque cambie el aviso que se está mostrando.
  const valor = useMemo<AvisosContextType>(
    () => ({ mostrarError, mostrarAviso, confirmar, ejecutarAccion }),
    [mostrarError, mostrarAviso, confirmar, ejecutarAccion]
  );

  return (
    <AvisosContext.Provider value={valor}>
      <View style={{ flex: 1 }}>
        {children}
        {aviso && <AvisoFlotante key={aviso.id} aviso={aviso} onCerrar={() => cerrarAviso(aviso.id)} />}
      </View>
      {confirmacion && <VentanaConfirmar opciones={confirmacion} onResponder={responder} />}
    </AvisosContext.Provider>
  );
}
