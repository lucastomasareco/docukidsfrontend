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
const RADIO = 100; // distancia del centro a los números
const BURBUJA = 38; // diámetro de cada número

const dos = (n: number) => String(n).padStart(2, '0');

// Ángulo en grados (0 = arriba, sube hacia la derecha) -> hora 1..12 o minuto 0..59.
export function datoDesdeAngulo(modo: Modo, grados: number): number {
  const g = ((grados % 360) + 360) % 360;
  if (modo === 'hora') return Math.round(g / 30) % 12 || 12;
  return Math.round(g / 6) % 60;
}

// Posición (x, y) dentro del círculo de un ángulo dado.
function posicion(grados: number, radio: number) {
  const rad = (grados * Math.PI) / 180;
  return { x: CENTRO + radio * Math.sin(rad), y: CENTRO - radio * Math.cos(rad) };
}

export default function RelojCircular({ valor, onCambiar, colorPrincipal }: Props) {
  const [modo, setModo] = useState<Modo>('hora');

  const [hh, mm] = valor.split(':').map(Number);
  const h24 = Number.isFinite(hh) ? hh : 9;
  const minuto = Number.isFinite(mm) ? mm : 0;
  const esPM = h24 >= 12;
  const h12 = h24 % 12 || 12;

  const poner = (nuevaH24: number, nuevoMin: number) => onCambiar(`${dos(nuevaH24)}:${dos(nuevoMin)}`);

  const elegirDesdeMouse = (e: any) => {
    const caja = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (caja.left + caja.width / 2);
    const dy = e.clientY - (caja.top + caja.height / 2);
    let grados = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (grados < 0) grados += 360;
    const dato = datoDesdeAngulo(modo, grados);
    if (modo === 'hora') poner((dato % 12) + (esPM ? 12 : 0), minuto);
    else poner(h24, dato);
  };

  const anguloMano = modo === 'hora' ? (h12 % 12) * 30 : minuto * 6;
  const textoMano = modo === 'hora' ? String(h12) : dos(minuto);
  const punta = posicion(anguloMano, RADIO);

  // Los números del círculo: 1..12 para la hora, 00,05,...,55 para los minutos.
  const numeros = Array.from({ length: 12 }, (_, i) => {
    const etiqueta = modo === 'hora' ? (i === 0 ? 12 : i) : i * 5;
    const grados = i * 30;
    const p = posicion(grados, RADIO);
    return h(
      'div',
      {
        key: i,
        style: {
          position: 'absolute',
          left: p.x - BURBUJA / 2,
          top: p.y - BURBUJA / 2,
          width: BURBUJA,
          height: BURBUJA,
          lineHeight: `${BURBUJA}px`,
          textAlign: 'center',
          fontSize: 17,
          color: '#1F1F1F',
          pointerEvents: 'none',
        },
      },
      modo === 'hora' ? String(etiqueta) : dos(etiqueta as number)
    );
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
      h('div', { style: boton(modo === 'hora'), onClick: () => setModo('hora') }, dos(h12)),
      h('div', { style: { fontSize: 38, color: '#1F1F1F' } }, ':'),
      h('div', { style: boton(modo === 'minuto'), onClick: () => setModo('minuto') }, dos(minuto)),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 6 } },
        h('div', { style: botonAmPm(!esPM), onClick: () => poner(esPM ? h24 - 12 : h24, minuto) }, 'AM'),
        h('div', { style: botonAmPm(esPM), onClick: () => poner(esPM ? h24 : h24 + 12, minuto) }, 'PM')
      )
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
          top: CENTRO - RADIO,
          width: 2,
          height: RADIO,
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
      ...numeros.filter((_, i) => {
        // no repetir el número que ya tapa la burbuja de color
        const dato = modo === 'hora' ? (i === 0 ? 12 : i) : i * 5;
        return !(dato === (modo === 'hora' ? h12 : minuto));
      })
    ),
    h(
      'div',
      { style: { marginTop: 10, fontSize: 13, color: '#3F3F3F', textAlign: 'center' } },
      modo === 'hora' ? 'Hacé clic en la hora' : 'Ahora elegí los minutos'
    )
  );
}
