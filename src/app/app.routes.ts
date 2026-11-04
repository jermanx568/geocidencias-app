import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'mapa', pathMatch: 'full' },
      { path: 'mapa', loadComponent: () => import('./features/mapa/mapa').then(m => m.MapaComponent) },
      { path: 'gestion', loadComponent: () => import('./features/gestion/gestion').then(m => m.GestionComponent) },
      { path: 'reportar', loadComponent: () => import('./features/reportar/reportar').then(m => m.ReportarComponent) },
      { path: 'seguimientos', loadComponent: () => import('./features/seguimientos/seguimientos').then(m => m.SeguimientosComponent) }
    ]
  }
];