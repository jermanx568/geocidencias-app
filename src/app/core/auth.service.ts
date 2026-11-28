import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { IncidenciaService } from './incidencia.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase = inject(SupabaseService).client;
  private router = inject(Router);
  private inc = inject(IncidenciaService);


  async register(nombre: string, apellido: string, email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre, apellido } } // se guarda en los datos del usuario
    });
    if (error) throw error;
    return data;
  }

  async login(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this.inc.cargarSesion();
    return data;
  }

  async logout() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
    await this.inc.cargarSesion();
    this.router.navigate(['/login']);
  }

  async getUser() {
    const { data: { user } } = await this.supabase.auth.getUser();
    return user;
  }
}