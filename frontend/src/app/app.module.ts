/*
  Módulo principal de la aplicación.
  Descripción: declara el `AppComponent`, configura módulos globales y exporta/arranca la app.
*/
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http'; // REQUIRED for JSON loading
import { AppComponent } from './app.component';
import { Map3dFeatureModule } from './features/map3d/map3d.feature.module';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule, // ← NON-NEGOTIABLE FOR LOADING path.json
    Map3dFeatureModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }