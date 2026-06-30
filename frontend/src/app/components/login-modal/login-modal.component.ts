import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UiService } from '../../services/ui.service';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login-modal.component.html',
  styleUrl: './login-modal.component.css',
})
export class LoginModalComponent {
  private auth = inject(AuthService);
  ui = inject(UiService);

  username = signal('admin');
  password = signal('admin123');
  error = signal<string | null>(null);
  loading = signal(false);

  submit(): void {
    if (this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    this.auth.login(this.username(), this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        this.ui.closeLogin();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'Login failed. Please try again.');
      },
    });
  }

  close(): void {
    this.ui.closeLogin();
  }
}
