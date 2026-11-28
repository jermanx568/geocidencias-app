import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout';
import { operadorGuard } from './core/operador.guard';
import { LandingComponent } from './features/landing/landing';

export const routes: Routes = [
  // NUEVO: la raíz "/" muestra la landing
  { path: '', component: LandingComponent, pathMatch: 'full' },

  {
    path: '', 
    component: LayoutComponent,
    children: [
      { path: 'mapa', loadComponent: () => import('./features/mapa/mapa').then(m => m.MapaComponent) },
      {
        path: 'gestion',
        canActivate: [operadorGuard],
        loadComponent: () => import('./features/gestion/gestion').then(m => m.GestionComponent)
      },
      { path: 'reportar', loadComponent: () => import('./features/reportar/reportar').then(m => m.ReportarComponent) },
      { path: 'seguimientos', loadComponent: () => import('./features/seguimientos/seguimientos').then(m => m.SeguimientosComponent) }
    ]
  },
  { path: 'login', loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/register/register').then(m => m.RegisterComponent) },
  { path: '**', redirectTo: '' }
];