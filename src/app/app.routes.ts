import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { authGuard } from './core/guards/auth.guard';
import { proRequiredGuard } from './core/guards/trial-expired.guard';
import { SubdomainService } from './core/services/subdomain.service';

export const routes: Routes = [
  // ── Rutas de subdominio ───────────────────────────────────────────────────
  {
    path: '',
    canMatch: [() => inject(SubdomainService).isSubdomain()],
    loadComponent: () =>
      import('./features/public/home/public-home').then((m) => m.PublicHome),
  },
  {
    path: 'reservar',
    canMatch: [() => inject(SubdomainService).isSubdomain()],
    loadComponent: () =>
      import('./features/public/booking/booking').then((m) => m.Booking),
  },
  {
    path: 'cancelar/:token',
    canMatch: [() => inject(SubdomainService).isSubdomain()],
    loadComponent: () =>
      import('./features/public/cancel/cancel').then((m) => m.Cancel),
  },
  {
    path: 'confirmar',
    canMatch: [() => inject(SubdomainService).isSubdomain()],
    loadComponent: () =>
      import('./features/public/confirm/confirm').then((m) => m.Confirm),
  },

  // ── Rutas del dominio raíz ────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./features/preventa/preventa').then((m) => m.Preventa),
  },
  {
    path: 'fundadores',
    loadComponent: () =>
      import('./features/preventa-fundadores/preventa-fundadores').then(
        (m) => m.PreventaFundadores,
      ),
  },
  {
    path: 'landing',
    loadComponent: () =>
      import('./features/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: 'recuperar-contrasena',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password').then(
        (m) => m.ForgotPassword,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password').then(
        (m) => m.ResetPassword,
      ),
  },

  // ── Panel (requiere auth) ─────────────────────────────────────────────────
  {
    path: 'panel',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('./features/panel/panel').then((m) => m.Panel),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/panel/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'reservas',
        loadComponent: () =>
          import('./features/panel/bookings/bookings').then((m) => m.Bookings),
      },
      {
        path: 'barberos',
        loadComponent: () =>
          import('./features/panel/barbers/barbers').then((m) => m.Barbers),
      },
      {
        path: 'servicios',
        loadComponent: () =>
          import('./features/panel/services/services').then((m) => m.Services),
      },
      {
        path: 'horarios',
        loadComponent: () =>
          import('./features/panel/schedules/schedules').then((m) => m.Schedules),
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./features/panel/config/config').then((m) => m.Config),
      },
      {
        path: 'estadisticas',
        // Reemplaza proGuard por proRequiredGuard que también verifica trial
        canActivate: [proRequiredGuard],
        loadComponent: () =>
          import('./features/panel/stats/stats').then((m) => m.Stats),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
