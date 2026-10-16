import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Carpeta, SUELTO } from '../lib/carpetas';

const TEXTO = '#1F1F1F';

type Props = {
  etiqueta: string;
  carpetas: Carpeta[];
  valor: string; // id de carpeta o SUELTO
  onCambiar: (id: string) => void;
};

// Botoncitos para elegir en qué carpeta va un documento (al subirlo o al editarlo).
// La última opción es "Suelto": el documento queda siempre a la vista, fuera de las carpetas.
export default function SelectorCarpeta({ etiqueta, carpetas, valor, onCambiar }: Props) {
  const { tema } = useTheme();
  const opciones = [...carpetas.map((c) => ({ id: c.id, nombre: c.nombre })), { id: SUELTO, nombre: 'Suelto (a la vista)' }];

  return (
    <View style={styles.bloque}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <View style={styles.fila}>
        {opciones.map((o) => {
          const elegida = o.id === valor;
          return (
            <TouchableOpacity
              key={o.id}
              onPress={() => onCambiar(o.id)}
              activeOpacity={0.7}
              style={[
                styles.opcion,
                { borderColor: tema.primary },
                elegida && { backgroundColor: tema.primary },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: elegida }}
              accessibilityLabel={o.nombre}
            >
              <Text style={[styles.texto, elegida && styles.textoElegido]}>{o.nombre}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: 12 },
  etiqueta: { fontSize: 14, fontWeight: '600', color: '#3F3F3F', marginBottom: 6 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcion: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1.5 },
  texto: { fontSize: 14, color: TEXTO },
  textoElegido: { fontWeight: 'bold' },
});
