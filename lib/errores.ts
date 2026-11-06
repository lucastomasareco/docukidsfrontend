// Traduce CUALQUIER error (de Axios, de JavaScript, lo que sea) a un mensaje
// pensado para una persona. Las pantallas nunca deberían mostrar el texto
// crudo del error ("Network Error", "Token inválido o vencido: ...").
//
// Este archivo no importa nada de React Native a propósito: así se puede
// probar con Node solo.

export type TipoError =
  | 'sin_internet'
  | 'servidor_despertando'
  | 'sesion_vencida'
  | 'google_desconectado'
  | 'archivo_grande'
  | 'archivo_tipo'
  | 'archivo_vacio'
  | 'no_encontrado'
  | 'datos_invalidos'
  | 'familia'
  | 'servidor'
  | 'generico';

// Qué botón extra ofrece el aviso:
//  - reintentar: volver a hacer lo que falló
//  - ajustes:    llevar a la pestaña Ajustes (para reconectar Google)
//  - login:      cerrar la sesión y volver a la pantalla de ingreso
export type AccionError = 'reintentar' | 'ajustes' | 'login' | null;

export type ErrorAmigable = {
  tipo: TipoError;
  titulo: string;
  mensaje: string;
  accion: AccionError;
  etiquetaAccion: string | null;
};

// Texto del backend (campo "detail"), si vino como texto.
function detalleDe(e: any): string {
  const d = e?.response?.data?.detail;
  return typeof d === 'string' ? d : '';
}

function armar(
  tipo: TipoError,
  titulo: string,
  mensaje: string,
  accion: AccionError = null,
  etiquetaAccion: string | null = null
): ErrorAmigable {
  return { tipo, titulo, mensaje, accion, etiquetaAccion };
}

// Un error armado a mano (por ejemplo una validación o un texto que ya viene
// en español desde otra parte) para mostrarlo con el mismo diseño.
export function errorSimple(
  titulo: string,
  mensaje: string,
  tipo: TipoError = 'datos_invalidos',
  accion: AccionError = null,
  etiquetaAccion: string | null = null
): ErrorAmigable {
  return armar(tipo, titulo, mensaje, accion, etiquetaAccion);
}

// true si el valor ya es un ErrorAmigable (no hay que traducirlo otra vez).
export function esErrorAmigable(x: any): x is ErrorAmigable {
  return (
    !!x &&
    typeof x === 'object' &&
    typeof x.tipo === 'string' &&
    typeof x.titulo === 'string' &&
    typeof x.mensaje === 'string' &&
    'accion' in x &&
    !('response' in x)
  );
}

// Para un MIEMBRO de familia: solo el titular puede conectar Google, así que el aviso
// "Google desconectado" no lo manda a Ajustes (no puede arreglarlo): le dice que se lo pida.
// Cualquier otro error queda igual.
export function adaptarParaMiembro(error: ErrorAmigable): ErrorAmigable {
  if (error.tipo !== 'google_desconectado') return error;
  return armar(
    'google_desconectado',
    'Google desconectado',
    'La cuenta de Google de tu familia no está conectada. Pedile al titular que la conecte desde Ajustes.'
  );
}

// "que" es lo que se estaba intentando, con verbo en infinitivo y sin "No se pudo":
// por ejemplo "subir el documento" o "cargar los turnos". Se usa en el título
// de los errores genéricos: "No se pudo subir el documento".
export function interpretarError(e: any, que = 'completar la acción'): ErrorAmigable {
  // Si ya viene traducido (por ejemplo desde AuthContext), se usa tal cual.
  if (esErrorAmigable(e)) return e;

  const estado: number | undefined = e?.response?.status;
  const detalle = detalleDe(e).toLowerCase();
  const codigo: string = String(e?.code ?? '');
  const mensajeCrudo: string = String(e?.message ?? '').toLowerCase();

  // --- Errores en los que el servidor ni siquiera llegó a contestar ---
  if (!e?.response) {
    // Se acabó el tiempo de espera: lo más común es que Render esté despertando.
    if (codigo === 'ECONNABORTED' || codigo === 'ETIMEDOUT' || mensajeCrudo.includes('timeout')) {
      return armar(
        'servidor_despertando',
        'El servidor está despertando',
        'Esto puede tardar hasta un minuto. Probá de nuevo en unos segundos.',
        'reintentar',
        'Reintentar'
      );
    }
    // Axios dice "Network Error" cuando no hubo conexión.
    if (codigo === 'ERR_NETWORK' || mensajeCrudo.includes('network error')) {
      return armar(
        'sin_internet',
        'Sin conexión',
        'No hay internet o la señal es muy débil. Revisá tu conexión e intentá de nuevo.',
        'reintentar',
        'Reintentar'
      );
    }
    return armar('generico', `No se pudo ${que}`, 'Ocurrió un problema inesperado. Probá de nuevo.', 'reintentar', 'Reintentar');
  }

  // --- Google: no conectado, o la persona revocó el permiso ---
  // (El backend los distingue solo por el texto del "detail".)
  const googleNoConectado = estado === 400 && detalle.includes('conectó su cuenta de google');
  const googleRevocado = estado === 401 && detalle.includes('renovar el acceso');
  if (googleNoConectado || googleRevocado) {
    return armar(
      'google_desconectado',
      'Google desconectado',
      'Docukids necesita el permiso de tu cuenta de Google para esto. Conectala de nuevo desde Ajustes.',
      'ajustes',
      'Ir a Ajustes'
    );
  }

  // --- Sesión de Docukids (cualquier otro 401) ---
  if (estado === 401) {
    return armar('sesion_vencida', 'Tu sesión venció', 'Volvé a iniciar sesión para seguir.', 'login', 'Iniciar sesión');
  }

  // --- Archivos ---
  if (estado === 413) {
    return armar(
      'archivo_grande',
      'El archivo es muy grande',
      'El límite es de 50 MB. Elegí un archivo más liviano o sacá la foto de nuevo.'
    );
  }
  if (estado === 400 && detalle.includes('llegó vacío')) {
    return armar('archivo_vacio', 'El archivo llegó vacío', 'Elegí el archivo de nuevo.');
  }
  if (estado === 400 && (detalle.includes('no coincide con un pdf') || detalle.includes('tipo de archivo no permitido'))) {
    return armar(
      'archivo_tipo',
      'Archivo no permitido',
      'Solo se pueden subir fotos (JPG, PNG, WebP o HEIC) y archivos PDF.'
    );
  }

  // --- Familia ---
  // El backend no manda códigos: se distingue por estado + texto del "detail".
  // Va ANTES de "no_encontrado" y de la regla de carpetas (409), si no, un código
  // inválido diría "puede que ya se haya borrado" y un 409 caería en otro mensaje.
  if (estado === 404 && detalle.includes('ese código no existe')) {
    return armar('familia', 'Código no válido', 'Ese código no existe, venció o ya se usó. Pedile al titular que genere uno nuevo.');
  }
  if (estado === 404 && (detalle.includes('no formás parte de ninguna familia') || detalle.includes('todavía no tenés una familia'))) {
    return armar('familia', 'No encontramos tu familia', 'Puede que ya no formes parte de ella. Revisá la sección Familia en Ajustes.');
  }
  if (estado === 404 && detalle.includes('esa persona no es parte')) {
    return armar('familia', 'Esa persona ya no está en la familia', 'Revisá la sección Familia en Ajustes para ver quién forma parte.');
  }
  if (estado === 403 && detalle.includes('titular no puede salir')) {
    return armar('familia', 'El titular no puede salir', 'Si querés terminar la familia, tenés que disolverla.');
  }
  if (estado === 403 && detalle.includes('solo el titular')) {
    return armar('familia', 'Solo el titular puede hacerlo', 'Esta acción la hace quien conectó la cuenta de Google. Pedísela a esa persona.');
  }
  if (estado === 409 && detalle.includes('ya formás parte')) {
    return armar('familia', 'Ya estás en una familia', 'Cada cuenta puede estar en una sola familia. Revisá la sección Familia en Ajustes.');
  }
  if (estado === 409 && detalle.includes('ya está completa')) {
    return armar('familia', 'Esa familia está completa', 'Una familia puede tener como máximo 2 personas.');
  }
  if (estado === 409 && detalle.includes('ya tenés hijos')) {
    return armar(
      'familia',
      'Tu cuenta ya tiene hijos cargados',
      'Para unirte a una familia, tu cuenta tiene que estar sin hijos. Borralos y probá de nuevo.'
    );
  }
  if (estado === 409 && detalle.includes('titular no puede quitarse')) {
    return armar('familia', 'El titular no puede quitarse', 'Si querés terminar la familia, tenés que disolverla.');
  }
  if (estado === 409 && detalle.includes('tu familia usa la cuenta de google')) {
    return armar('familia', 'La cuenta de Google es del titular', 'Tu familia usa la cuenta de Google del titular. Solo esa persona puede conectarla.');
  }

  // --- Resto de errores del servidor ---
  if (estado === 404) {
    return armar(
      'no_encontrado',
      'No lo encontramos',
      'Puede que ya se haya borrado. Volvé a cargar la lista.',
      'reintentar',
      'Reintentar'
    );
  }
  // Carpetas: nombre repetido (409) y carpetas de base que no se pueden borrar (400).
  if (estado === 409 && detalle.includes('carpeta')) {
    return armar('datos_invalidos', 'Esa carpeta ya existe', 'Ya tenés una carpeta con ese nombre. Elegí otro para no confundirte.');
  }
  if (estado === 400 && detalle.includes('no se pueden borrar')) {
    return armar('datos_invalidos', 'Esta carpeta no se puede borrar', 'Documentos, Salud y Escuela se pueden renombrar, pero no borrar.');
  }
  if (estado === 422) {
    return armar('datos_invalidos', 'Revisá los datos', 'Algo de lo que cargaste no es válido. Corregilo e intentá de nuevo.');
  }
  // 502/503/504 con un "detail" en JSON: lo mandó NUESTRO backend a propósito (por ejemplo,
  // "No se pudieron mover tus archivos de Drive..."), el servidor está despierto. Se muestra el
  // motivo real, no "está despertando", o la persona reintenta sin fin sin saber qué pasa.
  if ((estado === 502 || estado === 503 || estado === 504) && detalleDe(e).trim() !== '') {
    return armar('servidor', `No se pudo ${que}`, detalleDe(e), 'reintentar', 'Reintentar');
  }
  // 502/503/504 sin "detail": Render suele contestar así (con HTML) mientras el servidor arranca.
  if (estado === 502 || estado === 503 || estado === 504) {
    return armar(
      'servidor_despertando',
      'El servidor está despertando',
      'Esto puede tardar hasta un minuto. Probá de nuevo en unos segundos.',
      'reintentar',
      'Reintentar'
    );
  }
  if ((estado ?? 0) >= 500) {
    return armar(
      'servidor',
      `No se pudo ${que}`,
      'Algo falló en nuestro servidor. Probá de nuevo en un rato.',
      'reintentar',
      'Reintentar'
    );
  }

  return armar('generico', `No se pudo ${que}`, 'Ocurrió un problema inesperado. Probá de nuevo.', 'reintentar', 'Reintentar');
}
