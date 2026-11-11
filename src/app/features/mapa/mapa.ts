import { Component, AfterViewInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { IncidenciaService } from '../../core/incidencia.service';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa.html',
  styleUrl: './mapa.css'
})
export class MapaComponent implements AfterViewInit {
  private incService = inject(IncidenciaService);
  private map!: L.Map;
  private markersLayer = L.layerGroup();
  
  // 1. Declaramos el Signal que el HTML está buscando
  public incidencias = signal<any[]>([]);

  constructor() {
    // 2. Usamos un effect para escuchar los cambios del servicio
    effect(() => {
      const filtradas = this.incService.filteredIncidencias();
      this.incidencias.set(filtradas); // Actualizamos el Signal local
      
      if (this.map) {
        this.dibujarPines(filtradas);
      }
    });
  }

  ngAfterViewInit() {
    this.map = L.map('map', { zoomControl: false }).setView([10.6500, -71.6300], 13);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.markersLayer.addTo(this.map);
    this.dibujarPines(this.incService.filteredIncidencias());

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.incService.coordenadasTemporales = { lat: e.latlng.lat, lng: e.latlng.lng };
      L.popup()
        .setLatLng(e.latlng)
        .setContent("<b>Ubicación seleccionada</b><br>Ve a 'Reportar Incidencia' para guardar.")
        .openOn(this.map);
    });
  }

  private dibujarPines(incidencias: any[]) {
    this.markersLayer.clearLayers();
    incidencias.forEach(inc => {
      const color = inc.st === 'pendiente' ? '#dc2626' : inc.st === 'proceso' ? '#f59e0b' : '#16a34a';
      const icon = L.divIcon({
        className: 'custom-pin',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.3); position: relative;"><div style="background: white; width: 6px; height: 6px; border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div></div>`
      });
      L.marker([inc.lat, inc.lng], { icon }).addTo(this.markersLayer)
        .bindPopup(`<div style="font-family: system-ui; padding: 4px;"><h3 style="margin: 0 0 4px 0; font-size: 14px; color: #1e293b;">${inc.title}</h3><p style="margin: 0; font-size: 12px; color: #64748b;">📍 ${inc.par}</p></div>`);
    });
  }
}