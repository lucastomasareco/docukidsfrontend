import { useState, createElement as h } from 'react';

// Reloj circular para elegir la hora en la versión de escritorio (web).
// Funciona como el del teléfono: primero se elige la HORA haciendo clic (o
// arrastrando) sobre el círculo; al soltar pasa solo a los MINUTOS. Arriba hay
// botones AM / PM. Usa elementos HTML comunes (div) porque solo se muestra en la web.
//
// El valor entra y sale como texto 'HH:MM' en 24 horas (el mismo formato que usa
// el resto de la app), así que el backend no se entera de nada.

type Modo = 'hora' | 'minuto';

type Props = {
  valor: string; // 'HH:MM' (24 hs)
  onCambiar: (nuevo: string) => void;
  colorPrincipal: string;
};

const TAMANO = 260; // alto y ancho del círculo, en píxeles
const CENTRO = TAMANO / 2;
const RADIO_EXTERNO = 100; // Círculo externo (1-12, 0)
const RADIO_INTERNO = 68;  // Círculo interno (13-23, 12)
const BURBUJA = 38; // diámetro de cada número

const dos = (n: number) => String(n).padStart(2, '0')

// Posición (x, y) dentro del círculo de un ángulo dado.
function posicion(grados: number, radio: number) {
  const rad = (grados * Math.PI) / 180;
  return { x: CENTRO + radio * Math.sin(rad), y: CENTRO - radio * Math.cos(rad) };
}

export default function RelojCircular({ valor, onCambiar, colorPrincipal }: Props) {
  const [modo, setModo] = useState<Modo>('hora');

  const [hh, mm] = valor.split(':').map(Number);
  const h24 = Number.isFinite(hh) ? hh : 9;
  const minuto = Number.isFinite(mm) ? mm : 0

  const poner = (nuevaH24: number, nuevoMin: number) => onCambiar(`${dos(nuevaH24)}:${dos(nuevoMin)}`);

  const elegirDesdeMouse = (e: any) => {
    const caja = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (caja.left + caja.width / 2);
    const dy = e.clientY - (caja.top + caja.height / 2);
    let grados = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (grados < 0) grados += 360;

    const distancia = Math.sqrt(dx * dx + dy * dy);
    // Si está más cerca del centro, pertenece al anillo interno (12-23); si no, al externo (0-11)
    const esAnilloInterno = distancia < (RADIO_EXTERNO + RADIO_INTERNO) / 2;

    if (modo === 'hora') {
      const indice = Math.round(grados / 30) % 12; // 0 para arriba (12 o 0), 1 para la 1, etc.
      let nuevaHora = 0;
      if (esAnilloInterno) {
        // Anillo interno: 12 arriba, luego 13, 14... 23
        nuevaHora = indice === 0 ? 12 : indice + 12;
      } else {
        // Anillo externo: 0 arriba, luego 1, 2... 11
        nuevaHora = indice === 0 ? 0 : indice;
      }
      poner(nuevaHora, minuto);
    } else {
      const nuevoMinuto = Math.round(grados / 6) % 60;
      poner(h24, nuevoMinuto);
    }
  };

  // Cálculo de la posición de la manecilla
  const indiceActual = modo === 'hora' ? (h24 === 0 || h24 === 12 ? 0 : h24 % 12) : Math.round(minuto / 5) % 12;
  const anguloMano = indiceActual * 30;
  
  let radioMano = RADIO_EXTERNO;
  if (modo === 'hora') {
    const esInterno = (h24 >= 13 && h24 <= 23) || h24 === 12;
    radioMano = esInterno ? RADIO_INTERNO : RADIO_EXTERNO;
  }
  
  const punta = posicion(anguloMano, modo === 'hora' ? radioMano : RADIO_EXTERNO);
  const textoMano = modo === 'hora' ? dos(h24) : dos(minuto);

  // Los números del círculo: 1..11 y 12 a 23 para la hora, 00,05,...,55 para los minutos.
  // Generar números de las horas (dos aros)
  const numerosHoras = Array.from({ length: 12 }, (_, i) => {
    const grados = i * 30;
    // Externo: 0 arriba (i=0), 1, 2... 11
    const horaExt = i === 0 ? 0 : i;
    // Interno: 12 arriba (i=0), 13, 14... 23
    const horaInt = i === 0 ? 12 : i + 12;

    const pExt = posicion(grados, RADIO_EXTERNO);
    const pInt = posicion(grados, RADIO_INTERNO);

    return [
      // Número externo
      h('div', {
        key: `ext-${i}`,
        style: {
          position: 'absolute',
          left: pExt.x - BURBUJA / 2,
          top: pExt.y - BURBUJA / 2,
          width: BURBUJA,
          height: BURBUJA,
          lineHeight: `${BURBUJA}px`,
          textAlign: 'center',
          fontSize: 15,
          color: '#1F1F1F',
          pointerEvents: 'none',
        },
      }, String(horaExt)),
      // Número interno
      h('div', {
        key: `int-${i}`,
        style: {
          position: 'absolute',
          left: pInt.x - BURBUJA / 2,
          top: pInt.y - BURBUJA / 2,
          width: BURBUJA,
          height: BURBUJA,
          lineHeight: `${BURBUJA}px`,
          textAlign: 'center',
          fontSize: 13,
          color: '#333333',
          pointerEvents: 'none',
        },
      }, String(horaInt))
    ];
  }).flat();
  // Generar números de los minutos
  // Generar números de los minutos
  const numerosMinutos = Array.from({ length: 12 }, (_, i) => {
    const etiqueta = i * 5;
    const grados = i * 30;
    const p = posicion(grados, RADIO_EXTERNO);
    return h('div', {
      key: `min-${i}`,
      style: {
        position: 'absolute',
        left: p.x - BURBUJA / 2,
        top: p.y - BURBUJA / 2,
        width: BURBUJA,
        height: BURBUJA,
        lineHeight: `${BURBUJA}px`,
        textAlign: 'center',
        fontSize: 15,
        color: '#1F1F1F',
        pointerEvents: 'none',
      },
    }, dos(etiqueta));
  });
  
  const boton = (activo: boolean): any => ({
    cursor: 'pointer',
    userSelect: 'none',
    borderRadius: 10,
    padding: '6px 12px',
    fontSize: 38,
    fontWeight: 500,
    color: '#1F1F1F',
    backgroundColor: activo ? colorPrincipal : 'rgba(0,0,0,0.07)',
  });

  const botonAmPm = (activo: boolean): any => ({
    cursor: 'pointer',
    userSelect: 'none',
    textAlign: 'center',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 15,
    fontWeight: 600,
    color: '#1F1F1F',
    backgroundColor: activo ? colorPrincipal : 'rgba(0,0,0,0.07)',
  });

  return h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
    // ---- Cabecera: HH : MM  y AM / PM ----
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 } },
      h('div', { style: boton(modo === 'hora'), onClick: () => setModo('hora') }, dos(h24)),
      h('div', { style: { fontSize: 38, color: '#1F1F1F' } }, ':'),
      h('div', { style: boton(modo === 'minuto'), onClick: () => setModo('minuto') }, dos(minuto))
    ),
    // ---- El círculo ----
    h(
      'div',
      {
        style: {
          position: 'relative',
          width: TAMANO,
          height: TAMANO,
          borderRadius: '50%',
          backgroundColor: 'rgba(0,0,0,0.07)',
          cursor: 'pointer',
          userSelect: 'none',
          touchAction: 'none',
        },
        onMouseDown: elegirDesdeMouse,
        onMouseMove: (e: any) => {
          if (e.buttons === 1) elegirDesdeMouse(e);
        },
        onMouseUp: () => {
          if (modo === 'hora') setModo('minuto');
        },
      },
      // punto del centro
      h('div', {
        style: {
          position: 'absolute',
          left: CENTRO - 4,
          top: CENTRO - 4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: '#1F1F1F',
          pointerEvents: 'none',
        },
      }),
      // la manecilla
      h('div', {
        style: {
          position: 'absolute',
          left: CENTRO - 1,
          top: CENTRO - RADIO_EXTERNO,
          width: 2,
          height: RADIO_EXTERNO,
          backgroundColor: '#1F1F1F',
          transformOrigin: '50% 100%',
          transform: `rotate(${anguloMano}deg)`,
          pointerEvents: 'none',
        },
      }),
      // burbuja de color en la punta (muestra el valor elegido)
      h(
        'div',
        {
          style: {
            position: 'absolute',
            left: punta.x - BURBUJA / 2,
            top: punta.y - BURBUJA / 2,
            width: BURBUJA,
            height: BURBUJA,
            lineHeight: `${BURBUJA}px`,
            borderRadius: '50%',
            textAlign: 'center',
            fontSize: 17,
            fontWeight: 700,
            color: '#1F1F1F',
            backgroundColor: colorPrincipal,
            pointerEvents: 'none',
          },
        },
        textoMano
      ),
      modo === 'hora' ? numerosHoras : numerosMinutos
    ),
    h(
      'div',
      { style: { marginTop: 10, fontSize: 13, color: '#3F3F3F', textAlign: 'center' } },
      modo === 'hora' ? 'Hacé clic en la hora' : 'Ahora elegí los minutos'
    )
  );
}
