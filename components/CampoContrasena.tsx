import { forwardRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, TextInputProps, StyleProp, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Campo de contraseña con ojito para mostrar/ocultar lo escrito.
// Recibe el mismo estilo (`style`) que tendría un TextInput normal.
type Props = Omit<TextInputProps, 'secureTextEntry' | 'style'> & { style?: StyleProp<TextStyle> };

// forwardRef: así las pantallas pueden pasar el foco a este campo con Enter.
const CampoContrasena = forwardRef<TextInput, Props>(function CampoContrasena({ style, ...resto }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.contenedor}>
      <TextInput
        ref={ref}
        placeholderTextColor="#5F5F5F"
        autoCapitalize="none"
        autoCorrect={false}
        {...resto}
        style={[style, styles.input]}
        secureTextEntry={!visible}
      />
      <TouchableOpacity
        style={styles.ojo}
        onPress={() => setVisible((v) => !v)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color="#3F3F3F" />
      </TouchableOpacity>
    </View>
  );
});

export default CampoContrasena;

const styles = StyleSheet.create({
  contenedor: { justifyContent: 'center' },
  input: { paddingRight: 44 },
  ojo: { position: 'absolute', right: 12, top: 0, bottom: 12, justifyContent: 'center' },
});
