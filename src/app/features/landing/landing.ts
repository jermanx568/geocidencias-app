import { Component, inject, computed, signal } from '@angular/core';
import { IncidenciaService } from '../../core/incidencia.service';
import { RouterLink } from '@angular/router';
import { CATEGORIAS } from '../../core/categorias';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.html'
})
export class LandingComponent {
  private inc = inject(IncidenciaService);
  sesionLista = signal(false);
  haySesion = computed(() => !!this.inc.usuarioId());

  constructor() {
    this.inc.cargarSesion().then(() => this.sesionLista.set(true));
  }

  categorias = Object.values(CATEGORIAS);

  pasos = [
    { n: 1, icono: '📍', titulo: 'Ubica el problema', texto: 'Busca la dirección o toca el mapa. Solo se aceptan ubicaciones dentro del estado Zulia.' },
    { n: 2, icono: '📸', titulo: 'Repórtalo con evidencia', texto: 'Elige el tipo de incidencia, describe lo que ocurre y adjunta hasta 4 fotos.' },
    { n: 3, icono: '📊', titulo: 'Sigue su avance', texto: 'Cada reporte pasa por Pendiente, En proceso y Resuelto, y queda su historial.' }
  ];

  invitado = [
    'Explorar el mapa de incidencias',
    'Ver detalles, estado y fotos de cada reporte',
    'Buscar y filtrar por estado'
  ];

  conCuenta = [
    'Todo lo del modo invitado',
    'Reportar nuevas incidencias con fotos',
    'Marcar «También me afecta» en reportes de otros',
    'Seguir tus reportes en Mis Seguimientos y exportarlos'
  ];
}