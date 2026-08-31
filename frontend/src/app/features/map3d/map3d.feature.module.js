import { __esDecorate, __runInitializers } from "tslib";
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
let Map3dFeatureModule = (() => {
    let _classDecorators = [NgModule({
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
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Map3dFeatureModule = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            Map3dFeatureModule = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
    };
    return Map3dFeatureModule = _classThis;
})();
export { Map3dFeatureModule };
