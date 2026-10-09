import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { OpcionesConfirmar } from '../context/AvisosContext';

// Mismo rojo que el botón "No vence" y los botones "Eliminar" de la app.
const ROJO = '#c62828';
const TEXTO = '#1F1F1F';

type Props = {
  opciones: OpcionesConfirmar;
  onResponder: (confirmado: boolean) => void;
};

// Ventana de confirmación. Tocar fuera de ella, o el botón "atrás" de Android,
// cuenta como CANCELAR: nunca confirma por accidente.
export default function VentanaConfirmar({ opciones, onResponder }: Props) {
  const { tema } = useTheme();
  const { titulo, mensaje, peligro = false } = opciones;
  const textoConfirmar = opciones.textoConfirmar ?? 'Aceptar';
  const textoCancelar = opciones.textoCancelar ?? 'Cancelar';
  const icono = opciones.icono ?? (peligro ? 'trash-outline' : 'help-circle-outline');

  const relleno = { backgroundColor: tema.primary, borderColor: tema.primary };
  const soloBorde = { backgroundColor: 'transparent', borderColor: tema.primary };

  const botonConfirmar = (
    <TouchableOpacity
      key="confirmar"
      style={[styles.boton, peligro ? styles.botonRojo : relleno]}
      onPress={() => onResponder(true)}
      activeOpacity={0.8}
      accessibilityLabel={textoConfirmar}
    >
      <Text style={[styles.textoBoton, peligro && { color: '#fff' }]}>{textoConfirmar}</Text>
    </TouchableOpacity>
  );

  const botonCancelar = (
    <TouchableOpacity
      key="cancelar"
      style={[styles.boton, peligro ? relleno : soloBorde]}
      onPress={() => onResponder(false)}
      activeOpacity={0.8}
      accessibilityLabel={textoCancelar}
    >
      <Text style={styles.textoBoton}>{textoCancelar}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onResponder(false)}>
      <Pressable style={styles.fondo} onPress={() => onResponder(false)} accessibilityLabel="Cerrar la ventana">
        {/* El Pressable interior frena el toque para que tocar la tarjeta no la cierre. */}
        <Pressable style={[styles.caja, { backgroundColor: tema.card }]} onPress={() => {}}>
          <View style={[styles.circulo, { backgroundColor: peligro ? '#F8D7DA' : tema.primary }]}>
            <Ionicons name={icono} size={34} color={peligro ? ROJO : TEXTO} />
          </View>
          <Text style={styles.titulo}>{titulo}</Text>
          {mensaje ? <Text style={styles.mensaje}>{mensaje}</Text> : null}

          {/* Peligro: arriba la salida segura (Cancelar), abajo el botón rojo.
              Normal: arriba la acción principal, abajo la alternativa. */}
          <View style={styles.botones}>
            {peligro ? [botonCancelar, botonConfirmar] : [botonConfirmar, botonCancelar]}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  caja: { borderRadius: 24, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 18, alignItems: 'center', elevation: 10 },
  circulo: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: TEXTO, textAlign: 'center' },
  mensaje: { fontSize: 17, lineHeight: 24, color: '#3F3F3F', textAlign: 'center', marginTop: 8 },
  botones: { alignSelf: 'stretch', marginTop: 8 },
  boton: { paddingVertical: 15, borderRadius: 12, borderWidth: 3, alignItems: 'center', marginTop: 12 },
  botonRojo: { backgroundColor: ROJO, borderColor: ROJO },
  textoBoton: { fontSize: 19, fontWeight: 'bold', color: TEXTO },
});
