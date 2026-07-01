import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ConferenceInterval, ConferenceRoom, FloorAvailability } from '../../models';
import { BookingSidebarComponent } from '../../components/booking-sidebar/booking-sidebar.component';
import { TimelineGraphComponent } from '../../components/timeline-graph/timeline-graph.component';
import { hhmmToMin, minToHHMM, minToLabel, todayISO } from '../../utils/time';

interface Toast {
  text: string;
  kind: 'success' | 'error';
}

type View = 'idle' | 'status' | 'search';

@Component({
  selector: 'app-conference',
  standalone: true,
  imports: [FormsModule, BookingSidebarComponent, TimelineGraphComponent],
  templateUrl: './conference.component.html',
  styleUrl: './conference.component.css',
})
export class ConferenceComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  isAdmin = this.auth.isAdmin;
  private pendingRoomId: number | null = null;

  floors = signal<number[]>([]);
  date = signal<string>(todayISO());
  floor = signal<number>(1);

  // Which result set the main table is showing.
  view = signal<View>('idle');

  // Status mode (floor + date browsing).
  statusRooms = signal<ConferenceRoom[]>([]);
  loadingRooms = signal(false);

  // Search mode.
  searchDate = signal<string>(todayISO());
  searchStart = signal<string>('09:00');
  searchEnd = signal<string>('10:00');
  searchResults = signal<FloorAvailability[] | null>(null);
  searchError = signal<string | null>(null);
  searchSelectedFloor = signal<number | null>(null);
  searchRooms = signal<ConferenceRoom[]>([]);
  loadingSearchRooms = signal(false);
  // Interval that the currently-shown search rooms were evaluated against.
  private searchInterval: { startMin: number; endMin: number } | null = null;

  // Room drill-in (shared by both modes).
  selectedRoom = signal<ConferenceRoom | null>(null);
  roomBookings = signal<ConferenceInterval[]>([]);
  loadingGraph = signal(false);

  toast = signal<Toast | null>(null);

  readonly minDate = todayISO();

  // Date used by the currently active mode.
  activeDate = computed(() => (this.view() === 'search' ? this.searchDate() : this.date()));

  constructor() {
    // Keep status rooms in sync with floor/date while browsing in status mode.
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

    this.api.getConferenceFloors().subscribe((floors) => {
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
      // View unchanged: refresh explicitly (effect won't re-fire).
      this.loadStatusRooms(this.floor(), this.date());
    } else {
      // Switching into status mode: the effect performs the load.
      this.view.set('status');
    }
  }

  private loadStatusRooms(floor: number, date: string): void {
    this.loadingRooms.set(true);
    this.api.getConferenceRooms(floor, date).subscribe({
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
    const s = hhmmToMin(this.searchStart());
    const e = hhmmToMin(this.searchEnd());
    if (e <= s) {
      this.searchError.set('End time must be after start time');
      return;
    }
    this.api.searchConference(this.searchDate(), s, e).subscribe({
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
    const interval = { startMin: hhmmToMin(this.searchStart()), endMin: hhmmToMin(this.searchEnd()) };
    this.searchInterval = interval;
    this.searchSelectedFloor.set(floor);
    this.selectedRoom.set(null);
    this.loadingSearchRooms.set(true);
    this.api.getConferenceRooms(floor, this.searchDate(), interval).subscribe({
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
  selectRoom(room: ConferenceRoom): void {
    this.selectedRoom.set(room);
    this.loadingGraph.set(true);
    this.api.getConferenceRoomBookings(room.id, this.activeDate()).subscribe({
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

  onBook(slot: { startMin: number; endMin: number; description: string | null }): void {
    const room = this.selectedRoom();
    if (!room) return;
    this.api
      .createConferenceBooking(room.id, this.activeDate(), slot.startMin, slot.endMin, slot.description)
      .subscribe({
        next: () => {
          this.showToast(
            `Booked ${room.name}, ${minToLabel(slot.startMin)}–${minToLabel(slot.endMin)}`,
            'success'
          );
          this.selectRoom(room);
          this.refreshActiveGrid();
        },
        error: (err) => this.showToast(err?.error?.error || 'Booking failed', 'error'),
      });
  }

  onDeleteBooking(id: number): void {
    const room = this.selectedRoom();
    if (!room) return;
    this.api.deleteConferenceBooking(id).subscribe({
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

  hhmm = minToHHMM;
}
