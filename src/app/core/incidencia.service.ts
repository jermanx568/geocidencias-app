import { Injectable, signal, computed, inject } from '@angular/core';
import { Incidencia } from './incidencia.model';
import { SupabaseService } from './supabase.service';


export interface SeguimientoItem extends Incidencia {
  esMia: boolean;
  sigo: boolean;
  apoyos: number;
  historial: { estado: string; fecha: string }[];
}

export interface GestionItem extends Incidencia {
  apoyos: number;
  autor: string;
  historial: { estado: string; fecha: string }[];
}

const CODIGO_ESTADO = ['', 'pendiente', 'proceso', 'resuelto'];

@Injectable({ providedIn: 'root' })
export class IncidenciaService {
  public coordenadasTemporales: { lat: number, lng: number } | null = null;
  private supabase = inject(SupabaseService).client;

  // Signal con los datos de la base de datos
  private db = signal<Incidencia[]>([]);
  private searchTerm = signal('');
  public busqueda = computed(() => this.searchTerm());

  // Sesión y apoyos ("También me afecta") del usuario actual
  public usuarioId = signal<string | null>(null);
  public misApoyos = signal<Set<number>>(new Set());
  public rol = signal<string>('ciudadano');
  public avisos = signal(0); // reportes tuyos moderados desde tu última visita a Seguimientos

  // Computed para filtrar
  public filteredIncidencias = computed(() => {
    const palabras = this.normalizar(this.searchTerm()).split(' ').filter(Boolean);
    if (!palabras.length) return this.db();
    return this.db().filter(i => {
      const texto = this.normalizar(
        [i.title, i.par, i.descr, i.cat_nombre, i.cat].filter(Boolean).join(' ')
      );
      // Todas las palabras escritas deben aparecer en alguna parte del texto
      return palabras.every(p => texto.includes(p));
    });
  });
  
    // Pasa a minúsculas y quita tildes para que "electrica" encuentre "Eléctrica"
  private normalizar(t: string): string {
    return (t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  constructor() {
    
    this.cargarIncidencias();
  }

  async cargarIncidencias() {
    const { data, error } = await this.supabase
      .from('incidencias_vista')
      .select('*')
      .eq('moderacion', 'aprobada')
      .order('id', { ascending: false });;

    if (error) {
      console.error('Error cargando incidencias:', error.message);
    } else {
      this.db.set(data as Incidencia[]);
    }
  }

  setSearchTerm(term: string) {
    this.searchTerm.set(term);
  }

  getIncidencias() { return this.db(); }

  async subirFoto(file: File, userId: string): Promise<{ ruta: string; url: string }> {
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const ruta = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await this.supabase.storage
      .from('fotos-incidencias')
      .upload(ruta, file, { contentType: file.type, upsert: false });
    if (error) throw error;

    const { data } = this.supabase.storage.from('fotos-incidencias').getPublicUrl(ruta);
    return { ruta, url: data.publicUrl };
  }

  // Devuelve cuántas fotos fallaron al subirse
  async addIncidencia(
    inc: { title: string; descr: string; cat: string; par: string; lat: number; lng: number },
    fotos: File[] = []
  ): Promise<number> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Debes iniciar sesión para reportar una incidencia.');

    const { data: cat, error: eCat } = await this.supabase
      .from('categorias').select('id').eq('codigo', inc.cat).single();
    if (eCat) throw eCat;

    const { data: nueva, error } = await this.supabase
      .from('incidencias')
      .insert({
        titulo: inc.title,
        descripcion: inc.descr,
        categoria_id: cat.id,
        direccion: inc.par,
        lat: inc.lat,
        lng: inc.lng,
        usuario_id: user.id
      })
      .select('id')
      .single();
    if (error) throw error;

    const res = await Promise.allSettled(fotos.map(async f => {
      const { ruta, url } = await this.subirFoto(f, user.id);
      const { error: eF } = await this.supabase
        .from('incidencia_fotos')
        .insert({ incidencia_id: nueva.id, ruta, url });
      if (eF) throw eF;
    }));
    res.forEach(r => r.status === 'rejected' && console.error('Foto:', r.reason));

    await this.cargarIncidencias();
    return res.filter(r => r.status === 'rejected').length;
  }

  // Carga quién es el usuario actual y a qué incidencias les dio apoyo
  async cargarSesion() {
    const previo = this.usuarioId();
    const { data: { user } } = await this.supabase.auth.getUser();
    const actual = user?.id ?? null;
    this.usuarioId.set(actual);
    if (previo !== actual) this.cargarIncidencias();
    if (!user) {
      this.misApoyos.set(new Set());
      this.rol.set('ciudadano');
      this.avisos.set(0);
      return;
    }
    const { data } = await this.supabase
      .from('apoyos').select('incidencia_id').eq('usuario_id', user.id);
    this.misApoyos.set(new Set((data ?? []).map((a: any) => a.incidencia_id as number)));

    const { data: perfil } = await this.supabase
      .from('perfiles').select('rol').eq('id', user.id).maybeSingle();
    this.rol.set(perfil?.rol ?? 'ciudadano');
    this.calcularAvisos(user.id);
  }

    // Cuenta cuántos reportes tuyos fueron moderados después de tu última visita a Seguimientos
  private async calcularAvisos(userId: string, marcarVisto = false) {
    const { data, error } = await this.supabase
      .from('incidencias_vista')
      .select('moderado_en')
      .eq('user_id', userId)
      .not('moderado_en', 'is', null);
    if (error) return;

    const fechas = (data ?? []).map((r: any) => r.moderado_en as string);
    if (!fechas.length) { this.avisos.set(0); return; }

    const clave = `vu-visto-${userId}`;
    if (marcarVisto) {
      const maxima = fechas.reduce((a, b) => new Date(b) > new Date(a) ? b : a);
      try { localStorage.setItem(clave, maxima); } catch { /* sin almacenamiento */ }
      this.avisos.set(0);
      return;
    }

    let visto: string | null = null;
    try { visto = localStorage.getItem(clave); } catch { /* sin almacenamiento */ }
    const desde = visto ? new Date(visto).getTime() : 0;
    this.avisos.set(fechas.filter(f => new Date(f).getTime() > desde).length);
  }

  // Se llama al abrir Mis Seguimientos: el contador vuelve a 0
  async marcarAvisosVistos() {
    const id = this.usuarioId();
    if (id) await this.calcularAvisos(id, true);
  }

  // "También me afecta": activa o quita el apoyo. Devuelve true si quedó activo
  async toggleApoyo(incidenciaId: number): Promise<boolean> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Debes iniciar sesión para apoyar una incidencia.');

    const siguiendo = this.misApoyos().has(incidenciaId);
    const { error } = siguiendo
      ? await this.supabase.from('apoyos').delete()
          .eq('incidencia_id', incidenciaId).eq('usuario_id', user.id)
      : await this.supabase.from('apoyos')
          .insert({ incidencia_id: incidenciaId, usuario_id: user.id });
    if (error) throw error;

    const nuevo = new Set(this.misApoyos());
    if (siguiendo) nuevo.delete(incidenciaId); else nuevo.add(incidenciaId);
    this.misApoyos.set(nuevo);
    return !siguiendo;
  }

  // Datos reales para la página Mis Seguimientos
  async cargarSeguimientos(): Promise<{ items: SeguimientoItem[]; apoyosRecibidos: number }> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return { items: [], apoyosRecibidos: 0 };

    const { data: ap } = await this.supabase
      .from('apoyos').select('incidencia_id').eq('usuario_id', user.id);
    const sigo = new Set<number>((ap ?? []).map((a: any) => a.incidencia_id as number));

    const filtro = sigo.size
      ? `user_id.eq.${user.id},id.in.(${[...sigo].join(',')})`
      : `user_id.eq.${user.id}`;

    const { data: filas, error } = await this.supabase
      .from('incidencias_vista').select('*').or(filtro).order('id', { ascending: false });
    if (error) throw error;

    const lista = (filas ?? []) as Incidencia[];
    if (!lista.length) return { items: [], apoyosRecibidos: 0 };
    const ids = lista.map(i => i.id);

    const [resApoyos, resHist] = await Promise.all([
      this.supabase.from('apoyos').select('incidencia_id').in('incidencia_id', ids),
      this.supabase.from('historial_estados')
        .select('incidencia_id, estado_id, creado_en')
        .in('incidencia_id', ids).order('creado_en')
    ]);

    const conteo = new Map<number, number>();
    (resApoyos.data ?? []).forEach((a: any) =>
      conteo.set(a.incidencia_id, (conteo.get(a.incidencia_id) ?? 0) + 1));

    const items: SeguimientoItem[] = lista.map(i => ({
      ...i,
      esMia: i.user_id === user.id,
      sigo: sigo.has(i.id),
      apoyos: conteo.get(i.id) ?? 0,
      historial: (resHist.data ?? [])
        .filter((h: any) => h.incidencia_id === i.id)
        .map((h: any) => ({ estado: CODIGO_ESTADO[h.estado_id], fecha: h.creado_en as string }))
    }));

    const apoyosRecibidos = items.filter(i => i.esMia).reduce((s, i) => s + i.apoyos, 0);
    return { items, apoyosRecibidos };
  }

  // Todas las incidencias con apoyos, autor e historial (panel de gestión)
  async cargarGestion(): Promise<GestionItem[]> {
    const { data: filas, error } = await this.supabase
      .from('incidencias_vista').select('*').order('id', { ascending: false });
    if (error) throw error;

    const lista = (filas ?? []) as Incidencia[];
    if (!lista.length) return [];
    const ids = lista.map(i => i.id);
    const autores = [...new Set(lista.map(i => i.user_id).filter(Boolean))] as string[];

    const [resApoyos, resHist, resPerfiles] = await Promise.all([
      this.supabase.from('apoyos').select('incidencia_id').in('incidencia_id', ids),
      this.supabase.from('historial_estados')
        .select('incidencia_id, estado_id, creado_en')
        .in('incidencia_id', ids).order('creado_en'),
      autores.length
        ? this.supabase.from('perfiles').select('id, nombre').in('id', autores)
        : Promise.resolve({ data: [] as any[] })
    ]);

    const conteo = new Map<number, number>();
    (resApoyos.data ?? []).forEach((a: any) =>
      conteo.set(a.incidencia_id, (conteo.get(a.incidencia_id) ?? 0) + 1));

    const nombres = new Map<string, string>();
    (resPerfiles.data ?? []).forEach((p: any) => nombres.set(p.id, p.nombre));

    return lista.map(i => ({
      ...i,
      apoyos: conteo.get(i.id) ?? 0,
      autor: (i.user_id && nombres.get(i.user_id)) || 'Anónimo',
      historial: (resHist.data ?? [])
        .filter((h: any) => h.incidencia_id === i.id)
        .map((h: any) => ({ estado: CODIGO_ESTADO[h.estado_id], fecha: h.creado_en as string }))
    }));
  }

    // Aprueba o rechaza un reporte. Solo operadores/admin (lo exige la base de datos)
  async moderar(incidenciaId: number, decision: 'aprobada' | 'rechazada', motivo = '') {
    if (decision === 'rechazada' && motivo.trim().length < 5) {
      throw new Error('Indica el motivo del rechazo (mínimo 5 caracteres).');
    }
    const { data, error } = await this.supabase
      .from('incidencias')
      .update({
        moderacion: decision,
        motivo_rechazo: decision === 'rechazada' ? motivo.trim() : null
      })
      .eq('id', incidenciaId)
      .select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('No tienes permiso para moderar esta incidencia.');

    await this.cargarIncidencias();
  }

  // Solo operadores/admin (lo exige la base de datos con RLS)
  async cambiarEstado(incidenciaId: number, codigo: string) {
    const estado_id = CODIGO_ESTADO.indexOf(codigo);
    if (estado_id < 1) throw new Error('Estado no válido.');

    const { data, error } = await this.supabase
      .from('incidencias').update({ estado_id }).eq('id', incidenciaId).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('No tienes permiso para cambiar el estado de esta incidencia.');

    await this.cargarIncidencias();
  }

  async eliminarIncidencia(incidenciaId: number) {
    const { data: fotos } = await this.supabase
      .from('incidencia_fotos').select('ruta').eq('incidencia_id', incidenciaId);

    const { data, error } = await this.supabase
      .from('incidencias').delete().eq('id', incidenciaId).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('No tienes permiso para eliminar esta incidencia.');

    const rutas = (fotos ?? []).map((f: any) => f.ruta as string);
    if (rutas.length) {
      const { error: eS } = await this.supabase.storage.from('fotos-incidencias').remove(rutas);
      if (eS) console.error('No se pudieron borrar las fotos:', eS.message);
    }

    await this.cargarIncidencias();
  }
}