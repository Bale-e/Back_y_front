import { __esDecorate, __runInitializers } from "tslib";
/**
 * Componente raíz de la aplicación.
 * Descripción: inicia servicios esenciales y monta la vista principal que contiene el mapa 3D/2D.
 */
import { Component } from '@angular/core';
let AppComponent = (() => {
    let _classDecorators = [Component({
            selector: 'app-root',
            templateUrl: './app.component.html',
            styleUrls: ['./app.component.scss']
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var AppComponent = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            AppComponent = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        firebaseService;
        renderer;
        drawerOpen = false;
        selectedOption;
        servicesMenu = ['Baños', 'Biblioteca', 'Cafetería', 'Enfermería', 'Recepción'];
        locationsMenu = ['Salas', 'Laboratorios', 'Oficinas', 'Escaleras', 'Salidas'];
        hamburgerListener;
        selectionTimeout;
        constructor(firebaseService, renderer) {
            this.firebaseService = firebaseService;
            this.renderer = renderer;
        }
        async ngOnInit() {
            await this.firebaseService.getEdificios();
            const hamburgerBtn = document.getElementById('hamburgerMenuBtn');
            if (hamburgerBtn) {
                this.hamburgerListener = this.renderer.listen(hamburgerBtn, 'click', () => {
                    this.toggleDrawer();
                });
            }
        }
        ngOnDestroy() {
            if (this.hamburgerListener) {
                this.hamburgerListener();
            }
        }
        toggleDrawer() {
            this.drawerOpen = !this.drawerOpen;
            if (!this.drawerOpen) {
                this.clearSelection();
            }
        }
        closeDrawer() {
            this.drawerOpen = false;
            this.clearSelection();
        }
        onServiceClick(service) {
            this.setSelectedOption(service);
            // TODO: implementar lógica específica para servicios.
        }
        onLocationClick(location) {
            this.setSelectedOption(location);
            // TODO: implementar lógica específica para ubicaciones.
        }
        setSelectedOption(option) {
            this.selectedOption = option;
            this.clearSelectionTimeout();
            this.selectionTimeout = setTimeout(() => {
                this.clearSelection();
            }, 5000);
        }
        clearSelectionTimeout() {
            if (this.selectionTimeout) {
                clearTimeout(this.selectionTimeout);
                this.selectionTimeout = undefined;
            }
        }
        clearSelection() {
            this.selectedOption = undefined;
            this.clearSelectionTimeout();
        }
    };
    return AppComponent = _classThis;
})();
export { AppComponent };
