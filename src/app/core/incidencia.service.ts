import { Injectable } from '@angular/core';
import { Incidencia } from './incidencia.model';

@Injectable({ providedIn: 'root' })
export class IncidenciaService {
  // Variable para guardar las coordenadas donde el usuario haga clic en el mapa
  public coordenadasTemporales: { lat: number, lng: number } | null = null;

  private db: Incidencia[] = [
    {id:1,title:'Apagón en varias cuadras',desc:'Sin servicio eléctrico desde la madrugada.',cat:'electrico',st:'pendiente',par:'Olegario Villalobos',lat:10.6620,lng:-71.6150,date:'2026-10-24'},
    {id:2,title:'Bache profundo en la avenida',desc:'Afecta el carril derecho en sentido norte.',cat:'vialidad',st:'proceso',par:'Cecilio Acosta',lat:10.6380,lng:-71.6260,date:'2026-10-22'},
    {id:3,title:'Fuga de agua potable',desc:'Fuga constante en la esquina.',cat:'agua',st:'pendiente',par:'Chiquinquirá',lat:10.6540,lng:-71.6420,date:'2026-10-25'}
  ];

  getIncidencias() { return this.db; }
  
  addIncidencia(inc: Incidencia) { 
    this.db.push(inc); 
  }
}