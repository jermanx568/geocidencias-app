import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { IncidenciaService } from './incidencia.service';

// Solo deja entrar a usuarios con rol "operador" o "admin"
export const operadorGuard: CanActivateFn = async () => {
  // En el servidor (SSR) no hay sesión: la comprobación real se hace en el navegador
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  const incService = inject(IncidenciaService);
  const router = inject(Router);

  await incService.cargarSesion();
  return ['operador', 'admin'].includes(incService.rol())
    ? true
    : router.createUrlTree(['/mapa']);
};