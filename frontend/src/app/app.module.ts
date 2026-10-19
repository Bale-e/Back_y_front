import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { AdminPanelComponent } from './admin/admin-panel.component';
import { Map3dModule } from './map3d/map3d.module';

@NgModule({
  declarations: [
    AppComponent,
    AdminPanelComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    Map3dModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }