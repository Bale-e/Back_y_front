import { __esDecorate, __runInitializers } from "tslib";
/*
  Módulo principal de la aplicación.
  Descripción: declara el `AppComponent`, configura módulos globales y exporta/arranca la app.
*/
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http'; // REQUIRED for JSON loading
import { AppComponent } from './app.component';
import { Map3dFeatureModule } from './features/map3d/map3d.feature.module';
let AppModule = (() => {
    let _classDecorators = [NgModule({
            declarations: [AppComponent],
            imports: [
                BrowserModule,
                HttpClientModule, // ← NON-NEGOTIABLE FOR LOADING path.json
                Map3dFeatureModule
            ],
            bootstrap: [AppComponent]
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var AppModule = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            AppModule = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
    };
    return AppModule = _classThis;
})();
export { AppModule };
