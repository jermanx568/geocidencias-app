import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { IncidenciaService, SeguimientoItem } from '../../core/incidencia.service';
import { CATEGORIAS, CAT_DEFECTO, CatInfo } from '../../core/categorias';

type Tab = 'todas' | 'mios' | 'seguidos' | 'resueltas';

interface Tarjeta {
  inc: SeguimientoItem;
  cat: CatInfo;
  catNombre: string;
  est: { texto: string; color: string; fondo: string; pct: number; descripcion: string };
  pasos: { nombre: string; hecho: boolean; fecha: string }[];
  hace: string;
}

const ORDEN = ['pendiente', 'proceso', 'resuelto'];
const NOMBRES_PASOS = ['Recibida', 'En proceso', 'Resuelta'];

const ESTADOS: Record<string, Tarjeta['est']> = {
  pendiente: { texto: 'Pendiente', color: '#dc2626', fondo: '#fef2f2', pct: 33, descripcion: 'Recibida: a la espera de revisión' },
  proceso:   { texto: 'En proceso', color: '#f59e0b', fondo: '#fffbeb', pct: 66, descripcion: 'Un operador está atendiendo esta incidencia' },
  resuelto:  { texto: 'Resuelto', color: '#16a34a', fondo: '#f0fdf4', pct: 100, descripcion: 'Esta incidencia fue marcada como resuelta' }
};

@Component({
  selector: 'app-seguimientos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './seguimientos.html',
  styleUrl: './seguimientos.css'
})
export class SeguimientosComponent implements OnInit {
  private incService = inject(IncidenciaService);
  private authService = inject(AuthService);

  nombreUsuario = signal('vecino');
  tabActiva = signal<Tab>('todas');
  recientesPrimero = signal(true);
  tarjetas = signal<Tarjeta[]>([]);
  apoyosRecibidos = signal(0);
  cargando = signal(true);
  error = signal('');
  sesionLista = signal(false);
  haySesion = computed(() => !!this.incService.usuarioId());

  mios = computed(() => this.tarjetas().filter(t => t.inc.esMia));
  seguidos = computed(() => this.tarjetas().filter(t => t.inc.sigo && !t.inc.esMia));
  resueltas = computed(() => this.tarjetas().filter(t => t.inc.st === 'resuelto'));

  tabs = computed(() => [
    { id: 'todas' as Tab, texto: 'Todas', n: this.tarjetas().length },
    { id: 'mios' as Tab, texto: 'Mis reportes', n: this.mios().length },
    { id: 'seguidos' as Tab, texto: 'Seguidos', n: this.seguidos().length },
    { id: 'resueltas' as Tab, texto: 'Resueltas', n: this.resueltas().length }
  ]);

  visibles = computed(() => {
    const base = {
      todas: this.tarjetas(),
      mios: this.mios(),
      seguidos: this.seguidos(),
      resueltas: this.resueltas()
    }[this.tabActiva()];
    const lista = [...base].sort((a, b) => b.inc.id - a.inc.id);
    return this.recientesPrimero() ? lista : lista.reverse();
  });

  resumen = computed(() => {
    const t = this.tarjetas().filter(x => x.inc.moderacion === 'aprobada');
    const total = t.length || 1;
    return ORDEN.map(st => {
      const n = t.filter(x => x.inc.st === st).length;
      return { ...ESTADOS[st], n, ancho: Math.round((n * 100) / total) };
    });
  });

  mensajeVacio = computed(() => ({
    todas: 'Aún no tienes reportes ni seguimientos.',
    mios: 'Todavía no has creado ningún reporte.',
    seguidos: 'Aún no sigues ninguna incidencia. En el mapa, abre una incidencia y pulsa "También me afecta".',
    resueltas: 'Ninguna de tus incidencias está resuelta todavía.'
  }[this.tabActiva()]));

  async ngOnInit() {
    await this.incService.cargarSesion();
    this.sesionLista.set(true);

    // Sin sesión no hay nada que cargar
    if (!this.haySesion()) {
      this.cargando.set(false);
      return;
    }

    this.authService.getUser().then(u => {
      const nombre = u?.user_metadata?.['nombre'];
      this.nombreUsuario.set(nombre || u?.email?.split('@')[0] || 'vecino');
    });
    this.cargar();
    this.incService.marcarAvisosVistos();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const { items, apoyosRecibidos } = await this.incService.cargarSeguimientos();
      this.tarjetas.set(items.map(i => this.aTarjeta(i)));
      this.apoyosRecibidos.set(apoyosRecibidos);
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudieron cargar tus seguimientos.');
    } finally {
      this.cargando.set(false);
    }
  }

  async dejarDeSeguir(t: Tarjeta) {
    try {
      await this.incService.toggleApoyo(t.inc.id);
      await this.cargar();
    } catch (e: any) {
      alert(e?.message ?? 'No se pudo actualizar el seguimiento.');
    }
  }

  exportarCsv() {
    const celda = (v: any) => {
      let s = String(v ?? '');
      // evita que Excel interprete texto como fórmula
      if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const cab = ['ID', 'Título', 'Categoría', 'Estado', 'Dirección', 'Fecha', 'Apoyos', 'Latitud', 'Longitud', 'Descripción'];
    const filas = this.tarjetas().map(t => [
      t.inc.id, t.inc.title, t.catNombre, t.est.texto, t.inc.par,
      t.inc.date, t.inc.apoyos, t.inc.lat, t.inc.lng, t.inc.descr
    ]);
    const csv = '\uFEFF' + [cab, ...filas].map(f => f.map(celda).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitacora-voz-urbana-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private aTarjeta(inc: SeguimientoItem): Tarjeta {
    const idx = Math.max(0, ORDEN.indexOf(inc.st));
    const cat = CATEGORIAS[inc.cat] ?? CAT_DEFECTO;

    const fechaDe = (estado: string, respaldo?: string) => {
      const h = inc.historial.find(x => x.estado === estado);
      return this.formatoFecha(h?.fecha ?? respaldo);
    };

    return {
      inc,
      cat,
      catNombre: inc.cat_nombre || cat.nombre,
      est: ESTADOS[inc.st] ?? ESTADOS['pendiente'],
      pasos: ORDEN.map((estado, i) => ({
        nombre: NOMBRES_PASOS[i],
        hecho: i <= idx,
        fecha: i <= idx ? fechaDe(estado, i === 0 ? inc.creado_en : undefined) : ''
      })),
      hace: this.hace(inc.creado_en)
    };
  }

  private formatoFecha(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('es-VE', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }

  private hace(iso?: string): string {
    if (!iso) return '';
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
    const d = Math.round(h / 24);
    if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
    return new Date(iso).toLocaleDateString('es-VE');
  }
}