import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BuildingId } from '../../../../core/models/navigation.model';

@Component({
  selector: 'app-floor-selector',
  templateUrl: './floor-selector.component.html',
  styleUrls: ['./floor-selector.component.scss']
})
export class FloorSelectorComponent {
  @Input() currentBuilding: BuildingId = 'A';
  @Input() currentFloorName = 'Piso 1';
  @Output() floorSelected = new EventEmitter<string>();
  @Output() buildingSelected = new EventEmitter<BuildingId>();

  isDialogVisible = false;

  get floorActionIcon(): string {
    if (this.currentBuilding === 'S') return '🏢';
    return '🏢';
  }

  toggleDialog(): void {
    this.isDialogVisible = !this.isDialogVisible;
  }

  openDialog(): void {
    this.isDialogVisible = true;
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
