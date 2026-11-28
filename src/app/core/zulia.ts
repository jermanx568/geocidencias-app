export const ZULIA_BOUNDS: [[number, number], [number, number]] = [
  [8.2, -73.4],   // suroeste (aprox.)
  [11.9, -70.6]   // noreste (aprox.)
];

export const ZULIA_CENTER: [number, number] = [10.65, -71.63];

export function dentroDeZulia(lat: number, lng: number): boolean {
  const [[sur, oeste], [norte, este]] = ZULIA_BOUNDS;
  return lat >= sur && lat <= norte && lng >= oeste && lng <= este;
}