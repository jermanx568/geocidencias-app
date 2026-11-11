import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  errorMessage = signal('');
  isLoading = signal(false);

  async onSubmit() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      await this.authService.register(this.email, this.password);
      alert('Registro exitoso. Revisa tu correo para confirmar (si Supabase lo requiere).');
      this.router.navigate(['/login']);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Error al registrar');
    } finally {
      this.isLoading.set(false);
    }
  }
}