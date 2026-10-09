import { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useAvisos } from '../../context/AvisosContext';
import CampoContrasena from '../../components/CampoContrasena';

// Recuperar contraseña en 2 pasos, sin links ni deep links:
//   1) la persona escribe su email y le llega un código de 6 dígitos;
//   2) escribe el código y elige una contraseña nueva.
// Por seguridad NUNCA se envía la contraseña (ni siquiera existe en claro: Supabase solo guarda su "hash").
const ESPERA_REENVIO = 60; // segundos

export default function Recuperar() {
  const { pedirCodigoRecuperacion, restablecerContrasena } = useAuth();
  const { mostrarError, mostrarAviso } = useAvisos();
  const [paso, setPaso] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [cargando, setCargando] = useState(false);
  const [espera, setEspera] = useState(0);

  // Cuenta regresiva para poder pedir otro código.
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const enviarCodigo = async () => {
    if (!email.trim()) {
      mostrarAviso('Falta el email', 'Escribí el email con el que te registraste.', { icono: 'create-outline' });
      return;
    }
    setCargando(true);
    const { error } = await pedirCodigoRecuperacion(email);
    setCargando(false);
    if (error) {
      mostrarError(error, { onReintentar: enviarCodigo });
      return;
    }
    setPaso('codigo');
    setEspera(ESPERA_REENVIO);
    // Mensaje deliberadamente neutro: no revela si el email tiene cuenta o no.
    mostrarAviso('Revisá tu correo', 'Si ese email tiene una cuenta, te enviamos un código. Mirá también la carpeta de spam.', {
      icono: 'mail-outline',
      duracion: 9000,
    });
  };

  const cambiar = async () => {
    if (!codigo.trim()) {
      mostrarAviso('Falta el código', 'Escribí el código que te llegó por correo.', { icono: 'create-outline' });
      return;
    }
    if (nueva.length < 6) {
      mostrarAviso('Contraseña muy corta', 'Tiene que tener al menos 6 caracteres.', { icono: 'create-outline' });
      return;
    }
    if (nueva !== repetir) {
      mostrarAviso('No coinciden', 'Las dos contraseñas tienen que ser iguales.', { icono: 'create-outline' });
      return;
    }
    setCargando(true);
    const { error } = await restablecerContrasena(email, codigo, nueva);
    setCargando(false);
    if (error) {
      mostrarError(error, { onReintentar: cambiar });
      return;
    }
    // Si salió bien, la sesión ya quedó abierta y la app entra sola. El aviso
    // vive por encima de las pantallas, así que se sigue viendo al entrar.
    mostrarAviso('Contraseña cambiada', 'Ya estás adentro con tu contraseña nueva.', {
      icono: 'checkmark-circle-outline',
    });
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.titulo}>Recuperar contraseña</Text>

        {paso === 'email' ? (
          <>
            <Text style={styles.ayuda}>Escribí tu email y te enviamos un código para elegir una contraseña nueva.</Text>
            <TextInput
              placeholderTextColor="#5F5F5F"
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity style={styles.boton} onPress={enviarCodigo} disabled={cargando}>
              <Text style={styles.botonTexto}>{cargando ? 'Enviando...' : 'Enviarme el código'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.ayuda}>Te enviamos un código a {email.trim()}. Escribilo y elegí tu contraseña nueva.</Text>
            <TextInput
              placeholderTextColor="#5F5F5F"
              style={styles.input}
              placeholder="Código del correo"
              value={codigo}
              onChangeText={(t) => setCodigo(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={10}
            />
            <CampoContrasena
              placeholderTextColor="#5F5F5F"
              style={styles.input}
              placeholder="Contraseña nueva (mín. 6 caracteres)"
              value={nueva}
              onChangeText={setNueva}
              
            />
            <CampoContrasena
              placeholderTextColor="#5F5F5F"
              style={styles.input}
              placeholder="Repetí la contraseña nueva"
              value={repetir}
              onChangeText={setRepetir}
              
            />
            <TouchableOpacity style={styles.boton} onPress={cambiar} disabled={cargando}>
              <Text style={styles.botonTexto}>{cargando ? 'Cambiando...' : 'Cambiar contraseña'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.link} onPress={enviarCodigo} disabled={cargando || espera > 0}>
              <Text style={[styles.linkTexto, (cargando || espera > 0) && { opacity: 0.5 }]}>
                {espera > 0 ? `Pedir otro código (en ${espera} s)` : 'Pedir otro código'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.link}
              onPress={() => {
                setPaso('email');
                setCodigo('');
              }}
            >
              <Text style={styles.linkTexto}>Cambiar el email</Text>
            </TouchableOpacity>
          </>
        )}

        <Link href="/(auth)/login" style={styles.link}>
          <Text style={styles.linkTexto}>Volver a iniciar sesión</Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  titulo: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  ayuda: { fontSize: 16, color: '#3F3F3F', textAlign: 'center', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, color: '#1F1F1F' },
  boton: { backgroundColor: '#1976d2', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  botonTexto: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  link: { marginTop: 20, textAlign: 'center', alignItems: 'center' },
  linkTexto: { fontSize: 16, color: '#1F1F1F', textDecorationLine: 'underline' },
});
