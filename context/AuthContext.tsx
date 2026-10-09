import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { ErrorAmigable, errorSimple } from '../lib/errores';
import { esCredencialesInvalidas, traducirErrorAuth } from '../lib/erroresAuth';

type AuthContextType = {
  session: Session | null;
  cargando: boolean;
  // true mientras se está restableciendo la contraseña: evita que la app te
  // lleve adentro antes de terminar el cambio.
  enRecuperacion: boolean;
  // Estas funciones devuelven el error ya traducido (con ícono, título y mensaje).
  pedirCodigoRecuperacion: (email: string) => Promise<{ error: ErrorAmigable | null }>;
  restablecerContrasena: (email: string, codigo: string, nueva: string) => Promise<{ error: ErrorAmigable | null }>;
  cambiarContrasena: (actual: string, nueva: string) => Promise<{ error: ErrorAmigable | null }>;
  iniciarSesion: (email: string, password: string) => Promise<{ error: ErrorAmigable | null }>;
  registrarse: (email: string, password: string) => Promise<{ error: ErrorAmigable | null }>;
  cerrarSesion: () => Promise<void>;
  // Si falla, devuelve el error original para que la pantalla lo traduzca.
  eliminarCuenta: () => Promise<{ error: unknown | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enRecuperacion, setEnRecuperacion] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCargando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const iniciarSesion = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? traducirErrorAuth(error, 'No se pudo iniciar sesión') : null };
  };

  const registrarse = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error ? traducirErrorAuth(error, 'No se pudo registrar') : null };
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
  };

  // 1) Manda un correo con un código de 6 dígitos (la plantilla "Reset password"
  //    de Supabase debe incluir {{ .Token }}). Nunca se envía la contraseña.
  const pedirCodigoRecuperacion = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    return { error: error ? traducirErrorAuth(error, 'No se pudo enviar el código') : null };
  };

  // 2) Valida el código y fija la contraseña nueva. Si algo falla después de
  //    validar el código, cerramos la sesión local para no dejar a nadie
  //    "adentro" con la contraseña vieja sin darse cuenta.
  const restablecerContrasena = async (email: string, codigo: string, nueva: string) => {
    setEnRecuperacion(true);
    try {
      const { error: errorCodigo } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: codigo.trim(),
        type: 'recovery',
      });
      if (errorCodigo) return { error: traducirErrorAuth(errorCodigo, 'No se pudo cambiar la contraseña') };

      const { error: errorClave } = await supabase.auth.updateUser({ password: nueva });
      if (errorClave) {
        await supabase.auth.signOut({ scope: 'local' });
        return { error: traducirErrorAuth(errorClave, 'No se pudo cambiar la contraseña') };
      }
      return { error: null };
    } finally {
      setEnRecuperacion(false);
    }
  };

  // Cambiar la contraseña con la sesión abierta (Ajustes). Primero se
  // comprueba la contraseña actual, por si alguien tiene el teléfono desbloqueado.
  const cambiarContrasena = async (actual: string, nueva: string) => {
    const email = session?.user.email;
    if (!email) {
      return { error: errorSimple('Tu sesión venció', 'Volvé a iniciar sesión para seguir.', 'sesion_vencida', 'login', 'Iniciar sesión') };
    }
    const { error: errorActual } = await supabase.auth.signInWithPassword({ email, password: actual });
    if (errorActual) {
      // Solo decimos "contraseña incorrecta" si de verdad lo es. Sin internet o
      // con demasiados intentos, mostramos eso y no culpamos a la contraseña.
      return {
        error: esCredencialesInvalidas(errorActual)
          ? errorSimple('Contraseña actual incorrecta', 'Revisala e intentá de nuevo.', 'sesion_vencida')
          : traducirErrorAuth(errorActual, 'No se pudo cambiar la contraseña'),
      };
    }
    const { error } = await supabase.auth.updateUser({ password: nueva });
    return { error: error ? traducirErrorAuth(error, 'No se pudo cambiar la contraseña') : null };
  };

  // Elimina la cuenta en el backend (datos de la app + usuario de Supabase).
  // Los archivos de Drive y los eventos de Calendar NO se borran.
  // Si sale bien, cerramos la sesión SOLO en este teléfono (scope local):
  // el usuario ya no existe en Supabase, así que no hay nada que avisarle al servidor.
  const eliminarCuenta = async () => {
    try {
      await api.delete('/account');
    } catch (e) {
      return { error: e ?? new Error('Error desconocido') };
    }
    await supabase.auth.signOut({ scope: 'local' });
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{
        session,
        cargando,
        enRecuperacion,
        pedirCodigoRecuperacion,
        restablecerContrasena,
        cambiarContrasena,
        iniciarSesion,
        registrarse,
        cerrarSesion,
        eliminarCuenta,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}