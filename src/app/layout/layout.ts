import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { IncidenciaService } from '../core/incidencia.service'; // <-- Importar
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // <-- Importar

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class LayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private incService = inject(IncidenciaService); // <-- Inyectar

  searchTerm = signal('');
  private userSignal = signal<string>('Invitado');
  userEmail = computed(() => this.userSignal());

  ngOnInit() {
    this.authService.getUser().then(user => {
      if (user && user.email) {
        this.userSignal.set(user.email);
      }
    });
  }

  // Al escribir en la barra, actualizamos el Signal global del servicio
  onSearchChange(value: string) {
    this.searchTerm.set(value);
    this.incService.setSearchTerm(value);
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}