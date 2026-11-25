import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface BuildingItem {
  id: string;
  name: string;
  description: string;
  foto?: string;
}

export interface Developer {
  id: string;
  nombre: string;
  carrera: string;
  rol: string;
  descripcion: string;
  iniciales: string;
  avatarColor: string;
  foto?: string;
  github?: string;
  linkedin?: string;
  edificiosModelados?: BuildingItem[];
}

@Component({
  selector: 'app-developer-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './developer-panel.component.html',
  styleUrls: ['./developer-panel.component.scss']
})
export class DeveloperPanelComponent {
  // Estado reactivo con Signals
  public isOpen = signal<boolean>(false);
  public activeDevId = signal<string>('valentina');
  public lightboxImage = signal<string | null>(null);
  private photoErrors = new Set<string>();

  public onPhotoError(id: string): void {
    this.photoErrors.add(id);
  }

  public hasPhotoError(id: string): boolean {
    return this.photoErrors.has(id);
  }

  public openLightbox(src: string): void {
    this.lightboxImage.set(src);
  }

  public closeLightbox(): void {
    this.lightboxImage.set(null);
  }

  // Arreglo editable de los 10 edificios modelados por Tomas Palma
  public readonly edificios: BuildingItem[] = [
    {
      id: 'A',
      name: 'Edificio A',
      description: 'Edificio A — [Aulas y laboratorios principales de la sede]',
      foto: ''
    },
    {
      id: 'B',
      name: 'Edificio B',
      description: 'Edificio B — [Talleres de especialidad y salas de clases]',
      foto: ''
    },
    {
      id: 'D',
      name: 'Edificio D',
      description: 'Edificio D — [Aulas técnicas y áreas de estudio]',
      foto: ''
    },
    {
      id: 'E',
      name: 'Edificio E',
      description: 'Edificio E — [Laboratorios de computación y salas de clases]',
      foto: ''
    },
    {
      id: 'F',
      name: 'Edificio F',
      description: 'Edificio F — [Dependencias académicas y salas especializadas]',
      foto: ''
    },
    {
      id: 'G',
      name: 'Edificio G',
      description: 'Edificio G — [Aulas docentes y salas de profesores]',
      foto: ''
    },
    {
      id: 'H',
      name: 'Edificio H',
      description: 'Edificio H — [Talleres mecánicos y laboratorios industriales]',
      foto: ''
    },
    {
      id: 'J',
      name: 'Edificio J',
      description: 'Edificio J — [Salas de clases y espacios de especialidad]',
      foto: ''
    },
    {
      id: 'K',
      name: 'Edificio K',
      description: 'Edificio K — [Gimnasio y áreas de recreación y bienestar]',
      foto: ''
    },
    {
      id: 'L',
      name: 'Edificio L',
      description: 'Edificio L — [Casino y cafetería central]',
      foto: ''
    }
  ];

  // Arreglo tipado con los 4 integrantes del equipo
  public readonly developers: Developer[] = [
    {
      id: 'valentina',
      nombre: 'Valentina Ríos',
      carrera: 'Ingeniería Informática',
      rol: 'Líder de equipo · Desarrolladora BackEnd y FrontEnd',
      descripcion:
        'Lideró el proyecto coordinando al equipo y las entregas, y desarrolló tanto la lógica del backend como parte importante de la interfaz.',
      iniciales: 'VR',
      avatarColor: 'linear-gradient(135deg, #7c3aed, #a855f7)',
      foto: 'assets/team/valentina-rios.jpg',
      github: '',
      linkedin: ''
    },
    {
      id: 'janier',
      nombre: 'Janier Torres',
      carrera: 'Ingeniería Informática',
      rol: 'Desarrollador FrontEnd (encargado del frontend)',
      descripcion:
        'Responsable del diseño y la implementación de la interfaz de usuario: buscador, controles del mapa, paneles y experiencia de uso.',
      iniciales: 'JT',
      avatarColor: 'linear-gradient(135deg, #2563eb, #38bdf8)',
      foto: 'assets/team/janier-torres.jpg',
      github: '',
      linkedin: ''
    },
    {
      id: 'vicente',
      nombre: 'Vicente Chandia',
      carrera: 'Ingeniería Informática',
      rol: 'Encargado de la Base de Datos (FullStack)',
      descripcion:
        'Diseñó y administra la base de datos (salas, docentes y ubicaciones) y su conexión con la aplicación.',
      iniciales: 'VC',
      avatarColor: 'linear-gradient(135deg, #059669, #34d399)',
      foto: '', // ej: 'assets/team/vicente-chandia.jpg'
      github: '',
      linkedin: ''
    },
    {
      id: 'tomas',
      nombre: 'Tomas Palma',
      carrera: 'Ingeniería Informática',
      rol: 'Diseñador y modelador 3D',
      descripcion:
        'Modeló en 3D el mapa completo de la sede, con todos sus edificios.',
      iniciales: 'TP',
      avatarColor: 'linear-gradient(135deg, #ea580c, #fbbf24)',
      foto: '', // ej: 'assets/team/tomas-palma.jpg'
      github: '',
      linkedin: '',
      edificiosModelados: this.edificios
    }
  ];

  public get activeDeveloper(): Developer {
    return this.developers.find((d) => d.id === this.activeDevId()) || this.developers[0];
  }

  public togglePanel(): void {
    this.isOpen.update((v) => !v);
  }

  public openPanel(): void {
    this.isOpen.set(true);
  }

  public closePanel(): void {
    this.isOpen.set(false);
  }

  public selectDeveloper(id: string): void {
    this.activeDevId.set(id);
  }

  @HostListener('document:keydown.escape')
  public handleEscape(): void {
    if (this.lightboxImage()) {
      this.closeLightbox();
      return;
    }
    if (this.isOpen()) {
      this.closePanel();
    }
  }
}
