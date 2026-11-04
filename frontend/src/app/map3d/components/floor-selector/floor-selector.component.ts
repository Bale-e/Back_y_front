import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { BuildingId } from '../../../core/models/navegacion.model';

@Component({
  selector: 'app-floor-selector',
  templateUrl: './floor-selector.component.html',
  styleUrls: ['./floor-selector.component.scss']
})
export class FloorSelectorComponent {
  @Input() currentBuilding: BuildingId = 'S';
  @Input() currentFloorName = 'Piso 1';
  @Output() floorSelected = new EventEmitter<string>();
  @Output() buildingSelected = new EventEmitter<BuildingId>();

  isDialogVisible = false;
  private ignoreNextDocClick = false;

  constructor(private elementRef: ElementRef) {}

  /** Cierra el menú al hacer clic en cualquier lugar fuera de este componente */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.ignoreNextDocClick) {
      return;
    }
    if (this.isDialogVisible && !this.elementRef.nativeElement.contains(event.target)) {
      this.isDialogVisible = false;
    }
  }

  get floorActionIcon(): string {
    if (this.currentBuilding === 'S') return '🏢';
    return '🏢';
  }

  toggleDialog(): void {
    this.isDialogVisible = !this.isDialogVisible;
    if (this.isDialogVisible) {
      this.ignoreNextDocClick = true;
      setTimeout(() => {
        this.ignoreNextDocClick = false;
      }, 100);
    }
  }

  openDialog(): void {
    this.isDialogVisible = true;
    this.ignoreNextDocClick = true;
    setTimeout(() => {
      this.ignoreNextDocClick = false;
    }, 100);
  }

  closeDialog(): void {
    this.isDialogVisible = false;
  }

  selectFloor(floorKey: 'first' | 'second' | 'third'): void {
    this.floorSelected.emit(floorKey);
    this.closeDialog();
  }

  selectBuilding(building: BuildingId): void {
    this.buildingSelected.emit(building);
    this.closeDialog();
  }
}
