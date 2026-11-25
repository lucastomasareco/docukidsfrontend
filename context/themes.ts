export type TemaId =
  | 'oceano'
  | 'lavanda'
  | 'menta'
  | 'arcoiris'
  | 'pizarra'
  | 'azulsobrio'
  | 'durazno'
  | 'atardecer';

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
    textPrimary: '#1F1F1F',
    textSecondary: '#3F3F3F',
  },
  lavanda: {
    id: 'lavanda',
    name: 'Lavanda',
    backgroundGradient: ['#C6B6EE', '#EEF3FB'],
    card: '#F3EEFB',
    primary: '#B8A9D4',
    bar: '#EFE9FB',
    textPrimary: '#1F1F1F',
    textSecondary: '#3F3F3F',
  },
  menta: {
    id: 'menta',
    name: 'Menta',
    backgroundGradient: ['#A9E5C8', '#F7F2D6'],
    card: '#FFFFFF',
    primary: '#7DD4B4',
    bar: '#E3F6EC',
    textPrimary: '#1F1F1F',
    textSecondary: '#3F3F3F',
  },
  arcoiris: {
    id: 'arcoiris',
    name: 'Arcoíris Pastel',
    backgroundGradient: ['#F8D7DA', '#E8D5F0'],
    card: '#F5F0D0',
    primary: '#F4B4B4',
    bar: '#FADADD',
    textPrimary: '#1F1F1F',
    textSecondary: '#3F3F3F',
  },
  pizarra: {
    id: 'pizarra',
    name: 'Pizarra',
    backgroundGradient: ['#CFD8DC', '#F5F7F8'],
    card: '#FFFFFF',
    primary: '#A9B8C0',
    bar: '#ECEFF1',
    textPrimary: '#1F1F1F',
    textSecondary: '#3F3F3F',
  },
  azulsobrio: {
    id: 'azulsobrio',
    name: 'Azul sobrio',
    backgroundGradient: ['#C5D5E8', '#F4F7FB'],
    card: '#FFFFFF',
    primary: '#9FB8D6',
    bar: '#E6EDF6',
    textPrimary: '#1F1F1F',
    textSecondary: '#3F3F3F',
  },
  durazno: {
    id: 'durazno',
    name: 'Durazno',
    backgroundGradient: ['#FFD3BC', '#FFF6E5'],
    card: '#FFF6F0',
    primary: '#FFB997',
    bar: '#FFE8DA',
    textPrimary: '#1F1F1F',
    textSecondary: '#3F3F3F',
  },
  atardecer: {
    id: 'atardecer',
    name: 'Atardecer',
    backgroundGradient: ['#FFD9C0', '#F9C5D8'],
    card: '#FFF5F7',
    primary: '#F7A8B8',
    bar: '#FCDCE4',
    textPrimary: '#1F1F1F',
    textSecondary: '#3F3F3F',
  },
};

export const TEMA_POR_DEFECTO: TemaId = 'oceano';