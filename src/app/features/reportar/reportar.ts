import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncidenciaService } from '../../core/incidencia.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reportar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportar.html',
  styleUrl: './reportar.css'
})
export class ReportarComponent {
  titulo: string = '';
  descripcion: string = '';
  parroquia: string = 'Bolívar';
  
  constructor(private incService: IncidenciaService, private router: Router) {}

  guardarReporte() {
    if(!this.titulo) {
      alert("Por favor, escribe un título para el reporte.");
      return;
    }

    // Usar coordenadas del clic en el mapa, o el centro por defecto
    const lat = this.incService.coordenadasTemporales ? this.incService.coordenadasTemporales.lat : 10.6500;
    const lng = this.incService.coordenadasTemporales ? this.incService.coordenadasTemporales.lng : -71.6300;

    const nuevaIncidencia = {
      id: Date.now(),
      title: this.titulo,
      desc: this.descripcion,
      cat: 'vialidad',
      st: 'pendiente' as const,
      par: this.parroquia,
      lat: lat, 
      lng: lng,
      date: new Date().toISOString().split('T')[0]
    };

    this.incService.addIncidencia(nuevaIncidencia);
    
    // Limpiar coordenadas después de guardar
    this.incService.coordenadasTemporales = null;
    
    alert('¡Reporte enviado con éxito a la alcaldía!');
    this.router.navigate(['/mapa']); 
  }
}