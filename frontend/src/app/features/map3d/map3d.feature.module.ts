/*
  Módulo de la funcionalidad del mapa 3D.
  Descripción: declara e importa los componentes del visor 3D (BabylonJS) y subcomponentes UI.
*/
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Map3dContainerComponent } from './components/map3d-container.component';
import { MapSearchComponent } from './components/map-search/map-search.component';
import { FloorSelectorComponent } from './components/floor-selector/floor-selector.component';
import { LocationDetailPanelComponent } from './components/location-detail-panel/location-detail-panel.component';
import { MapControlsComponent } from './components/map-controls/map-controls.component';

@NgModule({
  declarations: [
    Map3dContainerComponent,
    MapSearchComponent,
    FloorSelectorComponent,
    LocationDetailPanelComponent,
    MapControlsComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    Map3dContainerComponent,
    MapSearchComponent,
    FloorSelectorComponent,
    LocationDetailPanelComponent,
    MapControlsComponent
  ]
})
export class Map3dFeatureModule { }