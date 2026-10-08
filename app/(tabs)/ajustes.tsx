import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, AppState, Modal, TextInput } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { TEMAS, TemaId } from '../../context/themes';
import { api } from '../../lib/api';
import CampoContrasena from '../../components/CampoContrasena';

export default function Ajustes() {
  const { cerrarSesion, eliminarCuenta, cambiarContrasena, session } = useAuth();
  const { temaId, tema, cambiarTema } = useTheme();
  const [conectando, setConectando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  // Formulario "Cambiar contraseña"
  const [claveVisible, setClaveVisible] = useState(false);
  const [claveActual, setClaveActual] = useState('');
  const [claveNueva, setClaveNueva] = useState('');
  const [claveRepetir, setClaveRepetir] = useState('');
  const [guardandoClave, setGuardandoClave] = useState(false);
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
      return !!r.data.conectado;
    } catch {
      return null; // sin red o servidor dormido: no sabemos
    }
  }, []);

  useEffect(() => {
    verificarConexion();
  }, [verificarConexion]);

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

  const conectarGoogle = async () => {
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
        Alert.alert('¡Listo!', 'Tu cuenta de Google quedó conectada. Ya podés subir documentos y crear turnos.');
      } else if (resultado.type === 'success' && resultado.url?.includes('google=error')) {
        Alert.alert('No se pudo conectar', 'Google no completó la conexión. Probá de nuevo.');
      } else if (ok === null) {
        Alert.alert('No pudimos comprobarlo', 'Revisá tu conexión a internet y volvé a abrir Ajustes.');
      }
      // Si ok === false y el usuario solo cerró el navegador, no mostramos nada: canceló.
    } catch (e: any) {
      const detalle = e?.response?.data?.detail || e?.message || 'Error desconocido';
      Alert.alert('No se pudo iniciar la conexión', detalle);
    } finally {
      esperandoGoogle.current = false;
      setConectando(false);
    }
  };

  const cerrarFormularioClave = () => {
    setClaveVisible(false);
    setClaveActual('');
    setClaveNueva('');
    setClaveRepetir('');
  };

  const guardarClave = async () => {
    if (!claveActual) {
      Alert.alert('Falta la contraseña actual', 'Escribí tu contraseña actual.');
      return;
    }
    if (claveNueva.length < 6) {
      Alert.alert('Contraseña muy corta', 'La nueva tiene que tener al menos 6 caracteres.');
      return;
    }
    if (claveNueva !== claveRepetir) {
      Alert.alert('No coinciden', 'Las dos contraseñas nuevas tienen que ser iguales.');
      return;
    }
    setGuardandoClave(true);
    const { error } = await cambiarContrasena(claveActual, claveNueva);
    setGuardandoClave(false);
    if (error) {
      Alert.alert('No se pudo cambiar la contraseña', error);
      return;
    }
    cerrarFormularioClave();
    Alert.alert('Listo', 'Tu contraseña se cambió.');
  };

  const confirmarEliminarCuenta = () => {
    Alert.alert(
      '¿Eliminar tu cuenta?',
      'Se borrarán tus hijos, documentos y turnos guardados en Docukids, y tu usuario. ' +
        'Esto no se puede deshacer.\n\n' +
        'Tus archivos en Google Drive NO se borran: seguirán en tu Drive. ' +
        'Los eventos de Google Calendar tampoco. ' +
        'Dejarás de recibir avisos por email.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar cuenta', style: 'destructive', onPress: ejecutarEliminarCuenta },
      ]
    );
  };

  const ejecutarEliminarCuenta = async () => {
    setEliminando(true);
    const { error } = await eliminarCuenta();
    if (error) {
      setEliminando(false);
      Alert.alert('No se pudo eliminar la cuenta', error);
      return;
    }
    // Sesión cerrada: la app vuelve sola a la pantalla de login.
    Alert.alert(
      'Cuenta eliminada',
      'Tus datos de Docukids se borraron. Tus archivos de Drive y los eventos de Calendar siguen en tu cuenta de Google.'
    );
  };

  return (
    <LinearGradient colors={tema.backgroundGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.texto}>Ajustes</Text>
        <Text style={styles.email}>{session?.user.email}</Text>
        
        <Text style={styles.estadoGoogle}>
          {conectado === null ? 'Google: comprobando…' : conectado ? 'Google: ✅ Conectado' : 'Google: ⚠️ No conectado'}
        </Text>
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

        <TouchableOpacity
          style={styles.botonEliminar}
          onPress={confirmarEliminarCuenta}
          disabled={eliminando}
        >
          <Text style={styles.botonEliminarTexto}>{eliminando ? 'Eliminando…' : 'Eliminar cuenta'}</Text>
        </TouchableOpacity>
      </ScrollView>

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
  container: { flexGrow: 1, alignItems: 'center', gap: 16, padding: 24, paddingTop: 30, paddingBottom: 60 },
  texto: { fontSize: 20, color: '#3F3F3F' },
  email: { fontSize: 16, color: '#3F3F3F' },
  estadoGoogle: { fontSize: 16, fontWeight: '600', color: '#1F1F1F' },
  botonGoogle: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  ayuda: { fontSize: 14, color: '#3F3F3F', textAlign: 'center', maxWidth: 260, marginTop: -8 },
  separador: { width: '100%', height: 1, backgroundColor: '#eee', marginVertical: 8 },
  tituloSeccion: { fontSize: 20, fontWeight: 'bold', color: '#1F1F1F' },
  subtituloSeccion: { fontSize: 15, color: '#3F3F3F', marginTop: -12 },
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
  botonEliminar: { borderWidth: 2, borderColor: '#c62828', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 4 },
  fondoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  tarjetaModal: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  tituloModal: { fontSize: 20, fontWeight: 'bold', color: '#1F1F1F', marginBottom: 14 },
  inputModal: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, color: '#1F1F1F' },
  filaModal: { flexDirection: 'row', gap: 12, marginTop: 4 },
  botonModal: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  botonEliminarTexto: { color: '#c62828', fontWeight: 'bold', fontSize: 16 },
});