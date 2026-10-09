import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useAvisos } from '../../context/AvisosContext';
import CampoContrasena from '../../components/CampoContrasena';

export default function Login() {
  const { iniciarSesion } = useAuth();
  const { mostrarError, mostrarAviso } = useAvisos();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      mostrarAviso('Faltan datos', 'Completá email y contraseña.', { icono: 'create-outline' });
      return;
    }
    setCargando(true);
    const { error } = await iniciarSesion(email, password);
    setCargando(false);
    if (error) mostrarError(error, { onReintentar: handleLogin });
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.titulo}>Docukids</Text>
      <Text style={styles.subtitulo}>Iniciá sesión</Text>

      <TextInput placeholderTextColor="#5F5F5F" style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <CampoContrasena placeholderTextColor="#5F5F5F" style={styles.input} placeholder="Contraseña" value={password} onChangeText={setPassword}  />

      <TouchableOpacity style={styles.boton} onPress={handleLogin} disabled={cargando}>
        <Text style={styles.botonTexto}>{cargando ? 'Ingresando...' : 'Ingresar'}</Text>
      </TouchableOpacity>

      <Link href="/(auth)/recuperar" style={styles.link}>
        <Text style={{ fontSize: 16, color: '#1F1F1F', textDecorationLine: 'underline' }}>¿Olvidaste tu contraseña?</Text>
      </Link>

      <Link href="/(auth)/register" style={styles.link}>
        <Text style={{ fontSize: 16, color: '#1F1F1F' }}>¿No tenés cuenta? Registrate</Text>
      </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  titulo: { fontSize: 34, fontWeight: 'bold', textAlign: 'center' },
  subtitulo: { fontSize: 18, color: '#3F3F3F', textAlign: 'center', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, color: '#1F1F1F' },
  boton: { backgroundColor: '#1976d2', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  botonTexto: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  link: { marginTop: 20, textAlign: 'center' },
});