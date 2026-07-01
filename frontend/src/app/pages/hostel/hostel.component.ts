import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
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

type View = 'idle' | 'status' | 'search';

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

  view = signal<View>('idle');

  statusRooms = signal<HostelRoom[]>([]);
  loadingRooms = signal(false);

  searchFrom = signal<string>(todayISO());
  searchTo = signal<string>(addDaysISO(todayISO(), 7));
  searchResults = signal<FloorAvailability[] | null>(null);
  searchError = signal<string | null>(null);
  searchSelectedFloor = signal<number | null>(null);
  searchRooms = signal<HostelRoom[]>([]);
  loadingSearchRooms = signal(false);

  selectedRoom = signal<HostelRoom | null>(null);
  roomBookings = signal<HostelInterval[]>([]);
  loadingGraph = signal(false);

  toast = signal<Toast | null>(null);

  readonly minDate = todayISO();

  // Window start used by the currently active mode.
  activeBase = computed(() => (this.view() === 'search' ? this.searchFrom() : this.date()));

  constructor() {
    effect(() => {
      const date = this.date();
      const floor = this.floor();
      if (this.view() !== 'status') return;
      if (!this.floors().length) return;
      this.selectedRoom.set(null);
      this.loadStatusRooms(floor, date);
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
      // Deep link (e.g. from profile) lands directly in status mode.
      // The effect performs the load (and opens the pending room).
      if (qpFloor || qpRoom) {
        this.view.set('status');
      }
    });
  }

  // ===== Status mode =====
  showStatus(): void {
    this.searchSelectedFloor.set(null);
    this.selectedRoom.set(null);
    if (this.view() === 'status') {
      this.loadStatusRooms(this.floor(), this.date());
    } else {
      this.view.set('status');
    }
  }

  private loadStatusRooms(floor: number, date: string): void {
    this.loadingRooms.set(true);
    this.api.getHostelRooms(floor, date).subscribe({
      next: (rooms) => {
        this.statusRooms.set(rooms);
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

  // ===== Search mode =====
  runSearch(): void {
    this.searchError.set(null);
    const from = this.searchFrom();
    const to = this.searchTo();
    if (to < from) {
      this.searchError.set('To date must be on or after from date');
      return;
    }
    this.api.searchHostel(from, to).subscribe({
      next: (res) => {
        this.searchResults.set(res.results);
        this.searchSelectedFloor.set(null);
        this.selectedRoom.set(null);
        this.view.set('search');
      },
      error: (err) => {
        this.searchError.set(err?.error?.error || 'Search failed');
        this.searchResults.set(null);
      },
    });
  }

  openSearchFloor(floor: number): void {
    this.searchSelectedFloor.set(floor);
    this.selectedRoom.set(null);
    this.loadingSearchRooms.set(true);
    this.api
      .getHostelRooms(floor, this.searchFrom(), { from: this.searchFrom(), to: this.searchTo() })
      .subscribe({
        next: (rooms) => {
          this.searchRooms.set(rooms);
          this.loadingSearchRooms.set(false);
        },
        error: () => this.loadingSearchRooms.set(false),
      });
  }

  backToSearchResults(): void {
    this.searchSelectedFloor.set(null);
    this.selectedRoom.set(null);
  }

  // ===== Room drill-in =====
  selectRoom(room: HostelRoom): void {
    this.selectedRoom.set(room);
    this.loadingGraph.set(true);
    const from = this.activeBase();
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

  private refreshActiveGrid(): void {
    if (this.view() === 'search' && this.searchSelectedFloor() !== null) {
      this.openSearchFloor(this.searchSelectedFloor()!);
    } else if (this.view() === 'status') {
      this.loadStatusRooms(this.floor(), this.date());
    }
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
          this.refreshActiveGrid();
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
        this.refreshActiveGrid();
      },
      error: (err) => this.showToast(err?.error?.error || 'Delete failed', 'error'),
    });
  }

  private showToast(text: string, kind: 'success' | 'error'): void {
    this.toast.set({ text, kind });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
