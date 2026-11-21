import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PropsMapa } from './MapaLugar';

// Mapa interactivo (Leaflet + OpenStreetMap). Sin API key ni cuenta.
//  - Se puede arrastrar y hacer zoom (botones +/− y doble clic).
//  - Modo editable: tocar el mapa coloca el pin y el pin se puede arrastrar.
//  - Modo solo lectura: se puede mirar y moverse, pero no cambia el lugar.
// "© OpenStreetMap" lo pone Leaflet abajo a la derecha: la licencia exige dejarlo visible.

const CENTRO_POR_DEFECTO: [number, number] = [-34.6037, -58.3816]; // Buenos Aires
const ZOOM_SIN_PIN = 12;
const ZOOM_CON_PIN = 16;

// Pin dibujado con HTML/SVG propio: los íconos por defecto de Leaflet se rompen al empaquetar para la web.
const ICONO_PIN = L.divIcon({
  className: 'pin-docukids',
  html:
    '<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))">' +
    '<path d="M16 1C8 1 1.5 7.3 1.5 15.2 1.5 26 16 41 16 41S30.5 26 30.5 15.2C30.5 7.3 24 1 16 1z" fill="#d32f2f" stroke="#fff" stroke-width="2"/>' +
    '<circle cx="16" cy="15" r="5.5" fill="#fff"/></svg>',
  iconSize: [32, 42],
  iconAnchor: [16, 41], // la punta del pin queda exactamente sobre el punto
});

export default function MapaLugar({ lat, lon, editable = false, onElegir, enfocar = 0, altura = 240 }: PropsMapa) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  // Siempre la última versión de lo que llega por props, para que los eventos de Leaflet
  // (que se crean una sola vez) no se queden con valores viejos.
  const ultimo = useRef({ lat, lon, editable, onElegir });
  ultimo.current = { lat, lon, editable, onElegir };

  // Crear el mapa una sola vez.
  useEffect(() => {
    const div = contenedor.current;
    if (!div || mapa.current) return;

    const { lat: lat0, lon: lon0 } = ultimo.current;
    const hay = lat0 !== null && lon0 !== null;
    const m = L.map(div, {
      center: hay ? [lat0 as number, lon0 as number] : CENTRO_POR_DEFECTO,
      zoom: hay ? ZOOM_CON_PIN : ZOOM_SIN_PIN,
      scrollWheelZoom: false, // la rueda sigue desplazando el formulario; se usa +/− o doble clic
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(m);

    m.on('click', (e: L.LeafletMouseEvent) => {
      const { editable: puedeEditar, onElegir: elegir } = ultimo.current;
      if (puedeEditar && elegir) elegir(e.latlng.lat, e.latlng.lng);
    });
    mapa.current = m;

    // Si el contenedor cambia de tamaño (se abre el formulario, se agranda la ventana), Leaflet tiene que enterarse.
    const observador = new ResizeObserver(() => m.invalidateSize());
    observador.observe(div);
    const t = setTimeout(() => m.invalidateSize(), 150);

    return () => {
      clearTimeout(t);
      observador.disconnect();
      m.remove();
      mapa.current = null;
      pin.current = null;
    };
  }, []);

  // Poner, mover o quitar el pin cuando cambian las coordenadas.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (lat === null || lon === null) {
      if (pin.current) {
        pin.current.remove();
        pin.current = null;
      }
      return;
    }
    const punto = L.latLng(lat, lon);
    if (!pin.current) {
      const marcador = L.marker(punto, { icon: ICONO_PIN, draggable: editable, keyboard: false }).addTo(m);
      marcador.on('dragend', () => {
        const { onElegir: elegir } = ultimo.current;
        const p = marcador.getLatLng();
        if (elegir) elegir(p.lat, p.lng);
      });
      pin.current = marcador;
    } else {
      pin.current.setLatLng(punto);
    }
    // Si el pin quedó fuera de lo que se ve, el mapa va hacia él.
    if (!m.getBounds().contains(punto)) m.setView(punto, Math.max(m.getZoom(), ZOOM_CON_PIN));
  }, [lat, lon, editable]);

  // Centrar y acercar el mapa cuando la pantalla lo pide (elegir un resultado de la búsqueda).
  useEffect(() => {
    const m = mapa.current;
    const { lat: la, lon: lo } = ultimo.current;
    if (!m || enfocar === 0 || la === null || lo === null) return;
    m.setView([la, lo], ZOOM_CON_PIN);
  }, [enfocar]);

  // Un <div> común (no un View): Leaflet necesita un elemento del navegador.
  return (
    <div
      ref={contenedor}
      role="application"
      aria-label={editable ? 'Mapa: tocá para marcar el lugar' : 'Mapa del lugar'}
      style={{ height: altura, width: '100%', borderRadius: 10, overflow: 'hidden', zIndex: 0 }}
    />
  );
}
