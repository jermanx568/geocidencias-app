export interface Incidencia {
  id: number;
  title: string;
  desc: string;
  cat: string;
  st: 'pendiente' | 'proceso' | 'resuelto';
  par: string;
  lat: number;
  lng: number;
  date: string;
}