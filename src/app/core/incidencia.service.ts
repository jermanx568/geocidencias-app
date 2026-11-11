import { Injectable, signal, computed } from '@angular/core';
import { Incidencia } from './incidencia.model';

@Injectable({ providedIn: 'root' })
export class IncidenciaService {
  // Propiedad que usa el mapa y reportar
  public coordenadasTemporales: { lat: number, lng: number } | null = null;

  // Signal de la base de datos
  private db = signal<Incidencia[]>([
    {id:1,title:'Apagón en varias cuadras',desc:'Sin servicio eléctrico desde la madrugada.',cat:'electrico',st:'pendiente',par:'Olegario Villalobos',lat:10.6620,lng:-71.6150,date:'2026-10-24'},
    {id:2,title:'Bache profundo en la avenida',desc:'Afecta el carril derecho en sentido norte.',cat:'vialidad',st:'proceso',par:'Cecilio Acosta',lat:10.6380,lng:-71.6260,date:'2026-10-22'},
    {id:3,title:'Fuga de agua potable',desc:'Fuga constante en la esquina.',cat:'agua',st:'pendiente',par:'Chiquinquirá',lat:10.6540,lng:-71.6420,date:'2026-10-25'}
  ]);

  // Signal para la búsqueda
  private searchTerm = signal('');

  // Computed que filtra la lista
  public filteredIncidencias = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.db();
    return this.db().filter(i => 
      i.title.toLowerCase().includes(term) || 
      i.par.toLowerCase().includes(term) ||
      i.desc.toLowerCase().includes(term)
    );
  });

  // Método para actualizar la búsqueda
  setSearchTerm(term: string) {
    this.searchTerm.set(term);
  }

  getIncidencias() { return this.db(); }
  
  addIncidencia(inc: Incidencia) { 
    this.db.update(prev => [...prev, inc]); 
  }
}