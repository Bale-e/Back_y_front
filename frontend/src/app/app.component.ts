/**
 * Componente raíz de la aplicación.
 * Descripción: inicia servicios esenciales y monta la vista principal que contiene el mapa 3D/2D.
 */
import { Component, OnDestroy, OnInit, Renderer2 } from '@angular/core';
import { Firebase } from './services/firebase';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  drawerOpen = false;
  selectedOption?: string;
  servicesMenu = ['Baños', 'Biblioteca', 'Cafetería', 'Enfermería', 'Recepción'];
  locationsMenu = ['Salas', 'Laboratorios', 'Oficinas', 'Escaleras', 'Salidas'];
  private hamburgerListener?: () => void;
  private selectionTimeout?: ReturnType<typeof setTimeout>;

  constructor(private firebaseService: Firebase, private renderer: Renderer2) {}

  async ngOnInit() {
    await this.firebaseService.getEdificios();

    const hamburgerBtn = document.getElementById('hamburgerMenuBtn');
    if (hamburgerBtn) {
      this.hamburgerListener = this.renderer.listen(hamburgerBtn, 'click', () => {
        this.toggleDrawer();
      });
    }
  }

  ngOnDestroy(): void {
    if (this.hamburgerListener) {
      this.hamburgerListener();
    }
  }

  toggleDrawer(): void {
    this.drawerOpen = !this.drawerOpen;
    if (!this.drawerOpen) {
      this.clearSelection();
    }
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.clearSelection();
  }

  onServiceClick(service: string): void {
    this.setSelectedOption(service);
    // TODO: implementar lógica específica para servicios.
  }

  onLocationClick(location: string): void {
    this.setSelectedOption(location);
    // TODO: implementar lógica específica para ubicaciones.
  }

  private setSelectedOption(option: string): void {
    this.selectedOption = option;
    this.clearSelectionTimeout();
    this.selectionTimeout = setTimeout(() => {
      this.clearSelection();
    }, 5000);
  }

  private clearSelectionTimeout(): void {
    if (this.selectionTimeout) {
      clearTimeout(this.selectionTimeout);
      this.selectionTimeout = undefined;
    }
  }

  private clearSelection(): void {
    this.selectedOption = undefined;
    this.clearSelectionTimeout();
  }
}
