import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { BuildingDefinition, BuildingId, FloorDefinition } from '../../../core/models/navegacion.model';
import { BuildingRegistryService } from '../../../core/services/building-registry.service';

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

  constructor(
    private elementRef: ElementRef,
    public buildingRegistry: BuildingRegistryService
  ) {}

  get availableFloors(): FloorDefinition[] {
    return this.buildingRegistry.getFloorsForBuilding(this.currentBuilding);
  }

  get availableBuildings(): BuildingDefinition[] {
    return this.buildingRegistry.getNavigableBuildings();
  }

  get floorActionIcon(): string {
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

  selectFloor(floorKey: string): void {
    this.floorSelected.emit(floorKey);
    this.closeDialog();
  }

  selectFloorNumber(floorNumber: number): void {
    const key = floorNumber === 1 ? 'first' : (floorNumber === 2 ? 'second' : (floorNumber === 3 ? 'third' : `floor_${floorNumber}`));
    this.floorSelected.emit(key);
    this.closeDialog();
  }

  selectBuilding(building: BuildingId): void {
    this.buildingSelected.emit(building);
    this.closeDialog();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.ignoreNextDocClick) {
      return;
    }
    if (this.isDialogVisible && !this.elementRef.nativeElement.contains(event.target)) {
      this.isDialogVisible = false;
    }
  }
}
