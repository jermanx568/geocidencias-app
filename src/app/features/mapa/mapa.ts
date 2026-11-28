import { Component, AfterViewInit, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import * as L from 'leaflet';
import { IncidenciaService } from '../../core/incidencia.service';
import { ZULIA_BOUNDS, ZULIA_CENTER, dentroDeZulia } from '../../core/zulia';
import { CATEGORIAS, CAT_DEFECTO } from '../../core/categorias';
import { PuntosReferencia } from '../../core/puntos-referencia';


type FiltroEstado = 'todos' | 'pendiente' | 'proceso' | 'resuelto';
@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa.html',
  styleUrl: './mapa.css'
})
export class MapaComponent implements AfterViewInit, OnDestroy {
  private incService = inject(IncidenciaService);
  private map!: L.Map;
  private markersLayer = L.layerGroup();
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private marcadores = new Map<number, L.Marker>();
  private objetivo?: number; // incidencia a abrir (viene de ?inc=ID)

    // Estado de la interfaz
  public panelAbierto = signal(false);
  public filtroEstado = signal<FiltroEstado>('todos');

  public readonly filtros: { valor: FiltroEstado; texto: string; color?: string }[] = [
    { valor: 'todos',     texto: 'Todos' },
    { valor: 'pendiente', texto: 'Pendientes', color: '#dc2626' },
    { valor: 'proceso',   texto: 'En Proceso', color: '#f59e0b' },
    { valor: 'resuelto',  texto: 'Resueltos',  color: '#16a34a' }
  ];

  // Incidencias tras aplicar buscador global + filtro de estado
  public incidencias = computed(() => {
    const base = this.incService.filteredIncidencias();
    const f = this.filtroEstado();
    return f === 'todos' ? base : base.filter((i: any) => i.st === f);
  });

  // Contadores para los botones de filtro (respetan el buscador)
  public conteos = computed<Record<FiltroEstado, number>>(() => {
    const base = this.incService.filteredIncidencias();
    return {
      todos: base.length,
      pendiente: base.filter((i: any) => i.st === 'pendiente').length,
      proceso: base.filter((i: any) => i.st === 'proceso').length,
      resuelto: base.filter((i: any) => i.st === 'resuelto').length
    };
  });

  private estadoInfo: Record<string, { texto: string; color: string }> = {
    pendiente: { texto: 'Pendiente', color: '#dc2626' },
    proceso:   { texto: 'En proceso', color: '#f59e0b' },
    resuelto:  { texto: 'Resuelto', color: '#16a34a' }
  };

  constructor() {
    // Redibuja los pines cuando cambian los datos, el buscador o el filtro
    effect(() => {
      const lista = this.incidencias();
      const buscando = this.incService.busqueda().trim() !== '';
      if (this.map) {
        this.dibujarPines(lista);
        // Si hay texto en el buscador, lleva el mapa a los resultados
        if (buscando && lista.length) this.enfocar(lista);
      }
    });
  }

  // Helpers para la plantilla
  public catDe(cod: string) {
    return CATEGORIAS[cod] ?? CAT_DEFECTO;
  }

  public estadoDe(st: string) {
    return this.estadoInfo[st] ?? this.estadoInfo['pendiente'];
  }

  // Al pulsar una incidencia del panel: centra el mapa, abre su popup y cierra el panel
  public irA(inc: any) {
    const marcador = this.marcadores.get(inc.id);
    if (!marcador) return;
    this.panelAbierto.set(false);
    this.map.setView(marcador.getLatLng(), 17);
    marcador.openPopup();
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  ngAfterViewInit() {
    this.map = L.map('map', {
      zoomControl: false,
      minZoom: 8,
      maxBounds: ZULIA_BOUNDS,
      maxBoundsViscosity: 1.0
    }).setView(ZULIA_CENTER, 13);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    new PuntosReferencia(this.map); // siempre visibles al acercar el mapa
    this.crearLeyenda();

    this.markersLayer.addTo(this.map);

    const idUrl = Number(this.route.snapshot.queryParamMap.get('inc'));
    this.objetivo = idUrl > 0 ? idUrl : undefined;
    this.dibujarPines(this.incidencias());

    this.incService.cargarSesion();

    // Botón "También me afecta" dentro de la tarjeta de la incidencia
    this.map.on('popupopen', (e: L.PopupEvent) => {
      const btn = e.popup.getElement()?.querySelector('.btn-apoyo') as HTMLButtonElement | null;
      if (!btn) return;

      const id = Number(btn.dataset['id']);
      // En tus propias incidencias no se muestra el botón
      if (btn.dataset['uid'] && btn.dataset['uid'] === this.incService.usuarioId()) {
        btn.remove();
        return;
      }

      this.pintarBotonApoyo(btn, this.incService.misApoyos().has(id));
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          const activo = await this.incService.toggleApoyo(id);
          this.pintarBotonApoyo(btn, activo);
        } catch (err: any) {
          alert(err?.message ?? 'No se pudo guardar tu apoyo.');
        } finally {
          btn.disabled = false;
        }
      };
    });

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!dentroDeZulia(e.latlng.lat, e.latlng.lng)) return;
      const { lat, lng } = e.latlng;

      const caja = document.createElement('div');
      caja.style.cssText = 'font-family:system-ui;width:190px';
      caja.innerHTML = '<b style="color:#0f172a">Ubicación seleccionada</b>';

      const btn = document.createElement('button');
      btn.textContent = '📍 Reportar aquí';
      btn.style.cssText = 'margin-top:8px;width:100%;padding:8px;border-radius:10px;border:0;background:#0f766e;color:#fff;font-weight:700;font-size:12px;cursor:pointer';
      btn.onclick = () => {
        this.incService.coordenadasTemporales = { lat, lng };
        this.router.navigate(['/reportar']);
      };
      caja.appendChild(btn);

      L.popup().setLatLng(e.latlng).setContent(caja).openOn(this.map);
    })
  }

    // Centra el mapa en los resultados de la búsqueda
  private enfocar(lista: any[]) {
    if (lista.length === 1) {
      this.map.setView([lista[0].lat, lista[0].lng], 16);
    } else {
      const puntos = lista.map(i => [i.lat, i.lng] as [number, number]);
      this.map.fitBounds(L.latLngBounds(puntos), { padding: [80, 80], maxZoom: 16 });
    }
  }

  private pintarBotonApoyo(btn: HTMLButtonElement, activo: boolean) {
    btn.textContent = activo ? '✓ Lo sigues · toca para dejar de seguir' : '🤝 También me afecta';
    btn.style.background = activo ? '#0f766e' : '#fff';
    btn.style.color = activo ? '#fff' : '#0f766e';
  }

  // Evita que texto escrito por usuarios se interprete como HTML (XSS)
  private esc(t: any): string {
    return String(t ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  }

  private crearLeyenda() {
    const ctrl = new L.Control({ position: 'bottomleft' });

    ctrl.onAdd = () => {
      const div = L.DomUtil.create('div');
      div.style.cssText =
        'background:#fff;border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,.18);padding:10px 12px;font:12px system-ui,sans-serif;color:#334155;min-width:200px;';

      const tipos = Object.values(CATEGORIAS).map(c =>
        `<div style="display:flex;align-items:center;gap:8px;margin:5px 0">
          <span style="width:22px;height:22px;border-radius:50%;background:${c.color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);display:inline-flex;align-items:center;justify-content:center;font-size:11px;box-sizing:border-box">${c.emoji}</span>
          ${c.nombre}
        </div>`).join('');

      const estados = Object.values(this.estadoInfo).map(e =>
        `<span style="display:inline-flex;align-items:center;gap:4px">
          <i style="width:9px;height:9px;border-radius:50%;background:${e.color};display:inline-block"></i>${e.texto}
        </span>`).join('');

      const titulo = 'font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;font-weight:700;margin-top:8px';

      div.innerHTML = `
        <div class="ley-cab" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-weight:700;font-size:13px;color:#0f172a">
          Leyenda <span class="ley-flecha">▾</span>
        </div>
        <div class="ley-cuerpo">
          <div style="${titulo}">Tipo de incidencia</div>
          ${tipos}
          <div style="${titulo}">Estado (punto en el pin)</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px">${estados}</div>
        </div>`;

      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);

      const cuerpo = div.querySelector('.ley-cuerpo') as HTMLElement;
      const flecha = div.querySelector('.ley-flecha') as HTMLElement;
      div.querySelector('.ley-cab')!.addEventListener('click', () => {
        const oculto = cuerpo.style.display === 'none';
        cuerpo.style.display = oculto ? 'block' : 'none';
        flecha.textContent = oculto ? '▾' : '▸';
      });

      return div;
    };

    ctrl.addTo(this.map);
  }

  private dibujarPines(incidencias: any[]) {
    this.markersLayer.clearLayers();
    this.marcadores.clear();

    incidencias.forEach(inc => {
      const est = this.estadoInfo[inc.st] ?? this.estadoInfo['pendiente'];
      const cat = CATEGORIAS[inc.cat] ?? CAT_DEFECTO;
      const categoria = this.esc(inc.cat_nombre || cat.nombre);

      // Pin: color y emoji según el tipo; punto de la esquina según el estado
      const icon = L.divIcon({
        className: 'custom-pin',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html: `<div style="position:relative;width:30px;height:30px">
          <div style="width:30px;height:30px;border-radius:50%;background:${cat.color};border:3px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:14px;box-sizing:border-box">${cat.emoji}</div>
          <span style="position:absolute;right:-3px;bottom:-3px;width:12px;height:12px;border-radius:50%;background:${est.color};border:2px solid #fff;box-sizing:border-box"></span>
        </div>`
      });

      // Barra de progreso del estado
      const pasos = ['pendiente', 'proceso', 'resuelto'];
      const idx = Math.max(0, pasos.indexOf(inc.st));
      const barra = pasos.map((_, i) =>
        `<div style="flex:1;height:6px;border-radius:999px;background:${i <= idx ? est.color : '#e2e8f0'}"></div>`).join('');

      const fotos: string[] = (inc.fotos ?? [])
        .filter((u: string) => /^https:\/\//.test(u))
        .slice(0, 4);

      const galeria = fotos.length
        ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${fotos.map(u =>
            `<a href="${this.esc(u)}" target="_blank" rel="noopener"><img src="${this.esc(u)}" loading="lazy" alt="Evidencia" style="width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0"></a>`
          ).join('')}</div>`
        : '';

      const html = `<div style="font-family:system-ui;width:250px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="width:22px;height:22px;border-radius:50%;background:${cat.color};display:inline-flex;align-items:center;justify-content:center;font-size:12px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);box-sizing:border-box">${cat.emoji}</span>
          <span style="font-size:12px;font-weight:700;color:#0f172a">${categoria}</span>
        </div>
        <h3 style="margin:8px 0 0;font-size:15px;color:#1e293b">${this.esc(inc.title)}</h3>
        <div style="margin-top:8px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px">
          <div style="font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;font-weight:700">Estado de la incidencia</div>
          <div style="display:flex;gap:4px;margin:6px 0 4px">${barra}</div>
          <div style="font-size:13px;font-weight:700;color:${est.color}">● ${est.texto}</div>
        </div>
        <p style="margin:8px 0 0;font-size:12px;color:#64748b">📍 ${this.esc(inc.par)}</p>
        ${inc.descr ? `<p style="margin:6px 0 0;font-size:13px;color:#334155">${this.esc(inc.descr)}</p>` : ''}
        <p style="margin:6px 0 0;font-size:11px;color:#94a3b8">Reportado: ${this.esc(inc.date)}</p>
        ${galeria}
        <button class="btn-apoyo" data-id="${inc.id}" data-uid="${this.esc(inc.user_id ?? '')}" style="margin-top:10px;width:100%;padding:8px;border-radius:10px;border:1px solid #0f766e;background:#fff;color:#0f766e;font-weight:700;font-size:12px;cursor:pointer">🤝 También me afecta</button>
      </div>`;

      const marcador = L.marker([inc.lat, inc.lng], { icon, riseOnHover: true, zIndexOffset: 1000 })
        .addTo(this.markersLayer)
        .bindTooltip(`${cat.emoji} ${categoria}`, { direction: 'top', offset: [0, -16] })
        .bindPopup(html, { maxWidth: 290, offset: [0, -10] });

      this.marcadores.set(inc.id, marcador);
    });

    this.abrirObjetivo();
  }

  // Si se llegó con ?inc=ID, centra el mapa en esa incidencia y abre su tarjeta
  private abrirObjetivo() {
    if (!this.objetivo) return;
    const marcador = this.marcadores.get(this.objetivo);
    if (!marcador) return;
    this.map.setView(marcador.getLatLng(), 17);
    marcador.openPopup();
    this.objetivo = undefined;
  }
}