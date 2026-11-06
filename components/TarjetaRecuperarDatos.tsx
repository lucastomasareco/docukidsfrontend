import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useChildren } from '../context/ChildrenContext';
import { useAvisos } from '../context/AvisosContext';
import {
  buscarCarpetasRecuperables,
  recuperarCarpetas,
  textoDocumentos,
  type CarpetaRecuperable,
} from '../lib/recuperarDatos';

const TEXTO = '#1F1F1F';
const TEXTO_SUAVE = '#3F3F3F';

// Tarjeta "Recuperar datos". Aparece SOLA cuando en el Drive conectado quedaron carpetas de
// una cuenta anterior que ningún hijo tiene vinculadas. Si no hay nada, no se ve.
// Se vuelve a revisar cada vez que la pantalla toma el foco: así, al volver de conectar
// Google en Ajustes, la tarjeta aparece sin tener que reiniciar nada.
export default function TarjetaRecuperarDatos() {
  const { tema } = useTheme();
  const { cargarHijos } = useChildren();
  const { mostrarError, mostrarAviso } = useAvisos();
  const [candidatas, setCandidatas] = useState<CarpetaRecuperable[]>([]);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [recuperando, setRecuperando] = useState(false);
  const [descartada, setDescartada] = useState(false);
  const buscando = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      if (buscando.current || recuperando) return;
      buscando.current = true;
      buscarCarpetasRecuperables()
        .then((lista) => {
          if (!vigente) return;
          setCandidatas(lista);
          // Por defecto todas elegidas; si la persona ya había destildado alguna, se respeta.
          setElegidas((antes) => {
            const nuevas = new Set<string>();
            lista.forEach((c) => {
              if (antes.size === 0 || antes.has(c.drive_folder_id)) nuevas.add(c.drive_folder_id);
            });
            return nuevas;
          });
        })
        .finally(() => {
          buscando.current = false;
        });
      return () => {
        vigente = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const alternar = (id: string) => {
    setElegidas((antes) => {
      const nuevas = new Set(antes);
      if (nuevas.has(id)) nuevas.delete(id);
      else nuevas.add(id);
      return nuevas;
    });
  };

  const recuperar = async () => {
    if (recuperando || elegidas.size === 0) return;
    setRecuperando(true);
    try {
      const r = await recuperarCarpetas(Array.from(elegidas));
      await cargarHijos();
      setCandidatas(await buscarCarpetasRecuperables());
      setElegidas(new Set());
      mostrarAviso(
        'Datos recuperados',
        `Recuperaste ${r.hijos} ${r.hijos === 1 ? 'hijo' : 'hijos'} y ${textoDocumentos(r.documentos)}` +
          (r.vinculados > 0 ? ` (${r.vinculados} vinculado${r.vinculados === 1 ? '' : 's'} a un perfil que ya tenías)` : '') +
          '. Las fechas de vencimiento hay que volver a cargarlas.',
        { icono: 'checkmark-circle-outline', duracion: 9000 }
      );
    } catch (e) {
      // Lo ya recuperado quedó guardado: se refresca la lista y se puede reintentar sin duplicar.
      await cargarHijos();
      setCandidatas(await buscarCarpetasRecuperables());
      mostrarError(e, { que: 'recuperar tus datos', onReintentar: recuperar });
    } finally {
      setRecuperando(false);
    }
  };

  if (descartada || candidatas.length === 0) return null;

  const hayElegidas = elegidas.size > 0;

  return (
    <View
      style={[styles.tarjeta, { backgroundColor: tema.card, borderColor: tema.primary }]}
      accessibilityLabel="Recuperar datos anteriores"
    >
      <View style={styles.cabecera}>
        <View style={[styles.circulo, { backgroundColor: tema.primary }]}>
          <Ionicons name="cloud-download-outline" size={24} color={TEXTO} />
        </View>
        <View style={styles.textos}>
          <Text style={styles.titulo}>Encontramos datos anteriores en tu Drive</Text>
          <Text style={styles.mensaje}>
            Elegí a quién querés recuperar. Se reconectan las carpetas que ya tenés, sin copiar ni duplicar nada.
          </Text>
        </View>
      </View>

      {candidatas.map((c) => {
        const marcada = elegidas.has(c.drive_folder_id);
        return (
          <TouchableOpacity
            key={c.drive_folder_id}
            style={styles.fila}
            onPress={() => alternar(c.drive_folder_id)}
            disabled={recuperando}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marcada, disabled: recuperando }}
            accessibilityLabel={`${c.name}, ${textoDocumentos(c.documents)}`}
          >
            <Ionicons name={marcada ? 'checkbox' : 'square-outline'} size={28} color={TEXTO} />
            <View style={styles.filaTextos}>
              <Text style={styles.nombre}>{c.name}</Text>
              <Text style={styles.detalle}>
                {textoDocumentos(c.documents)}
                {c.folders.length > 0 ? ` · ${c.folders.join(', ')}` : ''}
              </Text>
              {c.match && (
                <Text style={styles.nota}>
                  {c.match.can_link
                    ? `Ya tenés a «${c.match.name}»: se vincula a ese perfil, sin crear uno repetido.`
                    : `Ya tenés a «${c.match.name}» con archivos propios: esto se recupera como «${c.name} - recuperado», sin mezclar nada.`}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={[
          styles.boton,
          { backgroundColor: tema.primary, borderColor: tema.primary },
          (!hayElegidas || recuperando) && styles.botonApagado,
        ]}
        onPress={recuperar}
        disabled={!hayElegidas || recuperando}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Recuperar datos"
        accessibilityState={{ disabled: !hayElegidas || recuperando, busy: recuperando }}
      >
        {recuperando ? (
          <View style={styles.espera}>
            <ActivityIndicator color={TEXTO} />
            <Text style={styles.textoBoton}>Recuperando…</Text>
          </View>
        ) : (
          <Text style={styles.textoBoton}>Recuperar datos</Text>
        )}
      </TouchableOpacity>

      {!recuperando && (
        <TouchableOpacity
          style={styles.botonSecundario}
          onPress={() => setDescartada(true)}
          accessibilityRole="button"
          accessibilityLabel="Ahora no"
        >
          <Text style={styles.textoSecundario}>Ahora no</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { borderWidth: 2, borderRadius: 20, padding: 16, marginBottom: 16 },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  circulo: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1 },
  titulo: { fontSize: 19, fontWeight: 'bold', color: TEXTO },
  mensaje: { fontSize: 16, lineHeight: 22, color: TEXTO_SUAVE, marginTop: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 48 },
  filaTextos: { flex: 1 },
  nombre: { fontSize: 18, fontWeight: 'bold', color: TEXTO },
  detalle: { fontSize: 15, color: TEXTO_SUAVE, marginTop: 2 },
  nota: { fontSize: 15, lineHeight: 21, color: TEXTO, marginTop: 4, fontStyle: 'italic' },
  boton: { marginTop: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 3, alignItems: 'center' },
  botonApagado: { opacity: 0.5 },
  espera: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  textoBoton: { fontSize: 19, fontWeight: 'bold', color: TEXTO },
  botonSecundario: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16, marginTop: 4 },
  textoSecundario: { fontSize: 17, fontWeight: '600', color: TEXTO_SUAVE, textDecorationLine: 'underline' },
});
