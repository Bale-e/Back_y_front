import { __esDecorate, __runInitializers } from "tslib";
import { Component, EventEmitter, Input, Output } from '@angular/core';
let LocationDetailPanelComponent = (() => {
    let _classDecorators = [Component({
            selector: 'app-location-detail-panel',
            templateUrl: './location-detail-panel.component.html',
            styleUrls: ['./location-detail-panel.component.scss']
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _locationInfo_decorators;
    let _locationInfo_initializers = [];
    let _locationInfo_extraInitializers = [];
    let _isOpen_decorators;
    let _isOpen_initializers = [];
    let _isOpen_extraInitializers = [];
    let _close_decorators;
    let _close_initializers = [];
    let _close_extraInitializers = [];
    let _navigateTo_decorators;
    let _navigateTo_initializers = [];
    let _navigateTo_extraInitializers = [];
    var LocationDetailPanelComponent = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _locationInfo_decorators = [Input()];
            _isOpen_decorators = [Input()];
            _close_decorators = [Output()];
            _navigateTo_decorators = [Output()];
            __esDecorate(null, null, _locationInfo_decorators, { kind: "field", name: "locationInfo", static: false, private: false, access: { has: obj => "locationInfo" in obj, get: obj => obj.locationInfo, set: (obj, value) => { obj.locationInfo = value; } }, metadata: _metadata }, _locationInfo_initializers, _locationInfo_extraInitializers);
            __esDecorate(null, null, _isOpen_decorators, { kind: "field", name: "isOpen", static: false, private: false, access: { has: obj => "isOpen" in obj, get: obj => obj.isOpen, set: (obj, value) => { obj.isOpen = value; } }, metadata: _metadata }, _isOpen_initializers, _isOpen_extraInitializers);
            __esDecorate(null, null, _close_decorators, { kind: "field", name: "close", static: false, private: false, access: { has: obj => "close" in obj, get: obj => obj.close, set: (obj, value) => { obj.close = value; } }, metadata: _metadata }, _close_initializers, _close_extraInitializers);
            __esDecorate(null, null, _navigateTo_decorators, { kind: "field", name: "navigateTo", static: false, private: false, access: { has: obj => "navigateTo" in obj, get: obj => obj.navigateTo, set: (obj, value) => { obj.navigateTo = value; } }, metadata: _metadata }, _navigateTo_initializers, _navigateTo_extraInitializers);
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            LocationDetailPanelComponent = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        locationInfo = __runInitializers(this, _locationInfo_initializers, null);
        isOpen = (__runInitializers(this, _locationInfo_extraInitializers), __runInitializers(this, _isOpen_initializers, false));
        close = (__runInitializers(this, _isOpen_extraInitializers), __runInitializers(this, _close_initializers, new EventEmitter()));
        navigateTo = (__runInitializers(this, _close_extraInitializers), __runInitializers(this, _navigateTo_initializers, new EventEmitter()));
        onClose() {
            this.close.emit();
        }
        onNavigate() {
            if (this.locationInfo?.nombre) {
                this.navigateTo.emit(this.locationInfo.nombre);
            }
        }
        constructor() {
            __runInitializers(this, _navigateTo_extraInitializers);
        }
    };
    return LocationDetailPanelComponent = _classThis;
})();
export { LocationDetailPanelComponent };
