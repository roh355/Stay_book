import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { FloorAvailability, HostelInterval, HostelRoom } from '../../models';
import { BookingSidebarComponent } from '../../components/booking-sidebar/booking-sidebar.component';
import { HostelTimelineComponent } from '../../components/hostel-timeline/hostel-timeline.component';
import { addDaysISO, formatDateMedium, todayISO } from '../../utils/time';

interface Toast {
  text: string;
  kind: 'success' | 'error';
}

const WINDOW_DAYS = 15;

@Component({
  selector: 'app-hostel',
  standalone: true,
  imports: [FormsModule, BookingSidebarComponent, HostelTimelineComponent],
  templateUrl: './hostel.component.html',
  styleUrl: './hostel.component.css',
})
export class HostelComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  isAdmin = this.auth.isAdmin;
  private pendingRoomId: number | null = null;

  floors = signal<number[]>([]);
  date = signal<string>(todayISO());
  floor = signal<number>(1);

  rooms = signal<HostelRoom[]>([]);
  loadingRooms = signal(false);

  selectedRoom = signal<HostelRoom | null>(null);
  roomBookings = signal<HostelInterval[]>([]);
  loadingGraph = signal(false);

  toast = signal<Toast | null>(null);

  searchOpen = signal(false);
  searchFrom = signal<string>(todayISO());
  searchTo = signal<string>(addDaysISO(todayISO(), 7));
  searchResults = signal<FloorAvailability[] | null>(null);
  searchError = signal<string | null>(null);

  readonly minDate = todayISO();

  constructor() {
    effect(() => {
      const date = this.date();
      const floor = this.floor();
      if (!this.floors().length) return;
      this.selectedRoom.set(null);
      this.loadRooms(floor, date);
    });
  }

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const qpDate = qp.get('date');
    const qpFloor = qp.get('floor');
    const qpRoom = qp.get('roomId');
    if (qpDate) this.date.set(qpDate);
    if (qpRoom) this.pendingRoomId = Number(qpRoom);

    this.api.getHostelFloors().subscribe((floors) => {
      this.floors.set(floors);
      const target = qpFloor ? Number(qpFloor) : this.floor();
      if (floors.length && floors.includes(target)) {
        this.floor.set(target);
      } else if (floors.length) {
        this.floor.set(floors[0]);
      }
      this.loadRooms(this.floor(), this.date());
    });
  }

  private loadRooms(floor: number, date: string): void {
    this.loadingRooms.set(true);
    this.api.getHostelRooms(floor, date).subscribe({
      next: (rooms) => {
        this.rooms.set(rooms);
        this.loadingRooms.set(false);
        if (this.pendingRoomId !== null) {
          const room = rooms.find((r) => r.id === this.pendingRoomId);
          this.pendingRoomId = null;
          if (room) this.selectRoom(room);
        }
      },
      error: () => this.loadingRooms.set(false),
    });
  }

  selectRoom(room: HostelRoom): void {
    this.selectedRoom.set(room);
    this.loadingGraph.set(true);
    const from = this.date();
    const to = addDaysISO(from, WINDOW_DAYS - 1);
    this.api.getHostelRoomBookings(room.id, from, to).subscribe({
      next: (res) => {
        this.roomBookings.set(res.bookings);
        this.loadingGraph.set(false);
      },
      error: () => this.loadingGraph.set(false),
    });
  }

  backToGrid(): void {
    this.selectedRoom.set(null);
  }

  onBook(stay: { startDate: string; endDate: string; description: string | null }): void {
    const room = this.selectedRoom();
    if (!room) return;
    this.api
      .createHostelBooking(room.id, stay.startDate, stay.endDate, stay.description)
      .subscribe({
        next: () => {
          const label =
            stay.startDate === stay.endDate
              ? formatDateMedium(stay.startDate)
              : `${formatDateMedium(stay.startDate)} – ${formatDateMedium(stay.endDate)}`;
          this.showToast(`Booked ${room.name}, ${label}`, 'success');
          this.selectRoom(room);
          this.loadRooms(this.floor(), this.date());
        },
        error: (err) => this.showToast(err?.error?.error || 'Booking failed', 'error'),
      });
  }

  onDeleteBooking(id: number): void {
    const room = this.selectedRoom();
    if (!room) return;
    this.api.deleteHostelBooking(id).subscribe({
      next: () => {
        this.showToast('Booking deleted', 'success');
        this.selectRoom(room);
        this.loadRooms(this.floor(), this.date());
      },
      error: (err) => this.showToast(err?.error?.error || 'Delete failed', 'error'),
    });
  }

  toggleSearch(): void {
    this.searchOpen.update((v) => !v);
  }

  runSearch(): void {
    this.searchError.set(null);
    const from = this.searchFrom();
    const to = this.searchTo();
    if (to < from) {
      this.searchError.set('To date must be on or after from date');
      return;
    }
    this.api.searchHostel(from, to).subscribe({
      next: (res) => this.searchResults.set(res.results),
      error: (err) => {
        this.searchError.set(err?.error?.error || 'Search failed');
        this.searchResults.set(null);
      },
    });
  }

  goToSearchResult(floor: number): void {
    this.date.set(this.searchFrom());
    this.floor.set(floor);
    this.selectedRoom.set(null);
    this.searchOpen.set(false);
  }

  private showToast(text: string, kind: 'success' | 'error'): void {
    this.toast.set({ text, kind });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
