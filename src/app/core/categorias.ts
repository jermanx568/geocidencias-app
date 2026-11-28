export interface CatInfo {
  color: string;
  emoji: string;
  nombre: string;
}

// La clave debe ser igual al "codigo" de la tabla categorias y al value del select de reportar.html
export const CATEGORIAS: Record<string, CatInfo> = {
  agua:      { color: '#2563eb', emoji: '💧', nombre: 'Agua y Saneamiento' },
  electrico: { color: '#eab308', emoji: '⚡', nombre: 'Falla Eléctrica' },
  gas:       { color: '#dc2626', emoji: '🔥', nombre: 'Falla de Gas' },
  residuos:  { color: '#92400e', emoji: '🗑️', nombre: 'Aseo Urbano' },
  alumbrado: { color: '#7c3aed', emoji: '💡', nombre: 'Alumbrado Público' },
  vialidad:  { color: '#f97316', emoji: '🚧', nombre: 'Vialidad / Baches' }
};

export const CAT_DEFECTO: CatInfo = { color: '#64748b', emoji: '📍', nombre: 'Otros' };