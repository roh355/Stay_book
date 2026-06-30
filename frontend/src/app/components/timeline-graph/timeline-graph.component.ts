import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConferenceInterval } from '../../models';
import { minToLabel, minToHHMM } from '../../utils/time';

const SLOT = 30;
const SLOTS = 48; // 24h / 30min

interface Block {
  id: number;
  startMin: number;
  endMin: number;
  leftPct: number;
  widthPct: number;
}

@Component({
  selector: 'app-timeline-graph',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './timeline-graph.component.html',
  styleUrl: './timeline-graph.component.css',
})
export class TimelineGraphComponent {
  bookings = input<ConferenceInterval[]>([]);
  canBook = input<boolean>(false);

  book = output<{ startMin: number; endMin: number; description: string | null }>();
  deleteBooking = output<number>();

  track = viewChild<ElementRef<HTMLDivElement>>('track');

  description = signal('');

  private dragStartSlot = signal<number | null>(null);
  private dragEndSlot = signal<number | null>(null);
  dragging = signal(false);

  readonly hourTicks = Array.from({ length: 25 }, (_, i) => i);

  readonly bookedBlocks = computed<Block[]>(() =>
    this.bookings().map((b) => ({
      id: b.id,
      startMin: b.startMin,
      endMin: b.endMin,
      leftPct: (b.startMin / 1440) * 100,
      widthPct: ((b.endMin - b.startMin) / 1440) * 100,
    }))
  );

  readonly selection = computed(() => {
    const a = this.dragStartSlot();
    const b = this.dragEndSlot();
    if (a === null || b === null) return null;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b) + 1;
    return { startMin: lo * SLOT, endMin: hi * SLOT };
  });

  readonly selectionBlock = computed<Block | null>(() => {
    const s = this.selection();
    if (!s) return null;
    return {
      id: -1,
      startMin: s.startMin,
      endMin: s.endMin,
      leftPct: (s.startMin / 1440) * 100,
      widthPct: ((s.endMin - s.startMin) / 1440) * 100,
    };
  });

  readonly selectionValid = computed(() => {
    const s = this.selection();
    if (!s) return false;
    return !this.bookings().some((b) => s.startMin < b.endMin && b.startMin < s.endMin);
  });

  constructor() {
    effect(() => {
      this.bookings();
      this.dragStartSlot.set(null);
      this.dragEndSlot.set(null);
      this.dragging.set(false);
      this.description.set('');
    });
  }

  private slotFromEvent(clientX: number): number {
    const el = this.track()?.nativeElement;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    let slot = Math.floor(ratio * SLOTS);
    if (slot >= SLOTS) slot = SLOTS - 1;
    if (slot < 0) slot = 0;
    return slot;
  }

  private isSlotBooked(slot: number): boolean {
    const start = slot * SLOT;
    const end = start + SLOT;
    return this.bookings().some((b) => start < b.endMin && b.startMin < end);
  }

  onPointerDown(ev: PointerEvent): void {
    if (!this.canBook()) return;
    const slot = this.slotFromEvent(ev.clientX);
    if (this.isSlotBooked(slot)) return;
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    this.dragging.set(true);
    this.dragStartSlot.set(slot);
    this.dragEndSlot.set(slot);
  }

  onPointerMove(ev: PointerEvent): void {
    if (!this.dragging()) return;
    const start = this.dragStartSlot();
    if (start === null) return;
    let slot = this.slotFromEvent(ev.clientX);

    const step = slot >= start ? 1 : -1;
    let clamped = start;
    for (let s = start; step > 0 ? s <= slot : s >= slot; s += step) {
      if (this.isSlotBooked(s)) break;
      clamped = s;
    }
    this.dragEndSlot.set(clamped);
  }

  onPointerUp(ev: PointerEvent): void {
    if (!this.dragging()) return;
    (ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId);
    this.dragging.set(false);
  }

  clearSelection(): void {
    this.dragStartSlot.set(null);
    this.dragEndSlot.set(null);
    this.description.set('');
  }

  confirmBook(): void {
    const s = this.selection();
    if (!s || !this.selectionValid()) return;
    const desc = this.description().trim() || null;
    this.book.emit({ ...s, description: desc });
    this.description.set('');
  }

  onDelete(ev: Event, id: number): void {
    ev.stopPropagation();
    this.deleteBooking.emit(id);
  }

  label(min: number): string {
    return minToLabel(min);
  }

  hhmm(min: number): string {
    return minToHHMM(min);
  }

  hourLeft(h: number): number {
    return (h / 24) * 100;
  }
}
