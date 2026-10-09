// Traduce los errores de Supabase Auth (que vienen en inglés) a mensajes para
// personas. Sin dependencias de React Native, para poder probarlo con Node.
import { ErrorAmigable, errorSimple } from './errores';

function textoDe(error: any): { m: string; codigo: string } {
  return {
    m: String(error?.message ?? '').toLowerCase(),
    codigo: String(error?.code ?? '').toLowerCase(),
  };
}

// true si Supabase no pudo ni comunicarse (sin internet, servidor caído).
export function esErrorDeRed(error: any): boolean {
  const { m } = textoDe(error);
  return (
    error?.name === 'AuthRetryableFetchError' ||
    error?.status === 0 ||
    m.includes('network request failed') ||
    m.includes('failed to fetch') ||
    m.includes('network error')
  );
}

// true si el email o la contraseña de un inicio de sesión no coinciden.
export function esCredencialesInvalidas(error: any): boolean {
  const { m, codigo } = textoDe(error);
  return codigo === 'invalid_credentials' || m.includes('invalid login credentials');
}

// "titulo" es lo que se estaba intentando, por ejemplo "No se pudo iniciar sesión".
export function traducirErrorAuth(error: any, titulo: string): ErrorAmigable {
  const { m, codigo } = textoDe(error);

  if (esErrorDeRed(error)) {
    return errorSimple(
      'Sin conexión',
      'No hay internet o la señal es muy débil. Revisá tu conexión e intentá de nuevo.',
      'sin_internet',
      'reintentar',
      'Reintentar'
    );
  }
  if (
    error?.status === 429 ||
    codigo.includes('rate_limit') ||
    m.includes('rate limit') ||
    m.includes('security purposes')
  ) {
    return errorSimple('Demasiados intentos', 'Esperá un minuto y probá de nuevo.', 'generico');
  }
  if (esCredencialesInvalidas(error)) {
    return errorSimple(titulo, 'El email o la contraseña no son correctos.', 'sesion_vencida');
  }
  if (codigo === 'email_not_confirmed' || m.includes('email not confirmed')) {
    return errorSimple(
      'Falta confirmar tu email',
      'Revisá tu correo y tocá el enlace de confirmación antes de ingresar.',
      'sesion_vencida'
    );
  }
  if (codigo === 'user_already_exists' || m.includes('already registered')) {
    return errorSimple(
      'Ese email ya tiene cuenta',
      'Iniciá sesión, o usá "¿Olvidaste tu contraseña?" si no la recordás.',
      'sesion_vencida'
    );
  }
  if (m.includes('not authorized')) {
    return errorSimple(
      titulo,
      'El servicio de correo todavía no está habilitado para este email.',
      'generico'
    );
  }
  if (codigo === 'email_address_invalid' || (m.includes('email address') && m.includes('invalid'))) {
    return errorSimple('Revisá el email', 'Ese email no parece válido.');
  }
  if (codigo === 'otp_expired' || m.includes('expired') || m.includes('token has')) {
    return errorSimple('Código incorrecto', 'El código es incorrecto o ya venció. Pedí uno nuevo.');
  }
  if (codigo === 'same_password' || m.includes('different from the old')) {
    return errorSimple('Contraseña repetida', 'La nueva tiene que ser distinta de la anterior.');
  }
  if (codigo === 'weak_password' || m.includes('weak') || m.includes('at least')) {
    return errorSimple('Contraseña muy débil', 'Probá con una más larga.');
  }

  // Cualquier otro: nunca mostramos el texto en inglés. Queda en el registro
  // del programador (consola) para poder investigarlo.
  console.warn('Error de autenticación sin traducir:', codigo, error?.message);
  return errorSimple(titulo, 'Algo salió mal. Probá de nuevo en un rato.', 'generico', 'reintentar', 'Reintentar');
}
