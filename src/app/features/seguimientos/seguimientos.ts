import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-seguimientos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './seguimientos.html',
  styleUrl: './seguimientos.css'
})
export class SeguimientosComponent {
  nombreUsuario: string = 'Jermayn';
  
  // Variable para controlar qué pestaña está activa
  tabActiva: string = 'todas';

  // Función que se ejecuta al hacer clic en una pestaña
  cambiarTab(tab: string) {
    this.tabActiva = tab;
  }
}