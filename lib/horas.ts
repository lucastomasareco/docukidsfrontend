// Hora en palabras, para que nadie tenga que adivinar si "12" es de la mañana o de la noche.
// Entrada: 'HH:MM' (24 hs, como se guarda). Salida: "3:30 de la tarde (15:30)".
// Solo cambia lo que se MUESTRA; lo que se guarda en el turno sigue siendo 'HH:MM'.
// Retorna la hora tal cual en formato de 24 horas (ej. "23:00")
export function horaEnPalabras(hhmm: string): string {
  if (!hhmm) return '';
  return hhmm;
}
