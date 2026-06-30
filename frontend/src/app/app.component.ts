import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from './services/theme.service';
import { AuthService } from './services/auth.service';
import { UiService } from './services/ui.service';
import { LoginModalComponent } from './components/login-modal/login-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LoginModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  theme = inject(ThemeService);
  auth = inject(AuthService);
  ui = inject(UiService);

  toggleTheme(): void {
    this.theme.toggle();
  }

  openLogin(): void {
    this.ui.openLogin();
  }

  logout(): void {
    this.auth.logout();
  }
}
