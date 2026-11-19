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
import { NavDrawerComponent } from './components/nav-drawer/nav-drawer.component';

@NgModule({
  declarations: [
    NavDrawerComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    CommonModule,
    FormsModule,
    NavDrawerComponent
  ]
})
export class SharedModule { }