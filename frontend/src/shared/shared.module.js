import { __esDecorate, __runInitializers } from "tslib";
/**
 * SharedModule — Módulo compartido.
 * Contiene y exporta pipes, directivas y componentes reutilizables en múltiples features.
 * Importar este módulo en cualquier feature module que necesite sus exports.
 *
 * IMPORTANTE: No agregar providers (servicios) aquí — usar CoreModule o providedIn: 'root'.
 */
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
let SharedModule = (() => {
    let _classDecorators = [NgModule({
            imports: [
                CommonModule,
                FormsModule
            ],
            exports: [
                CommonModule,
                FormsModule
            ]
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var SharedModule = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            SharedModule = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
    };
    return SharedModule = _classThis;
})();
export { SharedModule };
