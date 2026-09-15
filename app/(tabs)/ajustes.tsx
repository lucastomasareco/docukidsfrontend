import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export default function Ajustes() {
  const { cerrarSesion, session } = useAuth();
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
        // En Expo Go, el navegador no puede volver solo a la app cuando
        // Google termina (eso solo funciona en un build final). Si
        // llegaste a autorizar en la pantalla de Google, probablemente
        // ya se conectó igual -- lo confirmamos probando a subir algo.
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
    <View style={styles.container}>
      <Text style={styles.texto}>Ajustes</Text>
      <Text style={styles.email}>{session?.user.email}</Text>

      <TouchableOpacity style={styles.botonGoogle} onPress={conectarGoogle} disabled={conectando}>
        <Text style={styles.botonTexto}>{conectando ? 'Conectando...' : 'Conectar con Google'}</Text>
      </TouchableOpacity>
      <Text style={styles.ayuda}>Necesario para subir documentos, agendar turnos y recibir avisos por email.</Text>

      <TouchableOpacity style={styles.boton} onPress={cerrarSesion}>
        <Text style={styles.botonTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
  texto: { fontSize: 18, color: '#666' },
  email: { fontSize: 14, color: '#999' },
  botonGoogle: { backgroundColor: '#1976d2', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  ayuda: { fontSize: 12, color: '#999', textAlign: 'center', maxWidth: 260, marginTop: -8 },
  boton: { backgroundColor: '#c62828', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  botonTexto: { color: '#fff', fontWeight: 'bold' },
});