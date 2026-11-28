import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IncidenciaService, GestionItem } from '../../core/incidencia.service';
import { CATEGORIAS, CAT_DEFECTO, CatInfo } from '../../core/categorias';

type FiltroEstado = 'todos' | 'pendiente' | 'proceso' | 'resuelto';
type Orden = 'recientes' | 'antiguos' | 'apoyos';
type Vista = 'por_revisar' | 'publicadas' | 'rechazadas';

const ESTADOS = [
  { id: 'pendiente', texto: 'Pendiente', color: '#dc2626', fondo: '#fef2f2' },
  { id: 'proceso', texto: 'En proceso', color: '#f59e0b', fondo: '#fffbeb' },
  { id: 'resuelto', texto: 'Resuelto', color: '#16a34a', fondo: '#f0fdf4' }
];

@Component({
  selector: 'app-gestion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gestion.html',
  styleUrl: './gestion.css'
})
export class GestionComponent implements OnInit {
  private incService = inject(IncidenciaService);
  private router = inject(Router);

  readonly estados = ESTADOS;

  todos = signal<GestionItem[]>([]);
  // "items" son solo las aprobadas: los KPIs, filtros y la tabla actual siguen igual
  items = computed(() => this.todos().filter(i => i.moderacion === 'aprobada'));
  porRevisar = computed(() => this.todos().filter(i => i.moderacion === 'en_revision'));
  rechazadas = computed(() => this.todos().filter(i => i.moderacion === 'rechazada'));

  vista = signal<Vista>('por_revisar');
  pestanas = computed(() => [
    { id: 'por_revisar' as Vista, texto: 'Por revisar', n: this.porRevisar().length },
    { id: 'publicadas' as Vista, texto: 'Publicadas', n: this.items().length },
    { id: 'rechazadas' as Vista, texto: 'Rechazadas', n: this.rechazadas().length }
  ]);
  listaModeracion = computed(() => {
    const rech = this.vista() === 'rechazadas';
    return [...(rech ? this.rechazadas() : this.porRevisar())]
      .sort((a, b) => rech ? b.id - a.id : a.id - b.id);
  });
  cargando = signal(true);
  guardando = signal(false);
  error = signal('');

  busqueda = signal('');
  filtroEstado = signal<FiltroEstado>('todos');
  filtroCategoria = signal('todas');
  orden = signal<Orden>('recientes');
  seleccion = signal<GestionItem | null>(null);

  total = computed(() => this.items().length);

  conteo = computed(() => {
    const c: Record<string, number> = { pendiente: 0, proceso: 0, resuelto: 0 };
    this.items().forEach(i => (c[i.st] = (c[i.st] ?? 0) + 1));
    return c;
  });

  categorias = computed(() => {
    const mapa = new Map<string, number>();
    this.items().forEach(i => mapa.set(i.cat, (mapa.get(i.cat) ?? 0) + 1));
    return [...mapa.entries()].map(([codigo, n]) => ({ codigo, n, info: this.info(codigo) }));
  });

  promedioResolucion = computed(() => {
    const duraciones = this.items()
      .filter(i => i.st === 'resuelto')
      .map(i => {
        const fin = i.historial.find(h => h.estado === 'resuelto')?.fecha;
        return fin && i.creado_en ? new Date(fin).getTime() - new Date(i.creado_en).getTime() : null;
      })
      .filter((d): d is number => d !== null && d >= 0);
    if (!duraciones.length) return '—';
    const horas = duraciones.reduce((a, b) => a + b, 0) / duraciones.length / 3600000;
    return horas < 48 ? `${Math.max(1, Math.round(horas))} h` : `${Math.round(horas / 24)} días`;
  });

  filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const fe = this.filtroEstado();
    const fc = this.filtroCategoria();
    const o = this.orden();

    const lista = this.items().filter(i =>
      (fe === 'todos' || i.st === fe) &&
      (fc === 'todas' || i.cat === fc) &&
      (!q || [i.title, i.descr, i.par, i.autor, String(i.id)].some(t => (t ?? '').toLowerCase().includes(q)))
    );

    return lista.sort((a, b) =>
      o === 'apoyos' ? (b.apoyos - a.apoyos) || (b.id - a.id)
      : o === 'antiguos' ? a.id - b.id
      : b.id - a.id);
  });

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.todos.set(await this.incService.cargarGestion());
      const sel = this.seleccion();
      if (sel) this.seleccion.set(this.todos().find(i => i.id === sel.id) ?? null);
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudieron cargar las incidencias.');
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarEstado(item: GestionItem, codigo: string, select?: HTMLSelectElement) {
    if (item.st === codigo || this.guardando()) return;
    this.guardando.set(true);
    try {
      await this.incService.cambiarEstado(item.id, codigo);
      await this.cargar();
    } catch (e: any) {
      if (select) select.value = item.st; // vuelve al valor anterior
      alert(e?.message ?? 'No se pudo cambiar el estado.');
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(item: GestionItem) {
    if (!confirm(`¿Eliminar definitivamente "${item.title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await this.incService.eliminarIncidencia(item.id);
      this.seleccion.set(null);
      await this.cargar();
    } catch (e: any) {
      alert(e?.message ?? 'No se pudo eliminar la incidencia.');
    }
  }

    async aprobar(item: GestionItem) {
    if (this.guardando()) return;
    this.guardando.set(true);
    try {
      await this.incService.moderar(item.id, 'aprobada');
      await this.cargar();
      this.seleccion.set(null);
    } catch (e: any) {
      alert(e?.message ?? 'No se pudo aprobar la incidencia.');
    } finally {
      this.guardando.set(false);
    }
  }

  async rechazar(item: GestionItem) {
    if (this.guardando()) return;
    const motivo = prompt(`Motivo del rechazo de "${item.title}" (el usuario lo verá):`);
    if (motivo === null) return; // canceló
    if (motivo.trim().length < 5) {
      alert('El motivo debe tener al menos 5 caracteres.');
      return;
    }
    this.guardando.set(true);
    try {
      await this.incService.moderar(item.id, 'rechazada', motivo);
      await this.cargar();
      this.seleccion.set(null);
    } catch (e: any) {
      alert(e?.message ?? 'No se pudo rechazar la incidencia.');
    } finally {
      this.guardando.set(false);
    }
  }

  verEnMapa(item: GestionItem) {
    this.router.navigate(['/mapa'], { queryParams: { inc: item.id } });
  }

  info(codigo: string): CatInfo {
    return CATEGORIAS[codigo] ?? CAT_DEFECTO;
  }

  estadoInfo(st: string) {
    return ESTADOS.find(e => e.id === st) ?? ESTADOS[0];
  }

  fecha(iso: string): string {
    return new Date(iso).toLocaleString('es-VE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}