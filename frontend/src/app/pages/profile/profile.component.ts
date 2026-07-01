import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';
import { UiService } from '../../services/ui.service';
import { UpcomingBooking } from '../../models';
import { daysBetween, formatDateLong, formatDateMedium, minToLabel } from '../../utils/time';

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  auth = inject(AuthService);
  ui = inject(UiService);

  bookings = signal<UpcomingBooking[]>([]);
  loading = signal(false);

  ngOnInit(): void {
    if (this.auth.isAdmin()) {
      this.loadBookings();
    }
  }

  private loadBookings(): void {
    this.loading.set(true);
    this.api.getMyBookings().subscribe({
      next: (b) => {
        this.bookings.set(b);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openLogin(): void {
    this.ui.openLogin();
  }

  logout(): void {
    this.auth.logout();
    this.bookings.set([]);
  }

  goToBooking(b: UpcomingBooking): void {
    const path = b.type === 'CONFERENCE' ? '/conference' : '/hostel';
    const queryParams: Record<string, string | number> = {
      floor: b.floor,
      date: b.date,
      roomId: b.roomId,
    };
    this.router.navigate([path], { queryParams });
  }

  async deleteBooking(ev: Event, b: UpcomingBooking): Promise<void> {
    ev.stopPropagation();
    const ok = await this.confirm.ask({
      title: 'Delete this booking?',
      message: `Your booking for ${b.roomName} on ${this.dateLabel(b)} will be permanently removed. This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.api.deleteBooking(b.type, b.id).subscribe({
      next: () => this.loadBookings(),
      error: () => {},
    });
  }

  dateLabel(b: UpcomingBooking): string {
    if (b.type === 'HOSTEL' && b.endDate && b.endDate !== b.date) {
      return `${formatDateMedium(b.date)} – ${formatDateMedium(b.endDate)}`;
    }
    return formatDateLong(b.date);
  }

  timeLabel(b: UpcomingBooking): string {
    if (b.type === 'HOSTEL') {
      if (b.endDate && b.endDate !== b.date) {
        return `${daysBetween(b.date, b.endDate) + 1} days`;
      }
      return 'All day';
    }
    if (b.startMin === null || b.endMin === null) return 'All day';
    return `${minToLabel(b.startMin)} – ${minToLabel(b.endMin)}`;
  }
}
