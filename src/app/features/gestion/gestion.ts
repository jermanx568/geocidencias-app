import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IncidenciaService } from '../../core/incidencia.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-gestion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gestion.html',
  styleUrl: './gestion.css'
})
export class GestionComponent implements OnInit {
  incidencias: any[] = [];

  constructor(private incService: IncidenciaService, private router: Router) {}

  ngOnInit() {
    this.incidencias = this.incService.getIncidencias();
  }

  irAlMapa() {
    this.router.navigate(['/mapa']);
  }
}