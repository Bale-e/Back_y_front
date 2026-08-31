import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Map3dContainerComponent } from './components/map3d-container.component';
import { FloorSelectorComponent } from './components/floor-selector/floor-selector.component';
import { LocationDetailPanelComponent } from './components/location-detail-panel/location-detail-panel.component';
import { MapControlsComponent } from './components/map-controls/map-controls.component';
import { MapSearchComponent } from './components/map-search/map-search.component';

@NgModule({
  declarations: [
    Map3dContainerComponent,
    FloorSelectorComponent,
    LocationDetailPanelComponent,
    MapControlsComponent,
    MapSearchComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    Map3dContainerComponent
  ]
})
export class Map3dModule {}
