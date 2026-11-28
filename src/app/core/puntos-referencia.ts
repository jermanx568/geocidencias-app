import * as L from 'leaflet';

export interface PuntoRef {
  nombre: string;
  tipo: string;
  lat: number;
  lng: number;
}

const AMENITY = 'hospital|clinic|pharmacy|school|university|bank|police|fire_station|fuel|restaurant|marketplace|townhall|bus_station';
const SHOP = 'supermarket|mall|convenience|bakery|department_store';

// clave de OpenStreetMap -> [emoji, etiqueta]
const TIPOS: Record<string, [string, string]> = {
  hospital: ['🏥', 'Hospital'],
  clinic: ['🏥', 'Clínica'],
  pharmacy: ['💊', 'Farmacia'],
  school: ['🏫', 'Escuela'],
  university: ['🎓', 'Universidad'],
  bank: ['🏦', 'Banco'],
  police: ['👮', 'Policía'],
  fire_station: ['🚒', 'Bomberos'],
  fuel: ['⛽', 'Estación de servicio'],
  restaurant: ['🍽️', 'Restaurante'],
  marketplace: ['🛒', 'Mercado'],
  townhall: ['🏛️', 'Alcaldía'],
  bus_station: ['🚌', 'Terminal'],
  supermarket: ['🛒', 'Supermercado'],
  mall: ['🛍️', 'Centro comercial'],
  convenience: ['🏪', 'Tienda'],
  bakery: ['🥖', 'Panadería'],
  department_store: ['🛍️', 'Tienda por departamentos']
};

function esc(t: any): string {
  return String(t ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/**
 * Dibuja puntos de referencia discretos (por debajo de las incidencias).
 * Solo carga datos con zoom >= 15 para no saturar el mapa ni el servicio.
 */
export class PuntosReferencia {
  private capa = L.layerGroup();
  private activo = true;
  private ultimo?: L.LatLngBounds;
  private timer?: ReturnType<typeof setTimeout>;
  private abort?: AbortController;

  constructor(private map: L.Map, private alSeleccionar?: (p: PuntoRef) => void) {
    this.capa.addTo(map);
    map.on('moveend', () => this.programar());
    this.programar();
  }

  mostrar(visible: boolean) {
    this.activo = visible;
    if (!visible) {
      this.abort?.abort();
      this.capa.clearLayers();
      this.ultimo = undefined;
    } else {
      this.programar();
    }
  }

  private programar() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.cargar(), 600);
  }

  private async cargar() {
    if (!this.activo) return;
    if (this.map.getZoom() < 15) {
      this.capa.clearLayers();
      this.ultimo = undefined;
      return;
    }

    const vista = this.map.getBounds();
    if (this.ultimo?.contains(vista)) return; // ya cargado esta zona

    const b = vista.pad(0.3);
    const bbox = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
    const consulta =
      `[out:json][timeout:20];(` +
      `nwr["amenity"~"^(${AMENITY})$"]["name"](${bbox});` +
      `nwr["shop"~"^(${SHOP})$"]["name"](${bbox});` +
      `);out center 150;`;

    this.abort?.abort();
    this.abort = new AbortController();

    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(consulta),
        signal: this.abort.signal
      });
      if (!r.ok) return;
      const data = await r.json();
      this.ultimo = b;
      this.dibujar(data.elements ?? []);
    } catch {
      // cancelado o sin conexión: se intentará en el próximo movimiento
    }
  }

  private dibujar(elementos: any[]) {
    this.capa.clearLayers();

    for (const e of elementos) {
      const lat = e.lat ?? e.center?.lat;
      const lng = e.lon ?? e.center?.lon;
      const tags = e.tags ?? {};
      const info = TIPOS[tags.amenity ?? tags.shop];
      if (lat == null || lng == null || !tags.name || !info) continue;

      const punto: PuntoRef = { nombre: tags.name, tipo: info[1], lat, lng };

      const icon = L.divIcon({
        className: 'ref-pin',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        html: `<div style="width:20px;height:20px;border-radius:50%;background:#fff;border:1.5px solid #94a3b8;display:flex;align-items:center;justify-content:center;font-size:11px;box-sizing:border-box;opacity:.92;box-shadow:0 1px 3px rgba(0,0,0,.25)">${info[0]}</div>`
      });

      L.marker([lat, lng], { icon, zIndexOffset: -1000, keyboard: false })
        .bindTooltip(`${esc(punto.nombre)}<br><span style="color:#64748b">${esc(punto.tipo)}</span>`, {
          direction: 'top',
          offset: [0, -10]
        })
        .on('click', () => this.alSeleccionar?.(punto))
        .addTo(this.capa);
    }
  }
}