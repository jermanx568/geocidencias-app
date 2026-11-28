import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { IncidenciaService } from '../core/incidencia.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class LayoutComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private incService = inject(IncidenciaService);

  searchTerm = signal('');
  enMapa = signal(this.router.url.startsWith('/mapa'));
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(e => {
        const mapa = (e as NavigationEnd).urlAfterRedirects.startsWith('/mapa');
        this.enMapa.set(mapa);
        if (!mapa) this.limpiarBusqueda(); // al salir del mapa, se vacía el buscador
      });
  }

  ngOnDestroy() {
    clearTimeout(this.timer);
  }

  private limpiarBusqueda() {
    clearTimeout(this.timer);
    this.searchTerm.set('');
    this.incService.setSearchTerm('');
  }


  private userSignal = signal<string>('Invitado');
  userName = computed(() => this.userSignal());
  esOperador = computed(() => ['operador', 'admin'].includes(this.incService.rol()));
  haySesion = computed(() => !!this.incService.usuarioId());
  avisos = this.incService.avisos;

  ngOnInit() {
    this.incService.cargarSesion();
    this.authService.getUser().then(user => {
      if (!user) return;
      const meta = user.user_metadata ?? {};
      const nombreCompleto = [meta['nombre'], meta['apellido']]
        .filter(Boolean)
        .join(' ')
        .trim();
      // Si el usuario aún no tiene nombre guardado, se muestra el correo
      this.userSignal.set(nombreCompleto || user.email || 'Invitado');
    });
  }

    // El campo responde al instante; el filtro del mapa espera 400 ms tras la última letra
  onSearchChange(value: string) {
    this.searchTerm.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.incService.setSearchTerm(value), 400);
  }

  async logout() {
    await this.authService.logout(); // ya navega a /login
  }
}