import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { TEMAS, TemaId } from '../../context/themes';
import { api } from '../../lib/api';

export default function Ajustes() {
  const { cerrarSesion, session } = useAuth();
  const { temaId, tema, cambiarTema } = useTheme();
  const [conectando, setConectando] = useState(false);

  const conectarGoogle = async () => {
    setConectando(true);
    try {
      const respuesta = await api.get('/auth/google/url');
      const url: string = respuesta.data.url;
      const resultado = await WebBrowser.openAuthSessionAsync(url, 'docukids://');
      if (resultado.type === 'success' && resultado.url && resultado.url.includes('google=ok')) {
        Alert.alert('¡Listo!', 'Tu cuenta de Google quedó conectada. Ya podés subir documentos y crear turnos.');
      } else {
        Alert.alert(
          'Revisá si funcionó',
          'Si llegaste a la pantalla de autorización de Google y aceptaste, es muy probable que ya haya quedado conectado (en este modo de desarrollo el navegador no vuelve solo a la app). Probá subir un documento para confirmarlo.'
        );
      }
    } catch (e: any) {
      const detalle = e?.response?.data?.detail || e?.message || 'Error desconocido';
      Alert.alert('No se pudo iniciar la conexión', detalle);
    } finally {
      setConectando(false);
    }
  };

  return (
    <LinearGradient colors={tema.backgroundGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.texto}>Ajustes</Text>
        <Text style={styles.email}>{session?.user.email}</Text>
        
        <TouchableOpacity
          style={[styles.botonGoogle, { backgroundColor: tema.primary }]}
          onPress={conectarGoogle}
          disabled={conectando}
        >
          <Text style={styles.botonTexto}>{conectando ? 'Conectando...' : 'Conectar con Google'}</Text>
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
        
        <TouchableOpacity style={[styles.boton, { backgroundColor: tema.primary }]} onPress={cerrarSesion}>
          <Text style={styles.botonTexto}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', gap: 16, padding: 24, paddingTop: 60, paddingBottom: 60 },
  texto: { fontSize: 18, color: '#666' },
  email: { fontSize: 14, color: '#999' },
  botonGoogle: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  ayuda: { fontSize: 12, color: '#999', textAlign: 'center', maxWidth: 260, marginTop: -8 },
  separador: { width: '100%', height: 1, backgroundColor: '#eee', marginVertical: 8 },
  tituloSeccion: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  subtituloSeccion: { fontSize: 13, color: '#999', marginTop: -12 },
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
  check: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  nombreTema: { fontSize: 12, color: '#555', marginTop: 6, textAlign: 'center' },
  boton: { backgroundColor: '#c62828', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 8 },
  botonTexto: { color: '#fff', fontWeight: 'bold' },
});