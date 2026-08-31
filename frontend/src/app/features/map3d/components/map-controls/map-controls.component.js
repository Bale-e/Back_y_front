import { __esDecorate, __runInitializers } from "tslib";
import { Component, EventEmitter, Input, Output } from '@angular/core';
let MapControlsComponent = (() => {
    let _classDecorators = [Component({
            selector: 'app-map-controls',
            templateUrl: './map-controls.component.html',
            styleUrls: ['./map-controls.component.scss']
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _zoomOutEnabled_decorators;
    let _zoomOutEnabled_initializers = [];
    let _zoomOutEnabled_extraInitializers = [];
    let _zoomIn_decorators;
    let _zoomIn_initializers = [];
    let _zoomIn_extraInitializers = [];
    let _zoomOut_decorators;
    let _zoomOut_initializers = [];
    let _zoomOut_extraInitializers = [];
    let _resetCamera_decorators;
    let _resetCamera_initializers = [];
    let _resetCamera_extraInitializers = [];
    var MapControlsComponent = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _zoomOutEnabled_decorators = [Input()];
            _zoomIn_decorators = [Output()];
            _zoomOut_decorators = [Output()];
            _resetCamera_decorators = [Output()];
            __esDecorate(null, null, _zoomOutEnabled_decorators, { kind: "field", name: "zoomOutEnabled", static: false, private: false, access: { has: obj => "zoomOutEnabled" in obj, get: obj => obj.zoomOutEnabled, set: (obj, value) => { obj.zoomOutEnabled = value; } }, metadata: _metadata }, _zoomOutEnabled_initializers, _zoomOutEnabled_extraInitializers);
            __esDecorate(null, null, _zoomIn_decorators, { kind: "field", name: "zoomIn", static: false, private: false, access: { has: obj => "zoomIn" in obj, get: obj => obj.zoomIn, set: (obj, value) => { obj.zoomIn = value; } }, metadata: _metadata }, _zoomIn_initializers, _zoomIn_extraInitializers);
            __esDecorate(null, null, _zoomOut_decorators, { kind: "field", name: "zoomOut", static: false, private: false, access: { has: obj => "zoomOut" in obj, get: obj => obj.zoomOut, set: (obj, value) => { obj.zoomOut = value; } }, metadata: _metadata }, _zoomOut_initializers, _zoomOut_extraInitializers);
            __esDecorate(null, null, _resetCamera_decorators, { kind: "field", name: "resetCamera", static: false, private: false, access: { has: obj => "resetCamera" in obj, get: obj => obj.resetCamera, set: (obj, value) => { obj.resetCamera = value; } }, metadata: _metadata }, _resetCamera_initializers, _resetCamera_extraInitializers);
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            MapControlsComponent = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        zoomOutEnabled = __runInitializers(this, _zoomOutEnabled_initializers, true);
        zoomIn = (__runInitializers(this, _zoomOutEnabled_extraInitializers), __runInitializers(this, _zoomIn_initializers, new EventEmitter()));
        zoomOut = (__runInitializers(this, _zoomIn_extraInitializers), __runInitializers(this, _zoomOut_initializers, new EventEmitter()));
        resetCamera = (__runInitializers(this, _zoomOut_extraInitializers), __runInitializers(this, _resetCamera_initializers, new EventEmitter()));
        onZoomIn() {
            this.zoomIn.emit();
        }
        onZoomOut() {
            this.zoomOut.emit();
        }
        onReset() {
            this.resetCamera.emit();
        }
        constructor() {
            __runInitializers(this, _resetCamera_extraInitializers);
        }
    };
    return MapControlsComponent = _classThis;
})();
export { MapControlsComponent };
