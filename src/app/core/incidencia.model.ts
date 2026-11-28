export interface Incidencia {
  id: number;
  title: string;
  descr: string;
  cat: string;
  cat_nombre?: string;
  st: 'pendiente' | 'proceso' | 'resuelto';
  par: string;
  lat: number;
  lng: number;
  date: string;
  fotos?: string[];
  creado_en?: string;
  foto_url?: string;
  user_id?: string;
  moderacion?: 'en_revision' | 'aprobada' | 'rechazada';
  motivo_rechazo?: string | null;
  moderado_en?: string | null;
}