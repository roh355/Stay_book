import {
  Component,
  ElementRef,
  HostListener,
  computed,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { addDaysISO, formatDateLong, todayISO } from '../../utils/time';

export type RangeKey = '15d' | '1m' | '3m' | '1y';

interface RangeOption {
  key: RangeKey;
  label: string;
}

@Component({
  selector: 'app-booking-sidebar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './booking-sidebar.component.html',
  styleUrl: './booking-sidebar.component.css',
})
export class BookingSidebarComponent {
  date = model.required<string>();
  floor = model.required<number>();
  floors = input.required<number[]>();
  active = input<boolean>(false);
  // When true, show the "look ahead" range selector (hostel only).
  showRange = input<boolean>(false);
  range = model<RangeKey>('15d');
  status = output<void>();

  readonly minDate = todayISO();
  readonly prettyDate = computed(() => formatDateLong(this.date()));

  readonly rangeOptions: RangeOption[] = [
    { key: '15d', label: '15 days' },
    { key: '1m', label: '1 month' },
    { key: '3m', label: '3 months' },
    { key: '1y', label: '1 year' },
  ];

  floorMenuOpen = signal(false);
  private dateInput = viewChild<ElementRef<HTMLInputElement>>('dateInput');

  private floorIndex(): number {
    return this.floors().indexOf(this.floor());
  }

  get canPrevFloor(): boolean {
    return this.floorIndex() > 0;
  }
  get canNextFloor(): boolean {
    return this.floorIndex() < this.floors().length - 1;
  }
  get canPrevDate(): boolean {
    return this.date() > this.minDate;
  }

  prevFloor(): void {
    const i = this.floorIndex();
    if (i > 0) this.floor.set(this.floors()[i - 1]);
  }
  nextFloor(): void {
    const i = this.floorIndex();
    if (i < this.floors().length - 1) this.floor.set(this.floors()[i + 1]);
  }
  prevDate(): void {
    if (this.canPrevDate) this.date.set(addDaysISO(this.date(), -1));
  }
  nextDate(): void {
    this.date.set(addDaysISO(this.date(), 1));
  }

  toggleFloorMenu(ev: Event): void {
    ev.stopPropagation();
    this.floorMenuOpen.update((open) => !open);
  }
  selectFloor(f: number): void {
    this.floor.set(f);
    this.floorMenuOpen.set(false);
  }

  openCalendar(): void {
    const el = this.dateInput()?.nativeElement;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        // Fall through to focus/click for browsers that reject showPicker().
      }
    }
    el.focus();
    el.click();
  }

  setRange(key: RangeKey): void {
    this.range.set(key);
  }

  // Close the floor dropdown on any outside click. The toggle stops
  // propagation so its own click doesn't immediately re-close it.
  @HostListener('document:click')
  onDocumentClick(): void {
    this.floorMenuOpen.set(false);
  }
}
