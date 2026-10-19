import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { EspaciosApiService } from '../services/espacios-api.service';
import { Edificio } from '../core/models/edificio.model';

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss']
})
export class AdminPanelComponent implements OnInit {
  @Output() cerrar = new EventEmitter<void>();

  // Clave de acceso exclusiva para los 4 administradores
  private readonly ADMIN_PASSWORD = 'Inago_Mapa_26';

  isAuthenticated = false;
  passwordInput = '';
  authError = '';

  edificios: any[] = [];
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  // Formulario
  formData = {
    id: '',
    nombre: '',
    pisosTexto: ''
  };
  isEditing = false;

  constructor(private espaciosApiService: EspaciosApiService) {}

  ngOnInit(): void {
    // Si ya inició sesión anteriormente en esta sesión de pestaña, la recordamos
    const storedAuth = sessionStorage.getItem('inago_admin_auth');
    if (storedAuth === 'true') {
      this.isAuthenticated = true;
      this.cargarEdificios();
    }
  }

  verificarAcceso(): void {
    this.authError = '';
    if (this.passwordInput === this.ADMIN_PASSWORD) {
      this.isAuthenticated = true;
      sessionStorage.setItem('inago_admin_auth', 'true');
      this.cargarEdificios();
    } else {
      this.authError = 'Contraseña incorrecta. Acceso restringido únicamente a los 4 administradores.';
    }
  }

  cerrarSesionAdmin(): void {
    sessionStorage.removeItem('inago_admin_auth');
    this.isAuthenticated = false;
    this.passwordInput = '';
    this.cerrar.emit();
  }

  async cargarEdificios(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      this.edificios = await this.espaciosApiService.getEdificios();
    } catch (err: any) {
      this.errorMessage = 'Error al cargar los edificios: ' + (err.message || err);
    } finally {
      this.isLoading = false;
    }
  }

  async guardarEdificio(): Promise<void> {
    this.successMessage = '';
    this.errorMessage = '';

    const nombreLimpio = this.formData.nombre.trim();
    if (!nombreLimpio) {
      this.errorMessage = 'El nombre del edificio es obligatorio.';
      return;
    }

    // Convertir pisos separados por comas en array
    const pisosArray = this.formData.pisosTexto
      ? this.formData.pisosTexto.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
      : ['Piso 1'];

    const payload = {
      Nombre: nombreLimpio,
      Piso: pisosArray,
      Pisos: pisosArray
    };

    try {
      if (this.isEditing && this.formData.id) {
        await this.espaciosApiService.actualizarEdificio(this.formData.id, payload);
        this.successMessage = `Edificio "${nombreLimpio}" actualizado exitosamente.`;
      } else {
        await this.espaciosApiService.crearEdificio(payload);
        this.successMessage = `Edificio "${nombreLimpio}" creado exitosamente en Firestore.`;
      }

      this.limpiarFormulario();
      await this.cargarEdificios();
    } catch (err: any) {
      this.errorMessage = 'Error al guardar el edificio: ' + (err.message || err);
    }
  }

  seleccionarParaEditar(edificio: any): void {
    this.isEditing = true;
    this.formData.id = edificio.id;
    this.formData.nombre = edificio.Nombre || edificio.nombre || '';

    const pisos = edificio.Pisos || edificio.Piso || [];
    this.formData.pisosTexto = Array.isArray(pisos) ? pisos.join(', ') : pisos.toString();
    this.successMessage = '';
    this.errorMessage = '';
  }

  cancelarEdicion(): void {
    this.limpiarFormulario();
  }

  async eliminarEdificio(edificio: any): Promise<void> {
    const nombre = edificio.Nombre || edificio.nombre || edificio.id;
    const confirmacion = confirm(`¿Estás seguro de que deseas eliminar permanentemente el "${nombre}" de Firestore?`);
    if (!confirmacion) return;

    try {
      await this.espaciosApiService.eliminarEdificio(edificio.id);
      this.successMessage = `Edificio "${nombre}" eliminado correctamente.`;
      await this.cargarEdificios();
      if (this.formData.id === edificio.id) {
        this.limpiarFormulario();
      }
    } catch (err: any) {
      this.errorMessage = 'Error al eliminar edificio: ' + (err.message || err);
    }
  }

  limpiarFormulario(): void {
    this.isEditing = false;
    this.formData = {
      id: '',
      nombre: '',
      pisosTexto: ''
    };
  }

  obtenerTextoPisos(edificio: any): string {
    const p = edificio.Pisos || edificio.Piso;
    if (!p) return 'Sin pisos especificados';
    if (Array.isArray(p)) return p.join(', ');
    return p.toString();
  }
}
