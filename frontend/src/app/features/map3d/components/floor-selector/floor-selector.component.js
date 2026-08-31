import { __esDecorate, __runInitializers } from "tslib";
import { Component, EventEmitter, Input, Output } from '@angular/core';
let FloorSelectorComponent = (() => {
    let _classDecorators = [Component({
            selector: 'app-floor-selector',
            templateUrl: './floor-selector.component.html',
            styleUrls: ['./floor-selector.component.scss']
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _currentBuilding_decorators;
    let _currentBuilding_initializers = [];
    let _currentBuilding_extraInitializers = [];
    let _currentFloorName_decorators;
    let _currentFloorName_initializers = [];
    let _currentFloorName_extraInitializers = [];
    let _floorSelected_decorators;
    let _floorSelected_initializers = [];
    let _floorSelected_extraInitializers = [];
    let _buildingSelected_decorators;
    let _buildingSelected_initializers = [];
    let _buildingSelected_extraInitializers = [];
    var FloorSelectorComponent = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _currentBuilding_decorators = [Input()];
            _currentFloorName_decorators = [Input()];
            _floorSelected_decorators = [Output()];
            _buildingSelected_decorators = [Output()];
            __esDecorate(null, null, _currentBuilding_decorators, { kind: "field", name: "currentBuilding", static: false, private: false, access: { has: obj => "currentBuilding" in obj, get: obj => obj.currentBuilding, set: (obj, value) => { obj.currentBuilding = value; } }, metadata: _metadata }, _currentBuilding_initializers, _currentBuilding_extraInitializers);
            __esDecorate(null, null, _currentFloorName_decorators, { kind: "field", name: "currentFloorName", static: false, private: false, access: { has: obj => "currentFloorName" in obj, get: obj => obj.currentFloorName, set: (obj, value) => { obj.currentFloorName = value; } }, metadata: _metadata }, _currentFloorName_initializers, _currentFloorName_extraInitializers);
            __esDecorate(null, null, _floorSelected_decorators, { kind: "field", name: "floorSelected", static: false, private: false, access: { has: obj => "floorSelected" in obj, get: obj => obj.floorSelected, set: (obj, value) => { obj.floorSelected = value; } }, metadata: _metadata }, _floorSelected_initializers, _floorSelected_extraInitializers);
            __esDecorate(null, null, _buildingSelected_decorators, { kind: "field", name: "buildingSelected", static: false, private: false, access: { has: obj => "buildingSelected" in obj, get: obj => obj.buildingSelected, set: (obj, value) => { obj.buildingSelected = value; } }, metadata: _metadata }, _buildingSelected_initializers, _buildingSelected_extraInitializers);
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            FloorSelectorComponent = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        currentBuilding = __runInitializers(this, _currentBuilding_initializers, 'A');
        currentFloorName = (__runInitializers(this, _currentBuilding_extraInitializers), __runInitializers(this, _currentFloorName_initializers, 'Piso 1'));
        floorSelected = (__runInitializers(this, _currentFloorName_extraInitializers), __runInitializers(this, _floorSelected_initializers, new EventEmitter()));
        buildingSelected = (__runInitializers(this, _floorSelected_extraInitializers), __runInitializers(this, _buildingSelected_initializers, new EventEmitter()));
        isDialogVisible = (__runInitializers(this, _buildingSelected_extraInitializers), false);
        get floorActionIcon() {
            if (this.currentBuilding === 'S')
                return '🏢';
            return '🏢';
        }
        toggleDialog() {
            this.isDialogVisible = !this.isDialogVisible;
        }
        openDialog() {
            this.isDialogVisible = true;
        }
        closeDialog() {
            this.isDialogVisible = false;
        }
        selectFloor(floorKey) {
            this.floorSelected.emit(floorKey);
            this.closeDialog();
        }
        selectBuilding(building) {
            this.buildingSelected.emit(building);
            this.closeDialog();
        }
    };
    return FloorSelectorComponent = _classThis;
})();
export { FloorSelectorComponent };
