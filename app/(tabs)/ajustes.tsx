import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, AppState, Modal, TextInput, Platform, Share, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { conectarGoogleEnWeb, estaEnElectron } from '../../lib/googleWeb';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { TEMAS, TemaId } from '../../context/themes';
import { api } from '../../lib/api';
import { useAvisos } from '../../context/AvisosContext';
import { useFamily } from '../../context/FamilyContext';
import { useChildren } from '../../context/ChildrenContext';
import { TarjetaError } from '../../components/AvisoError';
import { ErrorAmigable, errorSimple, interpretarError } from '../../lib/errores';
import CampoContrasena from '../../components/CampoContrasena';
import TarjetaPapelera from '../../components/TarjetaPapelera';
import { codigoCompleto, formatearCodigo, mensajeEliminarCuenta, msRestantes, normalizarCodigo, textoInvitacion, textoVencimiento } from '../../lib/familia';
import { copiarTexto } from '../../lib/portapapeles';

export default function Ajustes() {
  const { cerrarSesion, eliminarCuenta, cambiarContrasena, session } = useAuth();
  const { temaId, tema, cambiarTema } = useTheme();
  const { mostrarError, mostrarAviso, confirmar } = useAvisos();
  const { familia, cargando: cargandoFamilia, error: errorFamilia, cargarFamilia, crearFamilia, invitar, unirse, salir, quitarMiembro, disolver } =
    useFamily();
  // true mientras corre salir / quitar / disolver (deshabilita esos botones).
  const [ocupadoFamilia, setOcupadoFamilia] = useState(false);
  const { hijos } = useChildren();
  // Un miembro no conecta Google: usa el del titular (el backend le devuelve el estado del titular).
  const esMiembro = familia?.role === 'member';
  // Ventana "Unirme con código"
  const [unirseVisible, setUnirseVisible] = useState(false);
  const [codigoEscrito, setCodigoEscrito] = useState('');
  const [uniendo, setUniendo] = useState(false);
  // El error va ADENTRO de la ventana: un aviso de arriba quedaría tapado por el Modal.
  const [errorUnirse, setErrorUnirse] = useState<ErrorAmigable | null>(null);
  const [creandoFamilia, setCreandoFamilia] = useState(false);
  const [generandoCodigo, setGenerandoCodigo] = useState(false);
  // Reloj para la cuenta regresiva del código (se actualiza cada 30 s, y solo si hay código).
  const [ahora, setAhora] = useState(() => Date.now());
  const hayCodigo = !!familia?.invite_code;
  useEffect(() => {
    if (!hayCodigo) return;
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(id);
  }, [hayCodigo]);
  const [conectando, setConectando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  // Eliminar cuenta (Guía §14): false = conservar mis archivos en Drive (opción B, por defecto); true = mandarlos a la papelera (opción A).
  const [borrarDrive, setBorrarDrive] = useState(false);
  // Formulario "Cambiar contraseña"
  const [claveVisible, setClaveVisible] = useState(false);
  const [claveActual, setClaveActual] = useState('');
  const [claveNueva, setClaveNueva] = useState('');
  const [claveRepetir, setClaveRepetir] = useState('');
  const [guardandoClave, setGuardandoClave] = useState(false);
  // Error dentro del modal de contraseña (el aviso de arriba quedaría tapado por el modal).
  const [errorClave, setErrorClave] = useState<ErrorAmigable | null>(null);
  // Si no se pudo comprobar el estado de Google (solo se muestra mientras no sabemos nada).
  const [errorEstado, setErrorEstado] = useState<ErrorAmigable | null>(null);
  // null = todavía no sabemos; true/false = lo que dice el backend.
  const [conectado, setConectado] = useState<boolean | null>(null);
  // true mientras el usuario está en el navegador autorizando Google.
  const esperandoGoogle = useRef(false);

  // Pregunta al backend si Google quedó conectado. Es la ÚNICA fuente de verdad:
  // no dependemos de que el navegador "vuelva solo" a la app.
  const verificarConexion = useCallback(async (): Promise<boolean | null> => {
    try {
      const r = await api.get('/auth/google/status');
      setConectado(!!r.data.conectado);
      setErrorEstado(null);
      return !!r.data.conectado;
    } catch (e) {
      setErrorEstado(interpretarError(e, 'comprobar Google'));
      return null; // sin red o servidor dormido: no sabemos
    }
  }, []);

  useEffect(() => {
    verificarConexion();
  }, [verificarConexion]);

  // Al entrar a Ajustes se vuelve a leer la familia (no hay sondeo automático).
  // En silencio: si ya hay datos en pantalla, no parpadean.
  useFocusEffect(
    useCallback(() => {
      cargarFamilia({ silencioso: true });
    }, [cargarFamilia])
  );

  // Si el usuario vuelve a la app a mano (sin que el navegador se cierre solo),
  // al recuperar el foco volvemos a consultar el estado.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && esperandoGoogle.current) {
        verificarConexion();
      }
    });
    return () => sub.remove();
  }, [verificarConexion]);

  // Al salir de la pantalla, dejamos de esperar a Google.
  useEffect(() => {
    return () => {
      esperandoGoogle.current = false;
    };
  }, []);

  // VERSIÓN DE ESCRITORIO (navegador): no hay "app a la que volver", así que el
  // botón "Volver a Docukids" de la página de Google no sirve. En su lugar:
  //  1) abrimos Google en una pestaña nueva (se abre YA, dentro del clic, para
  //     que el navegador no la bloquee);
  //  2) preguntamos al backend cada pocos segundos si Google quedó conectado;
  //  3) apenas lo está (o si se cierra la pestaña) avisamos y cerramos la pestaña.
     // VERSIÓN DE ESCRITORIO (navegador o Electron): la lógica vive en lib/googleWeb.ts,
   // acá solo manejamos el estado de la pantalla y los avisos.
   const conectarGoogleWeb = async () => {
     setConectando(true);
     esperandoGoogle.current = true;
     try {
       const resultado = await conectarGoogleEnWeb({
         verificar: verificarConexion,
         yaEstabaConectado: conectado === true,
         seguir: () => esperandoGoogle.current,
       });
       if (resultado === 'bloqueado') {
         mostrarAviso(
           'El navegador bloqueó la ventana',
           'Permití las ventanas emergentes para esta página e intentá de nuevo.',
           { icono: 'logo-google' }
         );
       } else if (resultado === 'externo') {
         mostrarAviso('Seguí en tu navegador', 'Terminá la conexión con Google y volvé a Docukids.', {
           icono: 'logo-google',
         });
       } else if (resultado === 'ok') {
         mostrarAviso(
           'Google conectado',
           estaEnElectron()
             ? 'Ya podés subir documentos y crear turnos. Podés cerrar la pestaña de Google.'
             : 'Ya podés subir documentos y crear turnos.',
           { icono: 'checkmark-circle-outline' }
         );
       } else if (resultado === 'tiempo') {
         mostrarAviso('No se pudo conectar', 'Google no completó la conexión. Probá de nuevo.', {
           icono: 'logo-google',
           etiquetaAccion: 'Reintentar',
           onAccion: conectarGoogle,
         });
       }
       // 'cancelado' (cerró la pestaña) y 'detenido' (salió de la pantalla): no mostramos nada.
     } catch (e) {
       mostrarError(e, { que: 'conectar con Google', onReintentar: conectarGoogle });
     } finally {
       esperandoGoogle.current = false;
       setConectando(false);
     }
   };

  const conectarGoogle = async () => {
    if (Platform.OS === 'web') {
      await conectarGoogleWeb();
      return;
    }
    setConectando(true);
    esperandoGoogle.current = true;
    try {
      // Dirección a la que Google/el backend nos devuelve: en Expo Go es
      // exp://IP:8081/--/ajustes y en el APK es docukids:///ajustes.
      // Apunta a esta misma pantalla para que el router no muestre "ruta no encontrada".
      const returnUrl = Linking.createURL('/ajustes');
      const respuesta = await api.get('/auth/google/url', { params: { return_to: returnUrl } });
      const url: string = respuesta.data.url;

      const resultado = await WebBrowser.openAuthSessionAsync(url, returnUrl);

      // Sea cual sea el resultado (success, cancel, dismiss), preguntamos al backend.
      const yaEstabaConectado = conectado === true;
      const ok = await verificarConexion();
      const volvioConExito = resultado.type === 'success' && !!resultado.url?.includes('google=ok');
      if (ok && (volvioConExito || !yaEstabaConectado)) {
        mostrarAviso('Google conectado', 'Ya podés subir documentos y crear turnos.', {
          icono: 'checkmark-circle-outline',
        });
      } else if (resultado.type === 'success' && resultado.url?.includes('google=error')) {
        mostrarAviso('No se pudo conectar', 'Google no completó la conexión. Probá de nuevo.', {
          icono: 'logo-google',
          etiquetaAccion: 'Reintentar',
          onAccion: conectarGoogle,
        });
      } else if (ok === null) {
        mostrarAviso('No pudimos comprobarlo', 'Revisá tu conexión a internet e intentá de nuevo.', {
          icono: 'cloud-offline-outline',
          etiquetaAccion: 'Reintentar',
          onAccion: () => {
            verificarConexion();
          },
        });
      }
      // Si ok === false y el usuario solo cerró el navegador, no mostramos nada: canceló.
    } catch (e) {
      mostrarError(e, { que: 'conectar con Google', onReintentar: conectarGoogle });
    } finally {
      esperandoGoogle.current = false;
      setConectando(false);
    }
  };

  const ejecutarCrearFamilia = async () => {
    setCreandoFamilia(true);
    const { error } = await crearFamilia();
    setCreandoFamilia(false);
    if (error) {
      mostrarError(error, { que: 'crear la familia', onReintentar: ejecutarCrearFamilia });
      cargarFamilia({ silencioso: true }); // por si el error fue "ya formás parte de una familia"
      return;
    }
    mostrarAviso('Familia creada', 'Ahora sos el titular de tu familia.', { icono: 'checkmark-circle-outline' });
  };

  const generarCodigo = async () => {
    setGenerandoCodigo(true);
    const { error } = await invitar();
    setGenerandoCodigo(false);
    if (error) {
      mostrarError(error, { que: 'generar el código', onReintentar: generarCodigo });
      cargarFamilia({ silencioso: true }); // por si ya no sos titular o la familia cambió
    }
    // Si salió bien, el código aparece solo: el contexto ya volvió a leer la familia.
  };

  // Web: copia el mensaje. Teléfono: abre el menú de compartir (que también permite copiar).
  const copiarOCompartirCodigo = async () => {
    if (!familia?.invite_code) return;
    const mensaje = textoInvitacion(familia.invite_code, familia.invite_expires_at);
    if (Platform.OS === 'web') {
      const ok = await copiarTexto(mensaje);
      if (ok) {
        mostrarAviso('Invitación copiada', 'Pegala en un mensaje para la otra persona.', { icono: 'checkmark-circle-outline' });
      } else {
        mostrarAviso('No se pudo copiar', 'Seleccioná el código en pantalla y copialo a mano.', { icono: 'copy-outline' });
      }
      return;
    }
    try {
      await Share.share({ message: mensaje });
    } catch {
      mostrarAviso('No se pudo compartir', 'Anotá el código y pasáselo a la otra persona.', { icono: 'share-outline' });
    }
  };

  const cerrarUnirse = () => {
    setUnirseVisible(false);
    setCodigoEscrito('');
    setErrorUnirse(null);
  };

  // Cerrar tocando afuera o con la X: no se permite mientras se está procesando la unión,
  // para no perder de vista el resultado.
  const cerrarUnirseSiLibre = () => {
    if (!uniendo) cerrarUnirse();
  };

  const ejecutarUnirse = async () => {
    if (!codigoCompleto(codigoEscrito)) {
      setErrorUnirse(errorSimple('Código incompleto', 'El código tiene 6 letras y números. Revisalo.'));
      return;
    }
    setErrorUnirse(null);
    setUniendo(true);
    const { error } = await unirse(codigoEscrito);
    setUniendo(false);
    if (error) {
      setErrorUnirse(interpretarError(error, 'unirte a la familia'));
      return;
    }
    cerrarUnirse();
    // Si tenías Google propio, el backend lo desconectó: ahora vale el del titular.
    verificarConexion();
    mostrarAviso('Te uniste a la familia', 'Ahora ves los hijos, documentos y turnos del titular.', {
      icono: 'checkmark-circle-outline',
    });
  };

  // Corre una acción de familia (salir / quitar / disolver) y muestra el resultado.
  // Si falla, además relee la familia: el error suele venir de que algo ya cambió
  // (por ejemplo, "ya no formás parte de ninguna familia").
  const correrAccionFamilia = async (
    accion: () => Promise<{ error: unknown | null }>,
    que: string,
    exito: { titulo: string; mensaje: string },
    reintentar: () => void
  ): Promise<boolean> => {
    setOcupadoFamilia(true);
    const { error } = await accion();
    setOcupadoFamilia(false);
    if (error) {
      mostrarError(error, { que, onReintentar: reintentar });
      cargarFamilia({ silencioso: true });
      return false;
    }
    mostrarAviso(exito.titulo, exito.mensaje, { icono: 'checkmark-circle-outline' });
    return true;
  };

  const ejecutarSalirFamilia = async () => {
    const ok = await correrAccionFamilia(
      salir,
      'salir de la familia',
      { titulo: 'Saliste de la familia', mensaje: 'Tu cuenta quedó vacía. Podés crear una familia o unirte a otra.' },
      ejecutarSalirFamilia
    );
    // Ya no vale el Google del titular: se vuelve a preguntar por el tuyo.
    if (ok) verificarConexion();
  };

  const confirmarSalirFamilia = async () => {
    const seguro = await confirmar({
      titulo: '¿Salir de la familia?',
      mensaje:
        'Dejarás de ver los hijos, documentos y turnos del titular. Tu cuenta quedará vacía: no se copia nada.\n\n' +
        'Para volver a unirte vas a necesitar un código nuevo, y tu cuenta tendrá que estar sin hijos.',
      textoConfirmar: 'Salir de la familia',
      peligro: true,
      icono: 'exit-outline',
    });
    if (seguro) await ejecutarSalirFamilia();
  };

  const ejecutarQuitarMiembro = async (id: string, email: string) => {
    await correrAccionFamilia(
      () => quitarMiembro(id),
      'quitar a esa persona',
      { titulo: 'Persona quitada', mensaje: `${email} ya no forma parte de tu familia.` },
      () => ejecutarQuitarMiembro(id, email)
    );
  };

  const confirmarQuitarMiembro = async (id: string, email: string) => {
    const seguro = await confirmar({
      titulo: `¿Quitar a ${email}?`,
      mensaje:
        'Dejará de ver los hijos, documentos y turnos. Su cuenta quedará vacía: no se le copia nada. ' +
        'Tus datos no se tocan.\n\n' +
        'La familia sigue: podés generar un código para invitar a otra persona.',
      textoConfirmar: 'Quitar',
      peligro: true,
      icono: 'person-remove-outline',
    });
    if (seguro) await ejecutarQuitarMiembro(id, email);
  };

  const ejecutarDisolverFamilia = async () => {
    await correrAccionFamilia(
      disolver,
      'disolver la familia',
      { titulo: 'Familia disuelta', mensaje: 'Tus hijos, documentos y turnos siguen en tu cuenta.' },
      ejecutarDisolverFamilia
    );
  };

  const confirmarDisolverFamilia = async () => {
    const otro = familia?.members.find((m) => m.role === 'member');
    const seguro = await confirmar({
      titulo: '¿Disolver la familia?',
      mensaje:
        (otro
          ? `${otro.email} dejará de ver los hijos, documentos y turnos y quedará con la cuenta vacía.\n\n`
          : '') +
        'Tus hijos, documentos y turnos siguen en tu cuenta. Después podés crear una familia nueva.',
      textoConfirmar: 'Disolver familia',
      peligro: true,
      icono: 'warning-outline',
    });
    if (seguro) await ejecutarDisolverFamilia();
  };

  const cerrarFormularioClave = () => {
    setClaveVisible(false);
    setClaveActual('');
    setClaveNueva('');
    setClaveRepetir('');
    setErrorClave(null);
  };

  const guardarClave = async () => {
    if (!claveActual) {
      setErrorClave(errorSimple('Falta la contraseña actual', 'Escribí tu contraseña actual.'));
      return;
    }
    if (claveNueva.length < 6) {
      setErrorClave(errorSimple('Contraseña muy corta', 'La nueva tiene que tener al menos 6 caracteres.'));
      return;
    }
    if (claveNueva !== claveRepetir) {
      setErrorClave(errorSimple('No coinciden', 'Las dos contraseñas nuevas tienen que ser iguales.'));
      return;
    }
    setErrorClave(null);
    setGuardandoClave(true);
    const { error } = await cambiarContrasena(claveActual, claveNueva);
    setGuardandoClave(false);
    if (error) {
      setErrorClave(error);
      return;
    }
    cerrarFormularioClave();
    mostrarAviso('Contraseña cambiada', 'Usá la nueva la próxima vez que inicies sesión.', {
      icono: 'checkmark-circle-outline',
    });
  };

  const ejecutarEliminarCuenta = async () => {
    setEliminando(true);
    // Un miembro de familia no tiene Drive propio: nunca se manda la opción A.
    const mandarAPapelera = !esMiembro && borrarDrive;
    const { error, parcial } = await eliminarCuenta(mandarAPapelera);
    if (error) {
      setEliminando(false);
      mostrarError(error, { que: 'eliminar la cuenta', onReintentar: ejecutarEliminarCuenta });
      return;
    }
    // Sesión cerrada: la app vuelve sola a la pantalla de login. El aviso vive
    // por encima de las pantallas, así que sigue visible después del cambio.
    mostrarAviso(
      'Cuenta eliminada',
      mandarAPapelera && parcial
        ? 'Tus datos de Docukids se borraron. Mandamos a la papelera de Drive los archivos que Docukids pudo mover, pero en tu carpeta Docukids quedaron algunos que Google no nos deja tocar (no los creó la app). Podés borrarlos vos desde Drive. Los eventos de Calendar siguen en tu cuenta de Google.'
        : mandarAPapelera
        ? 'Tus datos de Docukids se borraron y la carpeta Docukids de tu Drive está en la papelera. Si volvés a registrarte y conectás Google con la misma cuenta, Docukids te ofrece recuperarla (hasta unos 30 días). Los eventos de Calendar siguen en tu cuenta de Google.'
        : 'Tus datos de Docukids se borraron. Tus archivos de Drive y los eventos de Calendar siguen en tu cuenta de Google.',
      { icono: 'checkmark-circle-outline', duracion: 10000 }
    );
  };

  const confirmarEliminarCuenta = async () => {
    const seguro = await confirmar({
      titulo: '¿Eliminar tu cuenta?',
      mensaje: mensajeEliminarCuenta(familia, !esMiembro && borrarDrive),
      textoConfirmar: 'Eliminar cuenta',
      peligro: true,
      icono: 'warning-outline',
    });
    if (seguro) await ejecutarEliminarCuenta();
  };

  return (
    <LinearGradient colors={tema.backgroundGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.email}>{session?.user.email}</Text>
        
        {conectado === null && errorEstado ? (
          <View style={{ alignSelf: 'stretch' }}>
            <TarjetaError variante="compacta" error={errorEstado} onReintentar={verificarConexion} />
          </View>
        ) : (
          <Text style={styles.estadoGoogle}>
            {conectado === null
              ? `${esMiembro ? 'Google del titular' : 'Google'}: comprobando…`
              : conectado
                ? `${esMiembro ? 'Google del titular' : 'Google'}: ✅ Conectado`
                : `${esMiembro ? 'Google del titular' : 'Google'}: ⚠️ No conectado`}
          </Text>
        )}
        {esMiembro ? (
          <Text style={styles.ayudaAncha}>
            {conectado === false
              ? 'Tu familia usa la cuenta de Google del titular, y todavía no la conectó. Pedile que lo haga desde Ajustes: hasta entonces no se pueden subir documentos ni agendar turnos.'
              : 'Tu familia usa la cuenta de Google del titular. Solo el titular puede conectarla o reconectarla.'}
          </Text>
        ) : (
          <>
          <TouchableOpacity
            style={[styles.botonGoogle, { backgroundColor: tema.primary }]}
            onPress={conectarGoogle}
            disabled={conectando}
          >
            <Text style={styles.botonTexto}>
              {conectando ? 'Conectando...' : conectado ? 'Reconectar con Google' : 'Conectar con Google'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.ayuda}>Necesario para subir documentos, agendar turnos y recibir avisos por email.</Text>
          </>
        )}

        <View style={styles.separador} />
        <Text style={styles.tituloSeccion}>Familia</Text>
        <Text style={styles.subtituloSeccion}>Compartí todo con otra persona</Text>

        {familia === null && cargandoFamilia ? (
          <Text style={styles.estadoGoogle}>Familia: comprobando…</Text>
        ) : familia === null && errorFamilia ? (
          <View style={{ alignSelf: 'stretch' }}>
            <TarjetaError variante="compacta" error={errorFamilia} onReintentar={() => cargarFamilia()} />
          </View>
        ) : familia === null ? (
          <>
            <Text style={styles.ayudaAncha}>
              Una familia es de hasta 2 personas (por ejemplo, madre y padre) que ven los mismos hijos, documentos y
              turnos. Quien la crea es el titular: se usa su cuenta de Google. Si ya te dieron un código, tocá
              "Unirme con código".
            </Text>
            <TouchableOpacity
              style={[styles.botonGoogle, { backgroundColor: tema.primary }]}
              onPress={ejecutarCrearFamilia}
              disabled={creandoFamilia}
            >
              <Text style={styles.botonTexto}>{creandoFamilia ? 'Creando…' : 'Crear familia'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botonGoogle, { borderWidth: 2, borderColor: tema.primary }]}
              onPress={() => setUnirseVisible(true)}
              disabled={creandoFamilia}
            >
              <Text style={styles.botonTexto}>Unirme con código</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.tarjetaFamilia, { backgroundColor: tema.card, borderColor: tema.primary }]}>
            <Text style={styles.familiaResumen}>
              {familia.role === 'owner' ? 'Sos el titular de la familia' : 'Sos miembro de la familia'}
            </Text>
            <Text style={styles.familiaDetalle}>{familia.members.length} de 2 personas</Text>
            {familia.members.map((m) => (
              <View key={m.id} style={styles.filaMiembro}>
                <Text style={styles.miembroEmail} numberOfLines={1}>
                  {m.email}
                  {m.id === session?.user.id ? ' (vos)' : ''}
                </Text>
                <View style={[styles.etiquetaRol, { backgroundColor: tema.primary }]}>
                  <Text style={styles.etiquetaRolTexto}>{m.role === 'owner' ? 'Titular' : 'Miembro'}</Text>
                </View>
                {familia.role === 'owner' && m.role === 'member' && (
                  <TouchableOpacity
                    style={styles.botonQuitar}
                    onPress={() => confirmarQuitarMiembro(m.id, m.email)}
                    disabled={ocupadoFamilia}
                    accessibilityLabel={`Quitar a ${m.email}`}
                  >
                    <Text style={styles.botonQuitarTexto}>Quitar</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <Text style={styles.familiaDetalle}>
              {familia.role === 'owner'
                ? 'Los dos editan todo. Tu cuenta de Google se usa para guardar los archivos y los eventos.'
                : 'Los dos editan todo. Los archivos y eventos se guardan en la cuenta de Google del titular.'}
            </Text>

            {familia.role === 'owner' && familia.members.length < 2 && (
              <View style={styles.bloqueInvitar}>
                {hayCodigo && msRestantes(familia, ahora) > 0 ? (
                  <>
                    <Text style={styles.familiaDetalle}>Código de invitación</Text>
                    <Text style={styles.codigoGrande} selectable accessibilityLabel={`Código ${familia.invite_code}`}>
                      {formatearCodigo(familia.invite_code!)}
                    </Text>
                    <Text style={styles.familiaDetalle}>
                      {textoVencimiento(msRestantes(familia, ahora))}. Sirve una sola vez.
                    </Text>
                    <TouchableOpacity
                      style={[styles.botonFamilia, { backgroundColor: tema.primary }]}
                      onPress={copiarOCompartirCodigo}
                    >
                      <Text style={styles.botonTexto}>
                        {Platform.OS === 'web' ? 'Copiar invitación' : 'Compartir invitación'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.botonFamilia, { borderWidth: 2, borderColor: tema.primary }]}
                      onPress={generarCodigo}
                      disabled={generandoCodigo}
                    >
                      <Text style={styles.botonTexto}>{generandoCodigo ? 'Generando…' : 'Generar uno nuevo'}</Text>
                    </TouchableOpacity>
                    <Text style={styles.familiaDetalle}>Al generar uno nuevo, el anterior deja de servir.</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.familiaDetalle}>
                      {hayCodigo
                        ? 'El código venció. Generá uno nuevo.'
                        : 'Para sumar a la otra persona, generá un código y pasaselo. Dura 24 horas y sirve una sola vez.'}
                    </Text>
                    <TouchableOpacity
                      style={[styles.botonFamilia, { backgroundColor: tema.primary }]}
                      onPress={generarCodigo}
                      disabled={generandoCodigo}
                    >
                      <Text style={styles.botonTexto}>{generandoCodigo ? 'Generando…' : 'Generar código de invitación'}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {familia.role === 'member' ? (
              <TouchableOpacity
                style={[styles.botonEliminar, { alignSelf: 'stretch', alignItems: 'center' }]}
                onPress={confirmarSalirFamilia}
                disabled={ocupadoFamilia}
              >
                <Text style={styles.botonEliminarTexto}>{ocupadoFamilia ? 'Saliendo…' : 'Salir de la familia'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.botonEliminar, { alignSelf: 'stretch', alignItems: 'center' }]}
                onPress={confirmarDisolverFamilia}
                disabled={ocupadoFamilia}
              >
                <Text style={styles.botonEliminarTexto}>{ocupadoFamilia ? 'Un momento…' : 'Disolver familia'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.separador} />
        <TarjetaPapelera />
        <View style={styles.separador} />
        <Text style={styles.tituloSeccion}>Apariencia</Text>
        <Text style={styles.subtituloSeccion}>Elegí los colores de la app</Text>
        
        <View style={styles.filaTemas}>
          {Object.values(TEMAS).map((t) => (
            <TouchableOpacity key={t.id} style={styles.opcionTema} onPress={() => cambiarTema(t.id as TemaId)}>
              <View
                style={[
                  styles.circuloTema,
                  { backgroundColor: t.primary },
                  temaId === t.id && styles.circuloTemaSeleccionado,
                ]}
              >
                {temaId === t.id && <Text style={styles.check}>✓</Text>}
              </View>
              <Text style={styles.nombreTema}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <TouchableOpacity style={[styles.boton, { backgroundColor: tema.primary }]} onPress={() => setClaveVisible(true)}>
          <Text style={styles.botonTexto}>Cambiar contraseña</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.boton, { backgroundColor: tema.primary }]} onPress={cerrarSesion}>
          <Text style={styles.botonTexto}>Cerrar sesión</Text>
        </TouchableOpacity>

        {!esMiembro && (
          <View style={styles.opcionesDrive}>
            <Text style={[styles.opcionesDriveTitulo, { color: tema.textPrimary }]}>
              Si eliminás tu cuenta, ¿qué pasa con tus archivos de Google Drive?
            </Text>
            {[
              { valor: false, titulo: 'Conservarlos en mi Drive', detalle: 'Se borra tu cuenta de Docukids, pero la carpeta Docukids y tus archivos siguen en tu Drive.' },
              { valor: true, titulo: 'Mandarlos a la papelera de Drive', detalle: 'Además, la carpeta Docukids de tu Drive va a la papelera de Drive. Si volvés a registrarte con la misma cuenta de Google, Docukids te ofrece recuperarla (hasta unos 30 días).' },
            ].map((op) => {
              const elegida = borrarDrive === op.valor;
              return (
                <TouchableOpacity
                  key={String(op.valor)}
                  style={[styles.opcionDrive, { borderColor: elegida ? tema.primary : '#bbb' }]}
                  onPress={() => setBorrarDrive(op.valor)}
                  disabled={eliminando}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: elegida }}
                >
                  <View style={[styles.radioDrive, { borderColor: elegida ? tema.primary : '#888' }]}>
                    {elegida && <View style={[styles.radioDriveRelleno, { backgroundColor: tema.primary }]} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.opcionDriveTitulo, { color: tema.textPrimary }]}>{op.titulo}</Text>
                    <Text style={[styles.opcionDriveDetalle, { color: tema.textSecondary }]}>{op.detalle}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={styles.botonEliminar}
          onPress={confirmarEliminarCuenta}
          disabled={eliminando}
        >
          <Text style={styles.botonEliminarTexto}>{eliminando ? 'Eliminando…' : 'Eliminar cuenta'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={unirseVisible} transparent animationType="fade" onRequestClose={cerrarUnirseSiLibre} statusBarTranslucent>
        {/* Tocar el fondo oscuro cierra la ventana; el Pressable interior frena el toque
            para que tocar la tarjeta (o escribir el código) no la cierre. */}
        <Pressable style={styles.fondoModal} onPress={cerrarUnirseSiLibre} accessibilityLabel="Cerrar la ventana">
          <Pressable style={styles.tarjetaModal} onPress={() => {}}>
            <TouchableOpacity
              style={[styles.botonCerrarModal, { backgroundColor: tema.primary }]}
              onPress={cerrarUnirseSiLibre}
              disabled={uniendo}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Ionicons name="close" size={22} color="#1F1F1F" />
            </TouchableOpacity>
            <Text style={[styles.tituloModal, styles.tituloConCerrar]}>Unirme con código</Text>
            <Text style={styles.textoModal}>
              Escribí el código que te pasó el titular. Al unirte vas a ver los hijos, documentos y turnos de su familia.
            </Text>
            {hijos.length > 0 && (
              <Text style={styles.avisoModal}>
                Tu cuenta tiene {hijos.length === 1 ? '1 hijo cargado' : `${hijos.length} hijos cargados`}. Para unirte
                tenés que borrarlos antes (pestaña Hijos).
              </Text>
            )}
            {conectado === true && (
              <Text style={styles.avisoModal}>
                Tu cuenta de Google conectada se va a desconectar: la familia usa la del titular.
              </Text>
            )}
            <TextInput
              style={[styles.inputModal, styles.inputCodigo]}
              placeholder="ABC 234"
              placeholderTextColor="#5F5F5F"
              value={codigoEscrito}
              onChangeText={(t) => setCodigoEscrito(normalizarCodigo(t))}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              editable={!uniendo}
              onSubmitEditing={ejecutarUnirse}
              returnKeyType="done"
              accessibilityLabel="Código de invitación"
            />
            {errorUnirse && <TarjetaError variante="compacta" error={errorUnirse} onReintentar={ejecutarUnirse} />}
            <View style={styles.filaModal}>
              <TouchableOpacity
                style={[styles.botonModal, { borderWidth: 2, borderColor: tema.primary }]}
                onPress={cerrarUnirse}
                disabled={uniendo}
              >
                <Text style={styles.botonTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.botonModal, { backgroundColor: tema.primary, opacity: codigoCompleto(codigoEscrito) ? 1 : 0.5 }]}
                onPress={ejecutarUnirse}
                disabled={uniendo || !codigoCompleto(codigoEscrito)}
              >
                <Text style={styles.botonTexto}>{uniendo ? 'Uniéndome…' : 'Unirme'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={claveVisible} transparent animationType="fade" onRequestClose={cerrarFormularioClave} statusBarTranslucent>
        <View style={styles.fondoModal}>
          <View style={styles.tarjetaModal}>
            <Text style={styles.tituloModal}>Cambiar contraseña</Text>
            <CampoContrasena
              placeholderTextColor="#5F5F5F"
              style={styles.inputModal}
              placeholder="Contraseña actual"
              value={claveActual}
              onChangeText={setClaveActual}
              
            />
            <CampoContrasena
              placeholderTextColor="#5F5F5F"
              style={styles.inputModal}
              placeholder="Contraseña nueva (mín. 6 caracteres)"
              value={claveNueva}
              onChangeText={setClaveNueva}
              
            />
            <CampoContrasena
              placeholderTextColor="#5F5F5F"
              style={styles.inputModal}
              placeholder="Repetí la contraseña nueva"
              value={claveRepetir}
              onChangeText={setClaveRepetir}
              
            />
            {errorClave && <TarjetaError variante="compacta" error={errorClave} />}
            <View style={styles.filaModal}>
              <TouchableOpacity
                style={[styles.botonModal, { borderWidth: 2, borderColor: tema.primary }]}
                onPress={cerrarFormularioClave}
                disabled={guardandoClave}
              >
                <Text style={styles.botonTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.botonModal, { backgroundColor: tema.primary }]}
                onPress={guardarClave}
                disabled={guardandoClave}
              >
                <Text style={styles.botonTexto}>{guardandoClave ? 'Guardando…' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', gap: 16, padding: 24, paddingTop: 16, paddingBottom: 60 },
  email: { fontSize: 16, color: '#3F3F3F' },
  estadoGoogle: { fontSize: 16, fontWeight: '600', color: '#1F1F1F' },
  botonGoogle: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  ayuda: { fontSize: 14, color: '#3F3F3F', textAlign: 'center', maxWidth: 260, marginTop: -8 },
  ayudaAncha: { fontSize: 14, color: '#3F3F3F', textAlign: 'center', maxWidth: 340, marginTop: -4 },
  tarjetaFamilia: { alignSelf: 'stretch', maxWidth: 420, borderWidth: 2, borderRadius: 12, padding: 16, gap: 10 },
  familiaResumen: { fontSize: 16, fontWeight: 'bold', color: '#1F1F1F' },
  familiaDetalle: { fontSize: 14, color: '#3F3F3F' },
  bloqueInvitar: { gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 12 },
  codigoGrande: { fontSize: 34, fontWeight: 'bold', letterSpacing: 6, color: '#1F1F1F' },
  botonFamilia: { alignSelf: 'stretch', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  // Rojo fijo (#c62828): acciones destructivas de familia.
  botonQuitar: { borderWidth: 2, borderColor: '#c62828', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  botonQuitarTexto: { color: '#c62828', fontWeight: 'bold', fontSize: 13 },
  filaMiembro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  miembroEmail: { flex: 1, fontSize: 15, color: '#1F1F1F' },
  etiquetaRol: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  etiquetaRolTexto: { fontSize: 13, fontWeight: 'bold', color: '#1F1F1F' },
  separador: { width: '100%', height: 1, backgroundColor: '#eee', marginVertical: 8 },
  tituloSeccion: { fontSize: 20, fontWeight: 'bold', color: '#1F1F1F' },
  subtituloSeccion: { fontSize: 15, color: '#3F3F3F', marginTop: -12, textAlign: 'center' },
  filaTemas: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20, marginTop: 4 },
  opcionTema: { alignItems: 'center', width: 72 },
  circuloTema: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  circuloTemaSeleccionado: { borderColor: '#333' },
  check: { color: '#1F1F1F', fontSize: 22, fontWeight: 'bold' },
  nombreTema: { fontSize: 14, color: '#1F1F1F', marginTop: 6, textAlign: 'center' },
  boton: { backgroundColor: '#c62828', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 8 },
  botonTexto: { color: '#1F1F1F', fontWeight: 'bold', fontSize: 16 },
  // Rojo fijo (#c62828), como el resto de las acciones destructivas de la app.
  opcionesDrive: { marginTop: 8, marginBottom: 4 },
  opcionesDriveTitulo: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  opcionDrive: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 8, padding: 12, marginBottom: 8 },
  opcionDriveTitulo: { fontSize: 15, fontWeight: 'bold' },
  opcionDriveDetalle: { fontSize: 13, marginTop: 2 },
  radioDrive: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  radioDriveRelleno: { width: 10, height: 10, borderRadius: 5 },
  botonEliminar: { borderWidth: 2, borderColor: '#c62828', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 4 },
  fondoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  tarjetaModal: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  tituloModal: { fontSize: 20, fontWeight: 'bold', color: '#1F1F1F', marginBottom: 14 },
  // Deja lugar a la X de la esquina para que el título no quede debajo.
  tituloConCerrar: { paddingRight: 44 },
  botonCerrarModal: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  textoModal: { fontSize: 15, color: '#3F3F3F', marginBottom: 12 },
  avisoModal: { fontSize: 14, color: '#1F1F1F', fontWeight: '600', marginBottom: 12 },
  inputCodigo: { textAlign: 'center', fontSize: 24, fontWeight: 'bold', letterSpacing: 4 },
  inputModal: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, color: '#1F1F1F' },
  filaModal: { flexDirection: 'row', gap: 12, marginTop: 4 },
  botonModal: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  botonEliminarTexto: { color: '#c62828', fontWeight: 'bold', fontSize: 16 },
});