// Hora en palabras, para que nadie tenga que adivinar si "12" es de la mañana o de la noche.
// Entrada: 'HH:MM' (24 hs, como se guarda). Salida: "3:30 de la tarde (15:30)".
// Solo cambia lo que se MUESTRA; lo que se guarda en el turno sigue siendo 'HH:MM'.
export function horaEnPalabras(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const minutos = String(m).padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;

  let momento: string;
  if (h === 12) momento = 'del mediodía';
  else if (h === 0) momento = 'de la medianoche';
  else if (h >= 5 && h < 12) momento = 'de la mañana';
  else if (h > 12 && h < 20) momento = 'de la tarde';
  else momento = 'de la noche';

  return `${h12}:${minutos} ${momento} (${String(h).padStart(2, '0')}:${minutos})`;
}
