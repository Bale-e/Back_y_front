import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { AdminPanelComponent } from './admin/admin-panel.component';
import { Map3dModule } from './map3d/map3d.module';
import { SharedModule } from './shared/shared.module';

@NgModule({ declarations: [
        AppComponent,
        AdminPanelComponent
    ],
    bootstrap: [AppComponent], imports: [BrowserModule,
        FormsModule,
        Map3dModule,
        SharedModule], providers: [provideHttpClient(withInterceptorsFromDi())] })
export class AppModule { }