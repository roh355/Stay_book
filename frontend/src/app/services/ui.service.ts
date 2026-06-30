import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UiService {
  readonly loginModalOpen = signal(false);

  openLogin(): void {
    this.loginModalOpen.set(true);
  }

  closeLogin(): void {
    this.loginModalOpen.set(false);
  }
}
