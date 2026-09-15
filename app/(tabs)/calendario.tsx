import { View, Text, StyleSheet } from 'react-native';

export default function Calendario() {
  return (
    <View style={styles.container}>
      <Text style={styles.texto}>Calendario — Próximamente</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  texto: { fontSize: 18, color: '#666' },
});