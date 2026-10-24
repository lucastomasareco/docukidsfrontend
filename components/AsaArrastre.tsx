import { useRef } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onInicio: () => void;
  // dy = cuánto se movió el dedo hacia abajo (negativo = hacia arriba) desde que empezó.
  onMover: (dy: number) => void;
  // cancelado = true si el sistema le quitó el gesto (no se debe mover nada).
  onSoltar: (dy: number, cancelado: boolean) => void;
};

// Ícono ≡ que se agarra para arrastrar un documento. Solo este ícono detecta el arrastre,
// así tocar o mantener presionado el resto de la tarjeta sigue funcionando como siempre.
// Solo en la versión web (escritorio): al arrastrar con el mouse, el navegador podría ir
// seleccionando texto de la pantalla. Se desactiva mientras dura el arrastre.
function bloquearSeleccionWeb(bloquear: boolean) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.body.style.userSelect = bloquear ? 'none' : '';
  }
}

// Estilos que solo existen en la web: manito de "agarrar" y no dejar que el navegador
// interprete el dedo/mouse como desplazamiento de la página.
const ESTILO_WEB: any = Platform.OS === 'web' ? { cursor: 'grab', userSelect: 'none', touchAction: 'none' } : null;

export default function AsaArrastre({ onInicio, onMover, onSoltar }: Props) {
  // El PanResponder se crea una sola vez; por eso lee siempre las funciones más nuevas desde acá.
  const ultimas = useRef({ onInicio, onMover, onSoltar });
  ultimas.current = { onInicio, onMover, onSoltar };

  const gesto = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Una vez agarrado, la lista no puede quitarle el gesto (si no, se pondría a desplazarse).
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        bloquearSeleccionWeb(true);
        ultimas.current.onInicio();
      },
      onPanResponderMove: (_e, g) => ultimas.current.onMover(g.dy),
      onPanResponderRelease: (_e, g) => {
        bloquearSeleccionWeb(false);
        ultimas.current.onSoltar(g.dy, false);
      },
      onPanResponderTerminate: (_e, g) => {
        bloquearSeleccionWeb(false);
        ultimas.current.onSoltar(g.dy, true);
      },
    })
  ).current;

  return (
    <View
      {...gesto.panHandlers}
      style={[styles.asa, ESTILO_WEB]}
      accessibilityLabel="Arrastrar para mover o reordenar"
      accessibilityRole="button"
    >
      <Ionicons name="reorder-three-outline" size={28} color="#3F3F3F" />
    </View>
  );
}

const styles = StyleSheet.create({
  asa: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
});
