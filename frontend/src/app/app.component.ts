/**
 * Componente raíz de la aplicación.
 * Monta el visor 3D y el nuevo panel lateral de navegación (NavDrawerComponent).
 * Actúa como puente entre el drawer y el Map3dContainerComponent.
 */
import { AfterViewInit, Component, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
import { EspaciosApiService } from './services/espacios-api.service';
import { Map3dContainerComponent } from './map3d/components/map3d-container.component';
import { BuildingId } from './core/models/navegacion.model';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    standalone: false
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(Map3dContainerComponent) mapContainer?: Map3dContainerComponent;

  drawerOpen = false;
  adminPanelOpen = false;

  private hamburgerListener?: () => void;
  private hashListener?: () => void;

  constructor(
    private espaciosApiService: EspaciosApiService,
    private renderer: Renderer2
  ) {}

  openAdminPanel(): void {
    this.closeDrawer();
    this.adminPanelOpen = true;
    if (window.location.hash.toLowerCase() !== '#admin') {
      window.location.hash = 'admin';
    }
  }

  closeAdminPanel(): void {
    this.adminPanelOpen = false;
    if (window.location.hash.toLowerCase() === '#admin') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  private checkAdminHash(): void {
    if (window.location.hash.toLowerCase() === '#admin') {
      this.adminPanelOpen = true;
    }
  }

  ngOnInit(): void {
    // 1. Vincular el botón hamburguesa INMEDIATAMENTE (sin esperar llamadas asíncronas)
    this.setupHamburgerListener();

    this.checkAdminHash();

    this.hashListener = this.renderer.listen('window', 'hashchange', () => {
      this.checkAdminHash();
    });

    // Carga inicial en segundo plano sin bloquear el arranque de la app
    this.espaciosApiService.getEdificios().catch(() => []);

    // Expone ayuda global en ventana para diagnóstico rápido si es necesario
    (window as any).toggleDrawer = () => this.toggleDrawer();
    (window as any).openDrawer = () => { this.drawerOpen = true; };
    (window as any).closeDrawer = () => { this.drawerOpen = false; };
  }

  ngAfterViewInit(): void {
    // Asegurar vinculación del botón por si el DOM demoró en inicializarse
    this.setupHamburgerListener();
  }

  private setupHamburgerListener(): void {
    if (this.hamburgerListener) return;
    const hamburgerBtn = document.getElementById('hamburgerMenuBtn');
    if (hamburgerBtn) {
      this.hamburgerListener = this.renderer.listen(hamburgerBtn, 'click', () => {
        this.toggleDrawer();
      });
    }
  }

  ngOnDestroy(): void {
    if (this.hamburgerListener) this.hamburgerListener();
    if (this.hashListener) this.hashListener();
  }

  toggleDrawer(): void {
    this.drawerOpen = !this.drawerOpen;
  }

  closeDrawer(): void {
    this.drawerOpen = false;
  }

  // ── Bridge: NavDrawer → Map3dContainer ───────────────────────────────────

  /**
   * Llamado cuando el drawer selecciona una localidad.
   * Dispara el mismo comportamiento interactivo que hacer clic en los cuerpos 3D del mapa:
   * transición de piso/edificio, enfoque de cámara y apertura del panel de detalle con botón "Cómo llegar".
   */
  onSelectLocation(location: any): void {
    this.mapContainer?.selectLocationFromDrawer(location);
  }

  /**
   * Llamado cuando el usuario selecciona un destino con nombre (sala, escalera, oficina).
   * Delega a onDestinationSelected del Map3dContainer.
   */
  onDestinationSelected(destinationName: string): void {
    this.mapContainer?.onDestinationSelected(destinationName);
  }

  /**
   * Llamado cuando el drawer pide enfocar un mesh específico (baños, biblioteca).
   * Primero navega al edificio/piso y luego enfoca el mesh.
   */
  onFocusMesh(event: { meshName: string; buildingId: BuildingId; floorNum: number }): void {
    this.mapContainer?.focusOnMeshExternal(event.meshName);
  }

  /**
   * Llamado para cambiar edificio/piso antes de enfocar.
   */
  onNavigateTo(event: { buildingId: BuildingId; floorNum: number }): void {
    this.mapContainer?.goToFloor(event.buildingId, event.floorNum);
  }
}
