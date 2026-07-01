import { Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { addDaysISO, formatDateLong, todayISO } from '../../utils/time';

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
  status = output<void>();

  readonly minDate = todayISO();
  readonly prettyDate = computed(() => formatDateLong(this.date()));

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

  onFloorChange(value: string): void {
    this.floor.set(Number(value));
  }
}
