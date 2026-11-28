import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http'; // <-- NUEVO IMPORT
import { routes } from './app.routes';
import { provideSupastore } from 'ngx-supastore';
import { environment } from '../environment/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(), // <-- NUEVO PROVEEDOR
    provideSupastore({
      createClient: {
        supabaseUrl: environment.supabaseUrl,
        supabaseAnonKey: environment.supabaseKey
      }
    })
  ]
};