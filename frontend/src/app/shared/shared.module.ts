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

@NgModule({
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    CommonModule,
    FormsModule
  ]
})
export class SharedModule { }