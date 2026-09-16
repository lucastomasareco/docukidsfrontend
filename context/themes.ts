export type TemaId = 'oceano' | 'durazno' | 'lavanda' | 'menta' | 'arcoiris';

export type Tema = {
  id: TemaId;
  name: string;
  // Colores del degradado de fondo, de arriba a abajo.
  backgroundGradient: [string, string];
  card: string;
  primary: string;
  bar: string;
  textPrimary: string;
  textSecondary: string;
};

export const TEMAS: Record<TemaId, Tema> = {
  oceano: {
    id: 'oceano',
    name: 'Océano',
    backgroundGradient: ['#B8E4F0', '#F5ECD7'],
    card: '#F5ECD7',
    primary: '#7DD4D4',
    bar: '#F0F4F5',
    textPrimary: '#5A5A5A',
    textSecondary: '#9A9A9A',
  },
  durazno: {
    id: 'durazno',
    name: 'Durazno',
    backgroundGradient: ['#FADCD5', '#FCEEE8'],
    card: '#FDF5F0',
    primary: '#F4A89A',
    bar: '#FDF0EC',
    textPrimary: '#5A5A5A',
    textSecondary: '#9A9A9A',
  },
  lavanda: {
    id: 'lavanda',
    name: 'Lavanda',
    backgroundGradient: ['#DDD6F3', '#EDE8F8'],
    card: '#EDE8F8',
    primary: '#B8A9D4',
    bar: '#F3EFFB',
    textPrimary: '#5A5A5A',
    textSecondary: '#9A9A9A',
  },
  menta: {
    id: 'menta',
    name: 'Menta',
    backgroundGradient: ['#A8DFF0', '#F0FAFB'],
    card: '#FFFFFF',
    primary: '#7DD4B4',
    bar: '#D4F0F8',
    textPrimary: '#4A4A4A',
    textSecondary: '#8A8A8A',
  },
  arcoiris: {
    id: 'arcoiris',
    name: 'Arcoíris Pastel',
    backgroundGradient: ['#F8D7DA', '#E8D5F0'],
    card: '#F5F0D0',
    primary: '#F4B4B4',
    bar: '#FADADD',
    textPrimary: '#6A6A7A',
    textSecondary: '#A0A0B0',
  },
};

export const TEMA_POR_DEFECTO: TemaId = 'oceano';