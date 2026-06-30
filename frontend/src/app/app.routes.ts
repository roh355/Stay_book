import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'conference', pathMatch: 'full' },
  {
    path: 'conference',
    loadComponent: () =>
      import('./pages/conference/conference.component').then((m) => m.ConferenceComponent),
  },
  {
    path: 'hostel',
    loadComponent: () => import('./pages/hostel/hostel.component').then((m) => m.HostelComponent),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
  },
  { path: '**', redirectTo: 'conference' },
];
