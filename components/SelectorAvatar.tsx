import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform, Linking, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAvisos } from '../context/AvisosContext';
import { validarAvatar, prepararAvatar, MAX_AVATAR_MB, type AvatarElegido } from '../lib/avatar';

// Selector de foto de perfil con vista previa redonda en tiempo real (issue #36).
// No guarda nada: solo le avisa a la pantalla qué foto se eligió (onCambiar).
type Props = {
  nombre: string; // para la inicial cuando todavía no hay foto
  valor: AvatarElegido | null;
  onCambiar: (avatar: AvatarElegido | null) => void;
  deshabilitado?: boolean;
  tamano?: number;
};

export default function SelectorAvatar({ nombre, valor, onCambiar, deshabilitado, tamano = 96 }: Props) {
  const { tema } = useTheme();
  const { mostrarAviso } = useAvisos();
  const [abriendo, setAbriendo] = useState(false);
  const enWeb = Platform.OS === 'web';

  const procesar = async (resultado: ImagePicker.ImagePickerResult) => {
    if (resultado.canceled || resultado.assets.length === 0) return;
    const asset = resultado.assets[0];
    const problema = validarAvatar(asset);
    if (problema) {
      mostrarAviso('No pudimos usar esa foto', problema, { icono: 'image-outline' });
      return;
    }
    try {
      onCambiar(await prepararAvatar(asset)); // recorta y reduce a 256 px
    } catch {
      mostrarAviso('No pudimos preparar la foto', 'Probá con otra imagen.', { icono: 'image-outline' });
    }
  };

  const sinPermiso = (que: string, icono: 'images-outline' | 'camera-outline') =>
    mostrarAviso('Permiso necesario', `Docukids necesita acceso a ${que} para poner la foto.`, {
      icono,
      etiquetaAccion: enWeb ? undefined : 'Abrir ajustes del teléfono',
      onAccion: enWeb ? undefined : () => Linking.openSettings(),
    });

  const opciones: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true, // en el celular deja recortar en cuadrado
    aspect: [1, 1],
    quality: 0.8,
  };

  const elegirDeGaleria = async () => {
    setAbriendo(true);
    try {
      const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) return sinPermiso('tus fotos', 'images-outline');
      await procesar(await ImagePicker.launchImageLibraryAsync(opciones));
    } finally {
      setAbriendo(false);
    }
  };

  const sacarFoto = async () => {
    setAbriendo(true);
    try {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) return sinPermiso('la cámara', 'camera-outline');
      await procesar(await ImagePicker.launchCameraAsync(opciones));
    } finally {
      setAbriendo(false);
    }
  };

  const bloqueado = deshabilitado || abriendo;
  const inicial = nombre.trim().charAt(0).toUpperCase();

  return (
    <View style={styles.contenedor}>
      <TouchableOpacity
        onPress={elegirDeGaleria}
        disabled={bloqueado}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={valor ? 'Cambiar la foto de perfil' : 'Elegir una foto de perfil'}
        style={[
          styles.circulo,
          { width: tamano, height: tamano, borderRadius: tamano / 2, borderColor: tema.primary },
          !valor && { backgroundColor: '#E6E6E6' },
        ]}
      >
        {abriendo ? (
          <ActivityIndicator color="#1F1F1F" />
        ) : valor ? (
          <Image
            source={{ uri: valor.dataUri }}
            style={{ width: tamano, height: tamano, borderRadius: tamano / 2 }}
            resizeMode="cover"
            accessibilityLabel="Vista previa de la foto de perfil"
          />
        ) : inicial ? (
          <Text style={[styles.inicial, { fontSize: tamano * 0.42 }]}>{inicial}</Text>
        ) : (
          <Ionicons name="person-outline" size={tamano * 0.5} color="#5F5F5F" />
        )}
        <View style={[styles.camarita, { backgroundColor: tema.primary }]}>
          <Ionicons name="camera" size={18} color="#1F1F1F" />
        </View>
      </TouchableOpacity>

      <View style={styles.acciones}>
        <TouchableOpacity onPress={elegirDeGaleria} disabled={bloqueado} style={styles.accion}>
          <Ionicons name="images-outline" size={18} color="#1F1F1F" />
          <Text style={styles.accionTexto}>{valor ? 'Cambiar foto' : 'Elegir foto'}</Text>
        </TouchableOpacity>
        {!enWeb && (
          <TouchableOpacity onPress={sacarFoto} disabled={bloqueado} style={styles.accion}>
            <Ionicons name="camera-outline" size={18} color="#1F1F1F" />
            <Text style={styles.accionTexto}>Sacar foto</Text>
          </TouchableOpacity>
        )}
        {valor && (
          <TouchableOpacity onPress={() => onCambiar(null)} disabled={bloqueado} style={styles.accion}>
            <Ionicons name="trash-outline" size={18} color="#c62828" />
            <Text style={[styles.accionTexto, { color: '#c62828' }]}>Quitar</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.ayuda}>PNG, JPG o WEBP · máximo {MAX_AVATAR_MB} MB · opcional</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { alignItems: 'center', marginBottom: 14 },
  circulo: { borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  inicial: { color: '#1F1F1F', fontWeight: 'bold' },
  camarita: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 12 },
  accion: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 6 },
  accionTexto: { fontSize: 15, fontWeight: '600', color: '#1F1F1F' },
  ayuda: { fontSize: 13, color: '#3F3F3F', marginTop: 2 },
});
