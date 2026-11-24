import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { EspaciosApiService } from '../services/espacios-api.service';
import { Edificio } from '../core/models/edificio.model';

@Component({
    selector: 'app-admin-panel',
    templateUrl: './admin-panel.component.html',
    styleUrls: ['./admin-panel.component.scss'],
    standalone: false
})
export class AdminPanelComponent implements OnInit {
  @Output() cerrar = new EventEmitter<void>();

  // La clave de administrador ya NO está escrita aquí (antes cualquiera la
  // veía en el JavaScript de la página). Ahora la valida el backend contra
  // ADMIN_TOKEN de su .env, y el servicio la guarda solo en memoria.

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
    // Limpia la marca que usaba la versión anterior (ya no se usa).
    try { sessionStorage.removeItem('inago_admin_auth'); } catch { /* sin storage */ }
    if (this.espaciosApiService.haySesionAdmin) {
      this.isAuthenticated = true;
      this.cargarEdificios();
    }
  }

  async verificarAcceso(): Promise<void> {
    this.authError = '';
    const clave = this.passwordInput.trim();
    if (!clave) {
      this.authError = 'Escribe la clave de administrador.';
      return;
    }
    try {
      const ok = await this.espaciosApiService.iniciarSesionAdmin(clave);
      if (ok) {
        this.isAuthenticated = true;
        this.passwordInput = '';
        this.cargarEdificios();
      } else {
        this.authError = 'Clave incorrecta. Acceso restringido a los administradores.';
      }
    } catch (err: any) {
      this.authError = err?.message || 'No se pudo verificar la clave. Revisa tu conexión.';
    }
  }

  cerrarSesionAdmin(): void {
    this.espaciosApiService.cerrarSesionAdmin();
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
      this.isAuthenticated = this.espaciosApiService.haySesionAdmin;
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
      this.isAuthenticated = this.espaciosApiService.haySesionAdmin;
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
