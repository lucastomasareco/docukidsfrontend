import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

// Traduce los errores de Supabase Auth a mensajes claros en español.
function traducirErrorAuth(error: any): string {
  const msg: string = (error?.message || '').toString();
  const codigo: string = (error?.code || '').toString();
  const m = msg.toLowerCase();
  if (error?.status === 429 || codigo.includes('rate_limit') || m.includes('rate limit') || m.includes('security purposes')) {
    return 'Pediste demasiados códigos seguidos. Esperá un minuto y probá de nuevo.';
  }
  if (m.includes('not authorized')) {
    return 'No se pudo enviar el correo: el servicio de correo todavía no está habilitado para este email.';
  }
  if (codigo === 'otp_expired' || m.includes('expired') || m.includes('invalid')) {
    return 'El código es incorrecto o ya venció. Pedí uno nuevo.';
  }
  if (codigo === 'same_password' || m.includes('different from the old')) {
    return 'La contraseña nueva tiene que ser distinta de la anterior.';
  }
  if (codigo === 'weak_password' || m.includes('weak')) {
    return 'La contraseña es muy débil. Probá con una más larga.';
  }
  return msg || 'Error desconocido';
}

type AuthContextType = {
  session: Session | null;
  cargando: boolean;
  // true mientras se está restableciendo la contraseña: evita que la app te
  // lleve adentro antes de terminar el cambio.
  enRecuperacion: boolean;
  pedirCodigoRecuperacion: (email: string) => Promise<{ error: string | null }>;
  restablecerContrasena: (email: string, codigo: string, nueva: string) => Promise<{ error: string | null }>;
  cambiarContrasena: (actual: string, nueva: string) => Promise<{ error: string | null }>;
  iniciarSesion: (email: string, password: string) => Promise<{ error: string | null }>;
  registrarse: (email: string, password: string) => Promise<{ error: string | null }>;
  cerrarSesion: () => Promise<void>;
  eliminarCuenta: () => Promise<{ error: string | null }>;
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
    return { error: error ? error.message : null };
  };

  const registrarse = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error ? error.message : null };
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
  };

  // 1) Manda un correo con un código de 6 dígitos (la plantilla "Reset password"
  //    de Supabase debe incluir {{ .Token }}). Nunca se envía la contraseña.
  const pedirCodigoRecuperacion = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    return { error: error ? traducirErrorAuth(error) : null };
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
      if (errorCodigo) return { error: traducirErrorAuth(errorCodigo) };

      const { error: errorClave } = await supabase.auth.updateUser({ password: nueva });
      if (errorClave) {
        await supabase.auth.signOut({ scope: 'local' });
        return { error: traducirErrorAuth(errorClave) };
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
    if (!email) return { error: 'No hay una sesión abierta.' };
    const { error: errorActual } = await supabase.auth.signInWithPassword({ email, password: actual });
    if (errorActual) return { error: 'La contraseña actual no es correcta.' };
    const { error } = await supabase.auth.updateUser({ password: nueva });
    return { error: error ? traducirErrorAuth(error) : null };
  };

  // Elimina la cuenta en el backend (datos de la app + usuario de Supabase).
  // Los archivos de Drive y los eventos de Calendar NO se borran.
  // Si sale bien, cerramos la sesión SOLO en este teléfono (scope local):
  // el usuario ya no existe en Supabase, así que no hay nada que avisarle al servidor.
  const eliminarCuenta = async () => {
    try {
      await api.delete('/account');
    } catch (e: any) {
      const detalle = e?.response?.data?.detail || e?.message || 'Error desconocido';
      return { error: detalle };
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