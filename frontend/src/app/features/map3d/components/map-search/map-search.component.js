import { __esDecorate, __runInitializers } from "tslib";
import { Component, EventEmitter, Input, Output } from '@angular/core';
let MapSearchComponent = (() => {
    let _classDecorators = [Component({
            selector: 'app-map-search',
            templateUrl: './map-search.component.html',
            styleUrls: ['./map-search.component.scss']
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _destinations_decorators;
    let _destinations_initializers = [];
    let _destinations_extraInitializers = [];
    let _statusText_decorators;
    let _statusText_initializers = [];
    let _statusText_extraInitializers = [];
    let _destinationSelected_decorators;
    let _destinationSelected_initializers = [];
    let _destinationSelected_extraInitializers = [];
    let _searchCleared_decorators;
    let _searchCleared_initializers = [];
    let _searchCleared_extraInitializers = [];
    var MapSearchComponent = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _destinations_decorators = [Input()];
            _statusText_decorators = [Input()];
            _destinationSelected_decorators = [Output()];
            _searchCleared_decorators = [Output()];
            __esDecorate(null, null, _destinations_decorators, { kind: "field", name: "destinations", static: false, private: false, access: { has: obj => "destinations" in obj, get: obj => obj.destinations, set: (obj, value) => { obj.destinations = value; } }, metadata: _metadata }, _destinations_initializers, _destinations_extraInitializers);
            __esDecorate(null, null, _statusText_decorators, { kind: "field", name: "statusText", static: false, private: false, access: { has: obj => "statusText" in obj, get: obj => obj.statusText, set: (obj, value) => { obj.statusText = value; } }, metadata: _metadata }, _statusText_initializers, _statusText_extraInitializers);
            __esDecorate(null, null, _destinationSelected_decorators, { kind: "field", name: "destinationSelected", static: false, private: false, access: { has: obj => "destinationSelected" in obj, get: obj => obj.destinationSelected, set: (obj, value) => { obj.destinationSelected = value; } }, metadata: _metadata }, _destinationSelected_initializers, _destinationSelected_extraInitializers);
            __esDecorate(null, null, _searchCleared_decorators, { kind: "field", name: "searchCleared", static: false, private: false, access: { has: obj => "searchCleared" in obj, get: obj => obj.searchCleared, set: (obj, value) => { obj.searchCleared = value; } }, metadata: _metadata }, _searchCleared_initializers, _searchCleared_extraInitializers);
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            MapSearchComponent = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        destinations = __runInitializers(this, _destinations_initializers, []);
        statusText = (__runInitializers(this, _destinations_extraInitializers), __runInitializers(this, _statusText_initializers, ''));
        destinationSelected = (__runInitializers(this, _statusText_extraInitializers), __runInitializers(this, _destinationSelected_initializers, new EventEmitter()));
        searchCleared = (__runInitializers(this, _destinationSelected_extraInitializers), __runInitializers(this, _searchCleared_initializers, new EventEmitter()));
        searchQuery = (__runInitializers(this, _searchCleared_extraInitializers), '');
        filteredDestinations = [];
        isSuggestionsOpen = false;
        onSearchChange() {
            const query = this.searchQuery.trim().toLowerCase();
            if (!query) {
                this.filteredDestinations = [];
                this.isSuggestionsOpen = false;
                return;
            }
            this.filteredDestinations = this.destinations
                .filter(d => d.toLowerCase().includes(query))
                .slice(0, 8);
            this.isSuggestionsOpen = this.filteredDestinations.length > 0;
        }
        selectDestination(dest) {
            this.searchQuery = dest;
            this.isSuggestionsOpen = false;
            this.destinationSelected.emit(dest);
        }
        clearSearch() {
            this.searchQuery = '';
            this.filteredDestinations = [];
            this.isSuggestionsOpen = false;
            this.searchCleared.emit();
        }
        onBlur() {
            setTimeout(() => {
                this.isSuggestionsOpen = false;
            }, 200);
        }
    };
    return MapSearchComponent = _classThis;
})();
export { MapSearchComponent };
