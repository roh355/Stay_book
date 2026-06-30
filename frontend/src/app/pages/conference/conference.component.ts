import { Component, OnInit, effect, inject, signal } from '@angular/core';
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

  rooms = signal<ConferenceRoom[]>([]);
  loadingRooms = signal(false);

  selectedRoom = signal<ConferenceRoom | null>(null);
  roomBookings = signal<ConferenceInterval[]>([]);
  loadingGraph = signal(false);

  toast = signal<Toast | null>(null);

  // Search state
  searchOpen = signal(false);
  searchDate = signal<string>(todayISO());
  searchStart = signal<string>('09:00');
  searchEnd = signal<string>('10:00');
  searchResults = signal<FloorAvailability[] | null>(null);
  searchError = signal<string | null>(null);

  readonly minDate = todayISO();

  constructor() {
    // Reload rooms whenever date or floor changes.
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

    this.api.getConferenceFloors().subscribe((floors) => {
      this.floors.set(floors);
      const target = qpFloor ? Number(qpFloor) : this.floor();
      if (floors.length && floors.includes(target)) {
        this.floor.set(target);
      } else if (floors.length) {
        this.floor.set(floors[0]);
      }
      // ensure an initial load even if floor value did not change
      this.loadRooms(this.floor(), this.date());
    });
  }

  private loadRooms(floor: number, date: string): void {
    this.loadingRooms.set(true);
    this.api.getConferenceRooms(floor, date).subscribe({
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

  selectRoom(room: ConferenceRoom): void {
    this.selectedRoom.set(room);
    this.loadingGraph.set(true);
    this.api.getConferenceRoomBookings(room.id, this.date()).subscribe({
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

  onBook(slot: { startMin: number; endMin: number; description: string | null }): void {
    const room = this.selectedRoom();
    if (!room) return;
    this.api
      .createConferenceBooking(
        room.id,
        this.date(),
        slot.startMin,
        slot.endMin,
        slot.description
      )
      .subscribe({
        next: () => {
          this.showToast(
            `Booked ${room.name}, ${minToLabel(slot.startMin)}–${minToLabel(slot.endMin)}`,
            'success'
          );
          this.selectRoom(room);
          this.loadRooms(this.floor(), this.date());
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
        this.loadRooms(this.floor(), this.date());
      },
      error: (err) => this.showToast(err?.error?.error || 'Delete failed', 'error'),
    });
  }

  // ===== Search =====
  toggleSearch(): void {
    this.searchOpen.update((v) => !v);
  }

  runSearch(): void {
    this.searchError.set(null);
    const s = hhmmToMin(this.searchStart());
    const e = hhmmToMin(this.searchEnd());
    if (e <= s) {
      this.searchError.set('End time must be after start time');
      return;
    }
    this.api.searchConference(this.searchDate(), s, e).subscribe({
      next: (res) => this.searchResults.set(res.results),
      error: (err) => {
        this.searchError.set(err?.error?.error || 'Search failed');
        this.searchResults.set(null);
      },
    });
  }

  goToSearchResult(floor: number): void {
    this.date.set(this.searchDate());
    this.floor.set(floor);
    this.selectedRoom.set(null);
    this.searchOpen.set(false);
  }

  private showToast(text: string, kind: 'success' | 'error'): void {
    this.toast.set({ text, kind });
    setTimeout(() => this.toast.set(null), 3500);
  }

  hhmm = minToHHMM;
}
