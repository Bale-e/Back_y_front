import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SelectedLocationInfo } from '../../../../core/models/navigation.model';

@Component({
  selector: 'app-location-detail-panel',
  templateUrl: './location-detail-panel.component.html',
  styleUrls: ['./location-detail-panel.component.scss']
})
export class LocationDetailPanelComponent {
  @Input() locationInfo: SelectedLocationInfo | null = null;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() navigateTo = new EventEmitter<string>();

  onClose(): void {
    this.close.emit();
  }

  onNavigate(): void {
    if (this.locationInfo?.nombre) {
      this.navigateTo.emit(this.locationInfo.nombre);
    }
  }
}
