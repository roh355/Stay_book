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
import { HostelInterval } from '../../models';
import { daysBetween, formatDateMedium, formatDayShort, listDays } from '../../utils/time';

const DAYS = 15;

interface DayCell {
  index: number;
  date: string;
  weekday: string;
  day: string;
}

interface Block {
  id: number;
  leftPct: number;
  widthPct: number;
}

@Component({
  selector: 'app-hostel-timeline',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './hostel-timeline.component.html',
  styleUrl: './hostel-timeline.component.css',
})
export class HostelTimelineComponent {
  bookings = input<HostelInterval[]>([]);
  baseDate = input.required<string>();
  canBook = input<boolean>(false);

  book = output<{ startDate: string; endDate: string; description: string | null }>();
  deleteBooking = output<number>();

  track = viewChild<ElementRef<HTMLDivElement>>('track');

  description = signal('');

  private dragStartSlot = signal<number | null>(null);
  private dragEndSlot = signal<number | null>(null);
  dragging = signal(false);

  readonly days = computed<DayCell[]>(() =>
    listDays(this.baseDate(), DAYS).map((date, index) => {
      const { weekday, day } = formatDayShort(date);
      return { index, date, weekday, day };
    })
  );

  readonly bookedBlocks = computed<Block[]>(() => {
    const base = this.baseDate();
    const blocks: Block[] = [];
    for (const b of this.bookings()) {
      let startIdx = daysBetween(base, b.startDate);
      let endIdx = daysBetween(base, b.endDate);
      if (endIdx < 0 || startIdx > DAYS - 1) continue;
      startIdx = Math.max(0, startIdx);
      endIdx = Math.min(DAYS - 1, endIdx);
      blocks.push({
        id: b.id,
        leftPct: (startIdx / DAYS) * 100,
        widthPct: ((endIdx - startIdx + 1) / DAYS) * 100,
      });
    }
    return blocks;
  });

  readonly selection = computed(() => {
    const a = this.dragStartSlot();
    const b = this.dragEndSlot();
    if (a === null || b === null) return null;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const days = this.days();
    return {
      lo,
      hi,
      startDate: days[lo].date,
      endDate: days[hi].date,
      count: hi - lo + 1,
    };
  });

  readonly selectionBlock = computed<Block | null>(() => {
    const s = this.selection();
    if (!s) return null;
    return {
      id: -1,
      leftPct: (s.lo / DAYS) * 100,
      widthPct: ((s.hi - s.lo + 1) / DAYS) * 100,
    };
  });

  readonly selectionValid = computed(() => {
    const s = this.selection();
    if (!s) return false;
    for (let i = s.lo; i <= s.hi; i++) {
      if (this.isSlotBooked(i)) return false;
    }
    return true;
  });

  constructor() {
    effect(() => {
      this.bookings();
      this.baseDate();
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
    let slot = Math.floor(ratio * DAYS);
    if (slot >= DAYS) slot = DAYS - 1;
    if (slot < 0) slot = 0;
    return slot;
  }

  private isSlotBooked(index: number): boolean {
    const day = this.days()[index]?.date;
    if (!day) return false;
    return this.bookings().some((b) => b.startDate <= day && b.endDate >= day);
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
    const slot = this.slotFromEvent(ev.clientX);

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
    this.book.emit({
      startDate: s.startDate,
      endDate: s.endDate,
      description: this.description().trim() || null,
    });
    this.description.set('');
  }

  onDelete(ev: Event, id: number): void {
    ev.stopPropagation();
    this.deleteBooking.emit(id);
  }

  rangeLabel(startDate: string, endDate: string): string {
    if (startDate === endDate) return formatDateMedium(startDate);
    return `${formatDateMedium(startDate)} → ${formatDateMedium(endDate)}`;
  }
}
