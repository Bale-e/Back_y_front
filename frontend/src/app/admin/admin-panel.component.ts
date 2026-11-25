import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { EspaciosApiService } from '../services/espacios-api.service';
import { Edificio } from '../core/models/edificio.model';

export type AdminTab = 'edificios' | 'locaciones' | 'firestore' | 'rutas' | 'diagnostico';

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss'],
  standalone: false
})
export class AdminPanelComponent implements OnInit {
  @Output() cerrar = new EventEmitter<void>();

  // ── Autenticación ──
  isAuthenticated = false;
  passwordInput = '';
  authError = '';

  // ── Pestañas activas ──
  activeTab: AdminTab = 'edificios';
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  // ── Tab 1: EDIFICIOS ──
  edificios: any[] = [];
  formDataEdificio = {
    id: '',
    nombre: '',
    pisosTexto: ''
  };
  isEditingEdificio = false;

  // ── Tab 2: LOCACIONES & SALAS ──
  locaciones: any[] = [];
  locacionesCargadas = false;
  filtroEdificio = '';
  filtroSubcoleccion = '';
  filtroTexto = '';
  subcoleccionesDisponibles = [
    'Locaciones',
    'Locaciones piso 1',
    'Locaciones piso 2',
    'Locaciones piso 3',
    'Locaciones piso -1'
  ];
  tiposComunes = [
    'Sala',
    'Laboratorio',
    'Baño',
    'Baño Mujeres',
    'Baño Hombres',
    'Baño Universal',
    'Escalera',
    'Ascensor',
    'Cafetería',
    'Oficina',
    'Biblioteca',
    'Auditorio',
    'Otro'
  ];
  locacionModalOpen = false;
  isEditingLocacion = false;
  locacionFormData = {
    edificioId: '',
    subcoleccion: 'Locaciones',
    docId: '',
    nombre: '',
    tipo: 'Sala',
    piso: 'Piso 1',
    cuerpo: null as number | null,
    coordX: null as number | null,
    coordY: null as number | null,
    coordZ: null as number | null
  };

  // ── Tab 3: CONSOLA / EXPLORADOR FIRESTORE (STUDIO) ──
  firestoreCollections: string[] = [];
  selectedCollection = '';
  firestoreDocuments: Array<{ id: string; path: string; data: any }> = [];
  selectedDocument: { id: string; path: string; data: any; subcollections: string[] } | null = null;
  docSearchQuery = '';
  breadcrumbs: Array<{ label: string; path: string; isCollection: boolean }> = [];
  jsonEditorMode = false;
  rawJsonText = '';
  jsonError = '';
  nuevoCampo = {
    clave: '',
    tipo: 'string' as 'string' | 'number' | 'boolean' | 'json',
    valor: ''
  };
  mostrarModalCrearColeccion = false;
  nuevaColeccionNombre = '';
  primerDocId = '';
  mostrarModalCrearDoc = false;
  nuevoDocCustomId = '';

  // ── Tab 4: RUTAS Y NAVEGACIÓN ──
  navigationPaths: any[] = [];
  rutasAntiguas: any[] = [];
  rutaSeleccionada: any = null;
  rutaTipoSeleccionado: 'NavigationPaths' | 'Rutas' = 'NavigationPaths';
  rutaJsonText = '';
  rutasCargadas = false;
  mostrarModalNuevaRuta = false;
  nuevaRuta = {
    tipo: 'NavigationPaths' as 'NavigationPaths' | 'Rutas',
    docId: '',
    json: '{\n  "piso": "Piso 1",\n  "nodes": []\n}'
  };

  // ── Tab 5: DIAGNÓSTICO Y ESTADO DE FIREBASE ──
  statsData: any = null;
  latencyMs: number | null = null;
  isTestingLatency = false;
  activityLogs: Array<{ fecha: string; accion: string; tipo: 'info' | 'success' | 'warn' | 'error' }> = [];

  constructor(private espaciosApiService: EspaciosApiService) {}

  ngOnInit(): void {
    try { sessionStorage.removeItem('inago_admin_auth'); } catch { /* sin storage */ }
    if (this.espaciosApiService.haySesionAdmin) {
      this.isAuthenticated = true;
      this.cargarEdificios();
      this.cargarStats();
    }
  }

  // ── Autenticación de Administrador ──
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
        this.cargarStats();
        this.logActividad('Inicio de sesión de administrador exitoso', 'success');
      } else {
        this.authError = 'Clave incorrecta. Acceso restringido a administradores.';
      }
    } catch (err: any) {
      this.authError = err?.message || 'No se pudo verificar la clave. Revisa la conexión.';
    }
  }

  cerrarSesionAdmin(): void {
    this.espaciosApiService.cerrarSesionAdmin();
    this.isAuthenticated = false;
    this.passwordInput = '';
    this.cerrar.emit();
  }

  setTab(tab: AdminTab): void {
    this.activeTab = tab;
    this.successMessage = '';
    this.errorMessage = '';

    if (tab === 'edificios' && this.edificios.length === 0) {
      this.cargarEdificios();
    } else if (tab === 'locaciones' && !this.locacionesCargadas) {
      this.cargarLocaciones();
    } else if (tab === 'firestore' && this.firestoreCollections.length === 0) {
      this.cargarColeccionesRaiz();
    } else if (tab === 'rutas' && !this.rutasCargadas) {
      this.cargarRutas();
    } else if (tab === 'diagnostico') {
      this.cargarStats();
    }
  }

  private logActividad(accion: string, tipo: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
    const hora = new Date().toLocaleTimeString();
    this.activityLogs.unshift({ fecha: hora, accion, tipo });
    if (this.activityLogs.length > 50) this.activityLogs.pop();
  }

  // ══════════════════════════════════════════════════════════════
  // ── TAB 1: EDIFICIOS (CRUD)
  // ══════════════════════════════════════════════════════════════
  async cargarEdificios(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      this.edificios = await this.espaciosApiService.getEdificios();
      this.logActividad(`Se cargaron ${this.edificios.length} edificios de Firestore`, 'info');
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        this.errorMessage = 'El servidor backend no está corriendo en http://127.0.0.1:3000. Inícialo ejecutando "npm start" en la terminal.';
      } else {
        this.errorMessage = 'Error al cargar los edificios: ' + msg;
      }
      this.logActividad('Fallo al cargar edificios: ' + msg, 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async guardarEdificio(): Promise<void> {
    this.successMessage = '';
    this.errorMessage = '';

    const nombreLimpio = this.formDataEdificio.nombre.trim();
    if (!nombreLimpio) {
      this.errorMessage = 'El nombre del edificio es obligatorio.';
      return;
    }

    const pisosArray = this.formDataEdificio.pisosTexto
      ? this.formDataEdificio.pisosTexto.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
      : ['Piso 1'];

    const payload = {
      Nombre: nombreLimpio,
      Piso: pisosArray,
      Pisos: pisosArray
    };

    try {
      if (this.isEditingEdificio && this.formDataEdificio.id) {
        await this.espaciosApiService.actualizarEdificio(this.formDataEdificio.id, payload);
        this.successMessage = `Edificio "${nombreLimpio}" actualizado exitosamente.`;
        this.logActividad(`Edificio "${nombreLimpio}" (${this.formDataEdificio.id}) actualizado`, 'success');
      } else {
        await this.espaciosApiService.crearEdificio(payload);
        this.successMessage = `Edificio "${nombreLimpio}" creado exitosamente en Firestore.`;
        this.logActividad(`Nuevo edificio "${nombreLimpio}" creado en Firestore`, 'success');
      }

      this.limpiarFormularioEdificio();
      await this.cargarEdificios();
    } catch (err: any) {
      this.errorMessage = 'Error al guardar el edificio: ' + (err.message || err);
      this.isAuthenticated = this.espaciosApiService.haySesionAdmin;
    }
  }

  seleccionarParaEditarEdificio(edificio: any): void {
    this.isEditingEdificio = true;
    this.formDataEdificio.id = edificio.id;
    this.formDataEdificio.nombre = edificio.Nombre || edificio.nombre || '';
    const pisos = edificio.Pisos || edificio.Piso || [];
    this.formDataEdificio.pisosTexto = Array.isArray(pisos) ? pisos.join(', ') : pisos.toString();
    this.successMessage = '';
    this.errorMessage = '';
  }

  cancelarEdicionEdificio(): void {
    this.limpiarFormularioEdificio();
  }

  async eliminarEdificio(edificio: any): Promise<void> {
    const nombre = edificio.Nombre || edificio.nombre || edificio.id;
    const confirmacion = confirm(`¿Estás seguro de eliminar el "${nombre}" de Firestore? Se borrará el documento.`);
    if (!confirmacion) return;

    try {
      await this.espaciosApiService.eliminarEdificio(edificio.id);
      this.successMessage = `Edificio "${nombre}" eliminado correctamente.`;
      this.logActividad(`Edificio "${nombre}" eliminado de Firestore`, 'warn');
      await this.cargarEdificios();
      if (this.formDataEdificio.id === edificio.id) {
        this.limpiarFormularioEdificio();
      }
    } catch (err: any) {
      this.errorMessage = 'Error al eliminar edificio: ' + (err.message || err);
    }
  }

  limpiarFormularioEdificio(): void {
    this.isEditingEdificio = false;
    this.formDataEdificio = {
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

  verLocacionesDeEdificio(edificio: any): void {
    this.filtroEdificio = edificio.id;
    this.setTab('locaciones');
  }

  // ══════════════════════════════════════════════════════════════
  // ── TAB 2: LOCACIONES Y SALAS (CRUD)
  // ══════════════════════════════════════════════════════════════
  async cargarLocaciones(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const resp = await this.espaciosApiService.getLocacionesDetalladas();
      this.locaciones = resp.locaciones || [];
      this.locacionesCargadas = true;
      this.logActividad(`Se cargaron ${this.locaciones.length} locaciones desde Firestore`, 'info');
    } catch (err: any) {
      this.errorMessage = 'Error al cargar locaciones: ' + (err.message || err);
      this.logActividad('Fallo al cargar locaciones: ' + (err.message || err), 'error');
    } finally {
      this.isLoading = false;
    }
  }

  get locacionesFiltradas(): any[] {
    let result = this.locaciones;
    if (this.filtroEdificio) {
      result = result.filter((l) => l.edificioId === this.filtroEdificio);
    }
    if (this.filtroSubcoleccion) {
      result = result.filter((l) => l.subcoleccion === this.filtroSubcoleccion);
    }
    if (this.filtroTexto.trim()) {
      const q = this.filtroTexto.toLowerCase().trim();
      result = result.filter(
        (l) =>
          (l.nombre && l.nombre.toLowerCase().includes(q)) ||
          (l.tipo && l.tipo.toLowerCase().includes(q)) ||
          (l.docId && l.docId.toLowerCase().includes(q)) ||
          (l.cuerpo != null && l.cuerpo.toString().includes(q))
      );
    }
    return result;
  }

  abrirModalCrearLocacion(): void {
    this.isEditingLocacion = false;
    this.locacionFormData = {
      edificioId: this.filtroEdificio || (this.edificios.length > 0 ? this.edificios[0].id : ''),
      subcoleccion: this.filtroSubcoleccion || 'Locaciones',
      docId: '',
      nombre: '',
      tipo: 'Sala',
      piso: 'Piso 1',
      cuerpo: null,
      coordX: 0,
      coordY: 0,
      coordZ: 0
    };
    this.locacionModalOpen = true;
  }

  abrirModalEditarLocacion(loc: any): void {
    this.isEditingLocacion = true;
    const coords = loc.coordenadas || {};
    this.locacionFormData = {
      edificioId: loc.edificioId,
      subcoleccion: loc.subcoleccion,
      docId: loc.docId,
      nombre: loc.nombre || '',
      tipo: loc.tipo || 'Sala',
      piso: loc.piso || 'Piso 1',
      cuerpo: loc.cuerpo != null ? Number(loc.cuerpo) : null,
      coordX: coords.x != null ? Number(coords.x) : (coords.X != null ? Number(coords.X) : null),
      coordY: coords.y != null ? Number(coords.y) : (coords.Y != null ? Number(coords.Y) : null),
      coordZ: coords.z != null ? Number(coords.z) : (coords.Z != null ? Number(coords.Z) : null)
    };
    this.locacionModalOpen = true;
  }

  cerrarModalLocacion(): void {
    this.locacionModalOpen = false;
  }

  async guardarLocacion(): Promise<void> {
    const nombre = this.locacionFormData.nombre.trim();
    if (!nombre) {
      alert('El nombre de la sala o espacio es obligatorio.');
      return;
    }
    if (!this.locacionFormData.edificioId) {
      alert('Debes seleccionar un edificio.');
      return;
    }

    const payloadData: any = {
      Nombre: nombre,
      nombre: nombre,
      Tipo: this.locacionFormData.tipo,
      tipo: this.locacionFormData.tipo,
      Piso: this.locacionFormData.piso,
      piso: this.locacionFormData.piso
    };

    if (this.locacionFormData.cuerpo != null && !isNaN(this.locacionFormData.cuerpo)) {
      payloadData.Cuerpo = Number(this.locacionFormData.cuerpo);
      payloadData.cuerpo = Number(this.locacionFormData.cuerpo);
    }

    if (
      this.locacionFormData.coordX != null &&
      this.locacionFormData.coordY != null &&
      this.locacionFormData.coordZ != null
    ) {
      const coords = {
        x: Number(this.locacionFormData.coordX),
        y: Number(this.locacionFormData.coordY),
        z: Number(this.locacionFormData.coordZ)
      };
      payloadData.Coordenadas = coords;
      payloadData['Coordenadas 3D'] = coords;
      payloadData.coordenadas = coords;
    }

    try {
      this.isLoading = true;
      if (this.isEditingLocacion) {
        await this.espaciosApiService.actualizarLocacion({
          edificioId: this.locacionFormData.edificioId,
          subcoleccion: this.locacionFormData.subcoleccion,
          docId: this.locacionFormData.docId,
          data: payloadData
        });
        this.successMessage = `Locación "${nombre}" actualizada exitosamente.`;
        this.logActividad(`Locación "${nombre}" modificada en ${this.locacionFormData.subcoleccion}`, 'success');
      } else {
        await this.espaciosApiService.crearLocacion({
          edificioId: this.locacionFormData.edificioId,
          subcoleccion: this.locacionFormData.subcoleccion,
          docId: this.locacionFormData.docId || undefined,
          data: payloadData
        });
        this.successMessage = `Locación "${nombre}" creada en Firestore exitosamente.`;
        this.logActividad(`Nueva locación "${nombre}" creada en ${this.locacionFormData.subcoleccion}`, 'success');
      }

      this.cerrarModalLocacion();
      await this.cargarLocaciones();
    } catch (err: any) {
      this.errorMessage = 'Error al guardar la locación: ' + (err.message || err);
      this.logActividad('Error al guardar locación: ' + (err.message || err), 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async eliminarLocacion(loc: any): Promise<void> {
    const confirmacion = confirm(`¿Estás seguro de eliminar permanentemente la locación "${loc.nombre}" de Firestore?`);
    if (!confirmacion) return;

    try {
      this.isLoading = true;
      await this.espaciosApiService.eliminarLocacion({
        edificioId: loc.edificioId,
        subcoleccion: loc.subcoleccion,
        docId: loc.docId
      });
      this.successMessage = `Locación "${loc.nombre}" eliminada exitosamente.`;
      this.logActividad(`Locación "${loc.nombre}" (${loc.docId}) eliminada`, 'warn');
      await this.cargarLocaciones();
    } catch (err: any) {
      this.errorMessage = 'Error al eliminar locación: ' + (err.message || err);
      this.logActividad('Error al eliminar locación: ' + (err.message || err), 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ── TAB 3: CONSOLA / STUDIO DE FIRESTORE (EXPLORADOR COMPLETO)
  // ══════════════════════════════════════════════════════════════
  async cargarColeccionesRaiz(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      this.firestoreCollections = await this.espaciosApiService.getFirestoreCollections();
      this.breadcrumbs = [{ label: 'Raíz (Root)', path: '', isCollection: false }];
      if (this.firestoreCollections.length > 0 && !this.selectedCollection) {
        this.seleccionarColeccion(this.firestoreCollections[0]);
      }
    } catch (err: any) {
      this.errorMessage = 'Error al cargar colecciones de Firestore: ' + (err.message || err);
    } finally {
      this.isLoading = false;
    }
  }

  async seleccionarColeccion(collectionPath: string): Promise<void> {
    this.selectedCollection = collectionPath;
    this.selectedDocument = null;
    this.isLoading = true;
    this.errorMessage = '';
    this.breadcrumbs = [
      { label: 'Raíz', path: '', isCollection: false },
      { label: collectionPath, path: collectionPath, isCollection: true }
    ];

    try {
      const resp = await this.espaciosApiService.getFirestoreDocuments(collectionPath, 150);
      this.firestoreDocuments = resp.documents || [];
      this.logActividad(`Explorando colección Firestore "${collectionPath}" (${this.firestoreDocuments.length} docs)`, 'info');
      if (this.firestoreDocuments.length > 0) {
        this.seleccionarDocumento(this.firestoreDocuments[0]);
      }
    } catch (err: any) {
      this.errorMessage = 'Error al cargar documentos de ' + collectionPath + ': ' + (err.message || err);
    } finally {
      this.isLoading = false;
    }
  }

  async seleccionarDocumento(docItem: any): Promise<void> {
    this.isLoading = true;
    this.jsonError = '';
    try {
      const docDetail = await this.espaciosApiService.getFirestoreDocument(docItem.path);
      this.selectedDocument = docDetail;
      this.rawJsonText = JSON.stringify(docDetail.data || {}, null, 2);
    } catch (err: any) {
      this.errorMessage = 'Error al cargar documento ' + docItem.id + ': ' + (err.message || err);
    } finally {
      this.isLoading = false;
    }
  }

  async descenderSubcoleccion(subcolName: string): Promise<void> {
    if (!this.selectedDocument) return;
    const subcolPath = `${this.selectedDocument.path}/${subcolName}`;
    this.selectedCollection = subcolPath;
    this.selectedDocument = null;
    this.isLoading = true;

    this.breadcrumbs.push({
      label: subcolName,
      path: subcolPath,
      isCollection: true
    });

    try {
      const resp = await this.espaciosApiService.getFirestoreDocuments(subcolPath, 150);
      this.firestoreDocuments = resp.documents || [];
      this.logActividad(`Drill-down a subcolección Firestore "${subcolPath}"`, 'info');
      if (this.firestoreDocuments.length > 0) {
        this.seleccionarDocumento(this.firestoreDocuments[0]);
      }
    } catch (err: any) {
      this.errorMessage = 'Error al cargar subcolección ' + subcolName + ': ' + (err.message || err);
    } finally {
      this.isLoading = false;
    }
  }

  async navegarBreadcrumb(index: number): Promise<void> {
    if (index === 0) {
      this.selectedCollection = '';
      this.selectedDocument = null;
      this.firestoreDocuments = [];
      this.cargarColeccionesRaiz();
      return;
    }

    const item = this.breadcrumbs[index];
    this.breadcrumbs = this.breadcrumbs.slice(0, index + 1);
    if (item.isCollection) {
      this.selectedCollection = item.path;
      this.selectedDocument = null;
      try {
        this.isLoading = true;
        const resp = await this.espaciosApiService.getFirestoreDocuments(item.path, 150);
        this.firestoreDocuments = resp.documents || [];
        if (this.firestoreDocuments.length > 0) {
          this.seleccionarDocumento(this.firestoreDocuments[0]);
        }
      } catch (err: any) {
        this.errorMessage = 'Error: ' + err.message;
      } finally {
        this.isLoading = false;
      }
    }
  }

  get firestoreDocsFiltrados(): any[] {
    if (!this.docSearchQuery.trim()) return this.firestoreDocuments;
    const q = this.docSearchQuery.toLowerCase().trim();
    return this.firestoreDocuments.filter((d) => d.id.toLowerCase().includes(q));
  }

  get camposDelDocumento(): Array<{ key: string; value: any; type: string }> {
    if (!this.selectedDocument || !this.selectedDocument.data) return [];
    const data = this.selectedDocument.data;
    return Object.keys(data).map((key) => {
      const val = data[key];
      let type: string = typeof val;
      if (val === null) type = 'null';
      else if (Array.isArray(val)) type = 'array';
      else if (type === 'object') type = 'map';
      return { key, value: val, type };
    });
  }

  formatearValorCampo(val: any): string {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'object') return JSON.stringify(val);
    return val.toString();
  }

  async guardarCampoDocumento(key: string, nuevoValor: any): Promise<void> {
    if (!this.selectedDocument) return;
    try {
      const updatedData = { ...this.selectedDocument.data, [key]: nuevoValor };
      await this.espaciosApiService.saveFirestoreDocument({
        documentPath: this.selectedDocument.path,
        data: updatedData,
        merge: true
      });
      this.selectedDocument.data = updatedData;
      this.rawJsonText = JSON.stringify(updatedData, null, 2);
      this.successMessage = `Campo "${key}" actualizado exitosamente.`;
      this.logActividad(`Campo "${key}" modificado en documento ${this.selectedDocument.id}`, 'success');
    } catch (err: any) {
      this.errorMessage = 'Error al actualizar campo: ' + err.message;
    }
  }

  async eliminarCampoDocumento(key: string): Promise<void> {
    if (!this.selectedDocument) return;
    const confirmacion = confirm(`¿Estás seguro de eliminar el campo "${key}" del documento?`);
    if (!confirmacion) return;

    try {
      const copy = { ...this.selectedDocument.data };
      delete copy[key];
      // Para sobreescribir sin merge el campo borrado
      await this.espaciosApiService.saveFirestoreDocument({
        documentPath: this.selectedDocument.path,
        data: copy,
        merge: false
      });
      this.selectedDocument.data = copy;
      this.rawJsonText = JSON.stringify(copy, null, 2);
      this.successMessage = `Campo "${key}" eliminado.`;
      this.logActividad(`Campo "${key}" eliminado de ${this.selectedDocument.id}`, 'warn');
    } catch (err: any) {
      this.errorMessage = 'Error al eliminar campo: ' + err.message;
    }
  }

  async agregarNuevoCampo(): Promise<void> {
    if (!this.selectedDocument) return;
    const key = this.nuevoCampo.clave.trim();
    if (!key) {
      alert('Escribe el nombre del campo.');
      return;
    }

    let parsedVal: any = this.nuevoCampo.valor;
    if (this.nuevoCampo.tipo === 'number') {
      parsedVal = Number(this.nuevoCampo.valor);
      if (isNaN(parsedVal)) {
        alert('El valor ingresado no es un número válido.');
        return;
      }
    } else if (this.nuevoCampo.tipo === 'boolean') {
      parsedVal = this.nuevoCampo.valor === 'true' || this.nuevoCampo.valor === '1';
    } else if (this.nuevoCampo.tipo === 'json') {
      try {
        parsedVal = JSON.parse(this.nuevoCampo.valor);
      } catch (e: any) {
        alert('El JSON ingresado no es válido: ' + e.message);
        return;
      }
    }

    await this.guardarCampoDocumento(key, parsedVal);
    this.nuevoCampo = { clave: '', tipo: 'string', valor: '' };
  }

  formatearJsonRaw(): void {
    try {
      const obj = JSON.parse(this.rawJsonText);
      this.rawJsonText = JSON.stringify(obj, null, 2);
      this.jsonError = '';
    } catch (e: any) {
      this.jsonError = 'JSON inválido: ' + e.message;
    }
  }

  async guardarJsonRaw(): Promise<void> {
    if (!this.selectedDocument) return;
    try {
      const parsed = JSON.parse(this.rawJsonText);
      this.jsonError = '';
      this.isLoading = true;
      await this.espaciosApiService.saveFirestoreDocument({
        documentPath: this.selectedDocument.path,
        data: parsed,
        merge: false
      });
      this.selectedDocument.data = parsed;
      this.successMessage = `Documento ${this.selectedDocument.id} actualizado mediante editor JSON.`;
      this.logActividad(`Documento ${this.selectedDocument.id} guardado con editor JSON`, 'success');
    } catch (e: any) {
      this.jsonError = 'Error de validación JSON: ' + e.message;
    } finally {
      this.isLoading = false;
    }
  }

  async eliminarDocumentoSeleccionado(): Promise<void> {
    if (!this.selectedDocument) return;
    const confirmacion = confirm(`¿Estás seguro de eliminar el documento "${this.selectedDocument.id}" de Firestore?`);
    if (!confirmacion) return;

    try {
      this.isLoading = true;
      await this.espaciosApiService.deleteFirestoreDocument(this.selectedDocument.path);
      this.successMessage = `Documento ${this.selectedDocument.id} eliminado de Firestore.`;
      this.logActividad(`Documento ${this.selectedDocument.id} eliminado de Firestore`, 'warn');
      this.selectedDocument = null;
      // Refrescar lista de documentos
      const resp = await this.espaciosApiService.getFirestoreDocuments(this.selectedCollection, 150);
      this.firestoreDocuments = resp.documents || [];
    } catch (err: any) {
      this.errorMessage = 'Error al eliminar documento: ' + err.message;
    } finally {
      this.isLoading = false;
    }
  }

  async crearNuevaColeccion(): Promise<void> {
    const colName = this.nuevaColeccionNombre.trim();
    if (!colName) {
      alert('Escribe el nombre de la colección.');
      return;
    }
    const docId = this.primerDocId.trim() || undefined;

    try {
      this.isLoading = true;
      await this.espaciosApiService.saveFirestoreDocument({
        collectionPath: colName,
        docId,
        data: { creadoEn: new Date().toISOString(), descripcion: 'Colección creada desde InaGo Admin' }
      });
      this.mostrarModalCrearColeccion = false;
      this.nuevaColeccionNombre = '';
      this.primerDocId = '';
      this.successMessage = `Colección "${colName}" iniciada exitosamente en Firestore.`;
      this.logActividad(`Nueva colección raíz "${colName}" creada en Firestore`, 'success');
      await this.cargarColeccionesRaiz();
      this.seleccionarColeccion(colName);
    } catch (err: any) {
      alert('Error al crear colección: ' + err.message);
    } finally {
      this.isLoading = false;
    }
  }

  async crearNuevoDocumento(): Promise<void> {
    if (!this.selectedCollection) return;
    const docId = this.nuevoDocCustomId.trim() || undefined;

    try {
      this.isLoading = true;
      const res = await this.espaciosApiService.saveFirestoreDocument({
        collectionPath: this.selectedCollection,
        docId,
        data: { creadoEn: new Date().toISOString() }
      });
      this.mostrarModalCrearDoc = false;
      this.nuevoDocCustomId = '';
      this.successMessage = `Documento ${res.id} creado en Firestore.`;
      this.logActividad(`Nuevo documento ${res.id} agregado a ${this.selectedCollection}`, 'success');

      const resp = await this.espaciosApiService.getFirestoreDocuments(this.selectedCollection, 150);
      this.firestoreDocuments = resp.documents || [];
      const nuevo = this.firestoreDocuments.find((d) => d.id === res.id);
      if (nuevo) this.seleccionarDocumento(nuevo);
    } catch (err: any) {
      alert('Error al crear documento: ' + err.message);
    } finally {
      this.isLoading = false;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ── TAB 4: RUTAS Y NAVEGACIÓN (NavigationPaths / Rutas)
  // ══════════════════════════════════════════════════════════════
  async cargarRutas(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const resp = await this.espaciosApiService.getRutasData();
      this.navigationPaths = resp.navigationPaths || [];
      this.rutasAntiguas = resp.rutas || [];
      this.rutasCargadas = true;
      this.logActividad(`Se cargaron ${this.navigationPaths.length} NavigationPaths y ${this.rutasAntiguas.length} Rutas`, 'info');
      if (this.navigationPaths.length > 0) {
        this.seleccionarRuta(this.navigationPaths[0], 'NavigationPaths');
      }
    } catch (err: any) {
      this.errorMessage = 'Error al cargar rutas: ' + (err.message || err);
    } finally {
      this.isLoading = false;
    }
  }

  seleccionarRuta(item: any, tipo: 'NavigationPaths' | 'Rutas'): void {
    this.rutaSeleccionada = item;
    this.rutaTipoSeleccionado = tipo;
    this.rutaJsonText = JSON.stringify(item.data || {}, null, 2);
  }

  async guardarRutaActual(): Promise<void> {
    if (!this.rutaSeleccionada) return;
    try {
      const parsed = JSON.parse(this.rutaJsonText);
      this.isLoading = true;
      await this.espaciosApiService.saveRuta({
        collection: this.rutaTipoSeleccionado,
        docId: this.rutaSeleccionada.id,
        data: parsed
      });
      this.rutaSeleccionada.data = parsed;
      this.successMessage = `Ruta "${this.rutaSeleccionada.id}" guardada correctamente en ${this.rutaTipoSeleccionado}.`;
      this.logActividad(`Ruta "${this.rutaSeleccionada.id}" actualizada en ${this.rutaTipoSeleccionado}`, 'success');
    } catch (err: any) {
      this.errorMessage = 'Error al guardar ruta: ' + err.message;
    } finally {
      this.isLoading = false;
    }
  }

  async eliminarRutaActual(): Promise<void> {
    if (!this.rutaSeleccionada) return;
    const confirmacion = confirm(`¿Estás seguro de eliminar el registro de ruta "${this.rutaSeleccionada.id}"?`);
    if (!confirmacion) return;

    try {
      this.isLoading = true;
      await this.espaciosApiService.deleteRuta({
        collection: this.rutaTipoSeleccionado,
        docId: this.rutaSeleccionada.id
      });
      this.successMessage = `Ruta "${this.rutaSeleccionada.id}" eliminada de Firestore.`;
      this.logActividad(`Ruta "${this.rutaSeleccionada.id}" eliminada de ${this.rutaTipoSeleccionado}`, 'warn');
      this.rutaSeleccionada = null;
      await this.cargarRutas();
    } catch (err: any) {
      this.errorMessage = 'Error al eliminar ruta: ' + err.message;
    } finally {
      this.isLoading = false;
    }
  }

  abrirModalCrearRuta(): void {
    this.nuevaRuta = {
      tipo: 'NavigationPaths',
      docId: '',
      json: '{\n  "piso": "Piso 1",\n  "nodes": []\n}'
    };
    this.mostrarModalNuevaRuta = true;
  }

  async crearNuevaRuta(): Promise<void> {
    try {
      const parsed = JSON.parse(this.nuevaRuta.json);
      this.isLoading = true;
      await this.espaciosApiService.saveRuta({
        collection: this.nuevaRuta.tipo,
        docId: this.nuevaRuta.docId.trim() || undefined,
        data: parsed
      });
      this.mostrarModalNuevaRuta = false;
      this.successMessage = `Nueva ruta creada en ${this.nuevaRuta.tipo}.`;
      this.logActividad(`Nueva ruta creada en ${this.nuevaRuta.tipo}`, 'success');
      await this.cargarRutas();
    } catch (err: any) {
      alert('Error al crear ruta: ' + err.message);
    } finally {
      this.isLoading = false;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ── TAB 5: DIAGNÓSTICO Y ESTADO DE FIREBASE
  // ══════════════════════════════════════════════════════════════
  async cargarStats(): Promise<void> {
    try {
      this.statsData = await this.espaciosApiService.getFirestoreStats();
      this.latencyMs = this.statsData.latencyMs;
    } catch (err: any) {
      this.logActividad('Fallo al obtener estado de Firebase: ' + err.message, 'error');
    }
  }

  async testLatency(): Promise<void> {
    this.isTestingLatency = true;
    try {
      const t0 = Date.now();
      const res = await this.espaciosApiService.getFirestoreStats();
      this.latencyMs = res.latencyMs || (Date.now() - t0);
      this.statsData = res;
      this.successMessage = `Prueba de conexión con Firestore completada. Latencia: ${this.latencyMs} ms`;
      this.logActividad(`Ping a Firestore: ${this.latencyMs} ms`, 'success');
    } catch (err: any) {
      this.errorMessage = 'Error al medir latencia: ' + err.message;
      this.logActividad('Fallo en prueba de latencia: ' + err.message, 'error');
    } finally {
      this.isTestingLatency = false;
    }
  }

  async limpiarCache(): Promise<void> {
    this.isLoading = true;
    try {
      await this.espaciosApiService.limpiarCacheBackend();
      this.successMessage = 'Caché en memoria invalidada exitosamente. Todas las consultas leerán directo de Firestore.';
      this.logActividad('Caché de memoria backend invalidada', 'info');
    } catch (err: any) {
      this.errorMessage = 'Error al limpiar caché: ' + err.message;
    } finally {
      this.isLoading = false;
    }
  }
}
