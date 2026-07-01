import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly state = signal<ConfirmState | null>(null);

  // Opens the dialog and resolves true if the user confirms, false otherwise.
  ask(options: ConfirmOptions): Promise<boolean> {
    // If a dialog is already open, cancel it before opening a new one.
    this.state()?.resolve(false);
    return new Promise<boolean>((resolve) => {
      this.state.set({ ...options, resolve });
    });
  }

  confirm(): void {
    const s = this.state();
    if (!s) return;
    this.state.set(null);
    s.resolve(true);
  }

  cancel(): void {
    const s = this.state();
    if (!s) return;
    this.state.set(null);
    s.resolve(false);
  }
}
