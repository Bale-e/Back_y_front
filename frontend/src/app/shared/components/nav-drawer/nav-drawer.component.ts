import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { EspaciosApiService } from '../../../services/espacios-api.service';
import { MapNavigationService } from '../../../map3d/services/map-navigation.service';
import { BuildingRegistryService } from '../../../core/services/building-registry.service';
import { BuildingId } from '../../../core/models/navegacion.model';
import { Locacion } from '../../../core/models/locacion.model';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type DrawerView =
  | 'main'
  | 'banos'
  | 'biblioteca'
  | 'cafeteria'
  | 'enfermeria'
  | 'recepcion'
  | 'salas'
  | 'laboratorios'
  | 'oficinas'
  | 'escaleras';

export interface LocationDrawerItem {
  nombre: string;
  edificio: BuildingId;
  piso: string;
  floorNum: number;
  cuerpo?: number | string | null;
  meshName?: string;
  tipo?: string;
  desc?: string;
  coordenadas?: { x: number; y: number; z: number } | null;
  autoRoute?: boolean;
}

export interface BanoPisoGroup {
  piso: string;
  floorNum: number;
  banos: LocationDrawerItem[];
}

export interface BanoEdificioGroup {
  edificio: string;
  edificioId: BuildingId;
  pisos: BanoPisoGroup[];
  expandido: boolean;
}

// ── 12 Baños reales verificados en la base de datos Firestore ─────────────────
const BANOS_VERIFICADOS: LocationDrawerItem[] = [
  // Edificio A
  {
    nombre: 'Baño Damas Piso 1 Edificio A',
    edificio: 'A',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 11,
    tipo: 'Baño',
    desc: 'Servicio higiénico para damas — Cuerpo 11, Edificio A, Piso 1.',
    coordenadas: { x: 44.15, y: 2, z: -0.04 }
  },
  {
    nombre: 'Baño Varones Piso 1 Edificio A',
    edificio: 'A',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 24,
    tipo: 'Baño',
    desc: 'Servicio higiénico para varones — Cuerpo 24, Edificio A, Piso 1.',
    coordenadas: { x: 39.78, y: 2, z: -0.29 }
  },
  {
    nombre: 'Baño Damas Piso 2 Edificio A',
    edificio: 'A',
    piso: 'Piso 2',
    floorNum: 2,
    cuerpo: 22,
    tipo: 'Baño',
    desc: 'Servicio higiénico para damas — Cuerpo 22, Edificio A, Piso 2.',
    coordenadas: { x: 10.8, y: 0.96, z: -3.43 }
  },
  {
    nombre: 'Baños Varones Piso 2 Edificio A',
    edificio: 'A',
    piso: 'Piso 2',
    floorNum: 2,
    cuerpo: 21,
    tipo: 'Baño',
    desc: 'Servicio higiénico para varones — Cuerpo 21, Edificio A, Piso 2.',
    coordenadas: { x: 8.59, y: 1.42, z: -3.08 }
  },
  {
    nombre: 'Baño Damas Piso 3 Edificio A',
    edificio: 'A',
    piso: 'Piso 3',
    floorNum: 3,
    cuerpo: 13,
    tipo: 'Baño',
    desc: 'Servicio higiénico para damas — Cuerpo 13, Edificio A, Piso 3.',
    coordenadas: { x: 10.79, y: 1.43, z: -3.12 }
  },
  {
    nombre: 'Baño Varones Piso 3 Edificio A',
    edificio: 'A',
    piso: 'Piso 3',
    floorNum: 3,
    cuerpo: 2,
    tipo: 'Baño',
    desc: 'Servicio higiénico para varones — Cuerpo 2, Edificio A, Piso 3.',
    coordenadas: { x: 9.09, y: 1.88, z: -3.07 }
  },
  // Edificio C
  {
    nombre: 'Baño Damas Piso 1 Edificio C',
    edificio: 'C',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 10,
    meshName: 'C_P1_Grupo_10',
    tipo: 'Baño',
    desc: 'Servicio higiénico para damas — Cuerpo 10, Edificio C, Piso 1.',
    coordenadas: { x: -3.7, y: 1.2, z: 8.9 }
  },
  {
    nombre: 'Baño Varones Piso 1 Edificio C',
    edificio: 'C',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 11,
    meshName: 'C_P1_Grupo_11',
    tipo: 'Baño',
    desc: 'Servicio higiénico para varones — Cuerpo 11, Edificio C, Piso 1.',
    coordenadas: { x: 4.1, y: 1, z: 11 }
  },
  {
    nombre: 'Baño Damas Piso 2 Edificio C',
    edificio: 'C',
    piso: 'Piso 2',
    floorNum: 2,
    cuerpo: 1,
    meshName: 'C_P2_Grupo_1',
    tipo: 'Baño',
    desc: 'Servicio higiénico para damas — Cuerpo 1, Edificio C, Piso 2.',
    coordenadas: { x: -3.9, y: 1.8, z: 9.3 }
  },
  {
    nombre: 'Baño Varones Piso 2 Edificio C',
    edificio: 'C',
    piso: 'Piso 2',
    floorNum: 2,
    cuerpo: 1,
    meshName: 'C_P2_Grupo_1',
    tipo: 'Baño',
    desc: 'Servicio higiénico para varones — Cuerpo 1, Edificio C, Piso 2.',
    coordenadas: { x: -4, y: 1.8, z: 10.5 }
  },
  // Edificio D
  {
    nombre: 'Baño Damas Piso 1 Edificio D',
    edificio: 'D',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 1,
    meshName: 'D_P1_Grupo_1',
    tipo: 'Baño',
    desc: 'Servicio higiénico para damas — Cuerpo 1, Edificio D, Piso 1.',
    coordenadas: { x: -3, y: 1.3, z: 3.5 }
  },
  {
    nombre: 'Baño Varones Piso 1 Edificio D',
    edificio: 'D',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 2,
    meshName: 'D_P1_Grupo_2',
    tipo: 'Baño',
    desc: 'Servicio higiénico para varones — Cuerpo 2, Edificio D, Piso 1.',
    coordenadas: { x: -4, y: 1.7, z: 5.5 }
  },
];

// ── Laboratorios y Talleres Especializados en Firestore ──────────────────────
const LABORATORIOS_VERIFICADOS: LocationDrawerItem[] = [
  // Edificio C
  {
    nombre: 'Crea Inacap',
    edificio: 'C',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 13,
    meshName: 'C_P1_Grupo_13',
    tipo: 'Laboratorio de Innovación',
    desc: 'Laboratorio y espacio de innovación estudiantil CREA INACAP.',
    coordenadas: { x: 1.68, y: 1.17, z: 8 }
  },
  {
    nombre: 'Sala C102',
    edificio: 'C',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 15,
    meshName: 'C_P1_Grupo_15',
    tipo: 'Electricidad y Electrónica',
    desc: 'Laboratorio de Electricidad y Electrónica básica y aplicada.',
    coordenadas: { x: 0.9, y: 1.2, z: 0.1 }
  },
  {
    nombre: 'Sala C103',
    edificio: 'C',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 5,
    meshName: 'C_P1_Grupo_5',
    tipo: 'Aplicaciones Computacionales',
    desc: 'Laboratorio de computación y desarrollo de software.',
    coordenadas: { x: 0.7, y: 1.2, z: -1.4 }
  },
  {
    nombre: 'Sala C104',
    edificio: 'C',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 6,
    meshName: 'C_P1_Grupo_6',
    tipo: 'Instrumentación y Control',
    desc: 'Taller de instrumentación, control y automatización de procesos.',
    coordenadas: { x: 1.3, y: 1.2, z: -3.9 }
  },
  {
    nombre: 'Sala C105',
    edificio: 'C',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 7,
    meshName: 'C_P1_Grupo_7',
    tipo: 'Aplicaciones Computacionales',
    desc: 'Laboratorio de informática aplicada y redes.',
    coordenadas: { x: 1, y: 1.2, z: -6.3 }
  },
  {
    nombre: 'Sala C106',
    edificio: 'C',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 9,
    meshName: 'C_P1_Grupo_9',
    tipo: 'Electricidad y Electrónica',
    desc: 'Laboratorio de circuitos eléctricos y mediciones electrónicas.',
    coordenadas: { x: 1, y: 1.2, z: 6.3 }
  },
  {
    nombre: 'Sala C107',
    edificio: 'C',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 16,
    meshName: 'C_P1_Grupo_16',
    tipo: 'Aplicaciones Computacionales',
    desc: 'Laboratorio de computación multimedia y programación.',
    coordenadas: { x: 0.8, y: 1.2, z: 10.6 }
  },
  // Edificio D
  {
    nombre: 'Sala D102',
    edificio: 'D',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 4,
    meshName: 'D_P1_Grupo_4',
    tipo: 'Instalaciones Eléctricas',
    desc: 'Taller de instalaciones eléctricas residenciales e industriales.',
    coordenadas: { x: 2.9, y: 1.6, z: 4.4 }
  },
  {
    nombre: 'Sala D106',
    edificio: 'D',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 29,
    meshName: 'D_P1_Grupo_29',
    tipo: 'Energía y Redes',
    desc: 'Laboratorio de redes eléctricas y generación de energía.',
    coordenadas: { x: -2.9, y: 1.6, z: -1.6 }
  },
  // Edificio A Piso 3
  {
    nombre: 'Sala A301',
    edificio: 'A',
    piso: 'Piso 3',
    floorNum: 3,
    cuerpo: 21,
    tipo: 'Computación',
    desc: 'Laboratorio de informática y desarrollo de software.',
    coordenadas: { x: 6.95, y: 1.88, z: 2.67 }
  },
  {
    nombre: 'Sala A304',
    edificio: 'A',
    piso: 'Piso 3',
    floorNum: 3,
    cuerpo: 22,
    tipo: 'Computación',
    desc: 'Laboratorio de computación y sistemas operativos.',
    coordenadas: { x: 5.3, y: 1.88, z: -2.94 }
  },
  {
    nombre: 'Sala A305',
    edificio: 'A',
    piso: 'Piso 3',
    floorNum: 3,
    cuerpo: 3,
    tipo: 'Computación',
    desc: 'Laboratorio de computación y modelado 3D.',
    coordenadas: { x: 3.56, y: 1.7, z: 3.23 }
  },
  {
    nombre: 'Sala A310',
    edificio: 'A',
    piso: 'Piso 3',
    floorNum: 3,
    cuerpo: 12,
    tipo: 'Telecomunicaciones',
    desc: 'Laboratorio de telecomunicaciones, antenas y fibra óptica.',
    coordenadas: { x: -0.16, y: 1.88, z: -2.65 }
  },
  {
    nombre: 'Sala A314',
    edificio: 'A',
    piso: 'Piso 3',
    floorNum: 3,
    cuerpo: 48,
    tipo: 'Laboratorio Leica',
    desc: 'Laboratorio de geomática, topografía e instrumental Leica.',
    coordenadas: { x: -3.58, y: 0.86, z: -2.01 }
  },
  {
    nombre: 'Sala A315',
    edificio: 'A',
    piso: 'Piso 3',
    floorNum: 3,
    cuerpo: 8,
    tipo: 'Laboratorio Leica',
    desc: 'Laboratorio de topografía, geodesia y tecnología Leica.',
    coordenadas: { x: -5.37, y: 1.88, z: 2.79 }
  },
  {
    nombre: 'Sala A316',
    edificio: 'A',
    piso: 'Piso 3',
    floorNum: 3,
    cuerpo: 5,
    tipo: 'Telecomunicaciones',
    desc: 'Laboratorio de redes y telecomunicaciones avanzadas.',
    coordenadas: { x: -5.43, y: 1.88, z: -2.63 }
  },
  {
    nombre: 'Sala A317',
    edificio: 'A',
    piso: 'Piso 3',
    floorNum: 3,
    cuerpo: 40,
    tipo: 'Telecomunicaciones',
    desc: 'Laboratorio de conmutación y tecnologías IP.',
    coordenadas: { x: -7.31, y: 1.88, z: 2.93 }
  },
  // Edificio E Piso 2
  {
    nombre: 'Sala E202',
    edificio: 'E',
    piso: 'Piso 2',
    floorNum: 2,
    cuerpo: null,
    tipo: 'Laboratorio PLC',
    desc: 'Laboratorio de controladores lógicos programables PLC.',
    coordenadas: null
  },
  {
    nombre: 'Sala E203',
    edificio: 'E',
    piso: 'Piso 2',
    floorNum: 2,
    cuerpo: null,
    tipo: 'Laboratorio PLC',
    desc: 'Laboratorio de automatización industrial y PLC.',
    coordenadas: null
  },
  {
    nombre: 'Sala E204',
    edificio: 'E',
    piso: 'Piso 2',
    floorNum: 2,
    cuerpo: null,
    tipo: 'Comandos Eléctricos',
    desc: 'Taller de comandos eléctricos industriales y contactores.',
    coordenadas: null
  },
];

// ── Oficinas y Servicios en Firestore ────────────────────────────────────────
const OFICINAS_VERIFICADAS: LocationDrawerItem[] = [
  {
    nombre: 'Sala de Tutorias 1 Piso 1 Edificio A',
    edificio: 'A',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 13,
    tipo: 'Tutorías y Asesoría',
    desc: 'Espacio de reforzamiento académico y tutorías personalizadas.',
    coordenadas: { x: 26.65, y: 2, z: 4.88 }
  },
  {
    nombre: 'Sala de Tutorias 2 Piso 1 Edificio A',
    edificio: 'A',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 27,
    tipo: 'Tutorías y Asesoría',
    desc: 'Sala de atención docente y tutorías grupales.',
    coordenadas: { x: 30.68, y: 2, z: 4.93 }
  },
  {
    nombre: 'Sala de tutorias 3 Piso 1 Edificio A',
    edificio: 'A',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 29,
    tipo: 'Tutorías y Asesoría',
    desc: 'Sala de apoyo académico al estudiante.',
    coordenadas: { x: 34.62, y: 2, z: 4.88 }
  },
  {
    nombre: 'Sala de tutorias 4 Piso 1 Edificio A',
    edificio: 'A',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 30,
    tipo: 'Tutorías y Asesoría',
    desc: 'Sala de mentorías y orientación estudiantil.',
    coordenadas: { x: 38.64, y: 2, z: 4.88 }
  },
  {
    nombre: 'Fotocopiadora y Suministros Piso 1 Edificio A',
    edificio: 'A',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 28,
    tipo: 'Servicio Estudiantil',
    desc: 'Centro de impresión, fotocopias y materiales de estudio.',
    coordenadas: { x: 36.68, y: 2, z: -0.29 }
  },
  {
    nombre: 'Jefe de operaciones 1',
    edificio: 'B',
    piso: 'Piso 2',
    floorNum: 2,
    cuerpo: 5,
    tipo: 'Oficina Administrativa',
    desc: 'Oficina de jefatura de operaciones y administración Edificio B.',
    coordenadas: { x: -7.3, y: 4.93, z: -0.27 }
  },
  {
    nombre: 'Jefe de operaciones 2',
    edificio: 'B',
    piso: 'Piso 2',
    floorNum: 2,
    cuerpo: 5,
    tipo: 'Oficina Administrativa',
    desc: 'Oficina de jefatura operativa y gestión académica.',
    coordenadas: { x: -7.44, y: 4.93, z: 2.9 }
  },
  {
    nombre: 'Sala de Reuniones Piso 1 Edificio C',
    edificio: 'C',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 14,
    meshName: 'C_P1_Grupo_14',
    tipo: 'Sala de Reuniones',
    desc: 'Sala de reuniones departamental y atención institucional.',
    coordenadas: { x: 3.68, y: 1.2, z: 8.2 }
  },
  {
    nombre: 'Sala de Materiales Piso 1 Edificio C',
    edificio: 'C',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 3,
    meshName: 'C_P1_Grupo_3',
    tipo: 'Almacén y Pañol',
    desc: 'Pañol de herramientas, componentes e insumos de laboratorio.',
    coordenadas: { x: 0.94, y: 1.17, z: 11 }
  },
];

// ── Escaleras Reales ─────────────────────────────────────────────────────────
const ESCALERAS_VERIFICADAS: LocationDrawerItem[] = [
  {
    nombre: 'Escalera Principal Piso 1 Edificio A',
    edificio: 'A',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 21,
    tipo: 'Escalera',
    desc: 'Escalera principal este conectando Piso 1 ↔ Piso 2.',
    coordenadas: { x: 40.25, y: 0.4, z: 11.45 }
  },
  {
    nombre: 'Escalera Secundaria Piso 1 Edificio A',
    edificio: 'A',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 14,
    tipo: 'Escalera',
    desc: 'Escalera oeste conectando Piso 1 ↔ Piso 2.',
    coordenadas: { x: 5.52, y: 0.4, z: 10.73 }
  },
  {
    nombre: 'Escalera a primer piso Piso 2 Edificio A',
    edificio: 'A',
    piso: 'Piso 2',
    floorNum: 2,
    cuerpo: 28,
    tipo: 'Escalera',
    desc: 'Descenso a primer piso.',
    coordenadas: { x: 8.22, y: 0.1, z: 4.12 }
  },
  {
    nombre: 'Escalera Secundaria Piso 2 Edificio A',
    edificio: 'A',
    piso: 'Piso 2',
    floorNum: 2,
    cuerpo: 8,
    tipo: 'Escalera',
    desc: 'Escalera secundaria oeste hacia tercer piso.',
    coordenadas: { x: -8.73, y: 0.71, z: 2.82 }
  },
  {
    nombre: 'Escalera a tercer piso Piso 2 Edificio A',
    edificio: 'A',
    piso: 'Piso 2',
    floorNum: 2,
    cuerpo: 23,
    tipo: 'Escalera',
    desc: 'Escalera principal este hacia tercer piso.',
    coordenadas: { x: 10.87, y: 0.71, z: 4.09 }
  },
  {
    nombre: 'Escalera Principal Piso 3 Edificio A',
    edificio: 'A',
    piso: 'Piso 3',
    floorNum: 3,
    cuerpo: 26,
    tipo: 'Escalera',
    desc: 'Escalera principal este conectando Piso 3 ↔ Piso 2.',
    coordenadas: { x: 8.97, y: 1.58, z: -1.34 }
  },
  {
    nombre: 'Escalera Secundaria Piso 3 Edificio A',
    edificio: 'A',
    piso: 'Piso 3',
    floorNum: 3,
    cuerpo: 6,
    tipo: 'Escalera',
    desc: 'Escalera secundaria oeste conectando Piso 3 ↔ Piso 2.',
    coordenadas: { x: -8.82, y: 0.66, z: 2.62 }
  },
  {
    nombre: 'Escalera Piso 1 Edificio C',
    edificio: 'C',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 1,
    meshName: 'C_P1_Grupo_1',
    tipo: 'Escalera',
    desc: 'Escalera principal Edificio C conectando Piso 1 ↔ Piso 2.',
    coordenadas: { x: 0.3, y: 0.5, z: 8 }
  },
  {
    nombre: 'Escalera',
    edificio: 'D',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 3,
    meshName: 'D_P1_Grupo_3',
    tipo: 'Escalera',
    desc: 'Escalera principal Edificio D conectando Piso 1 ↔ Piso 2.',
    coordenadas: { x: -3.5, y: 0.7, z: 7.6 }
  },
  {
    nombre: 'Escalera Edificio B',
    edificio: 'B',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 9,
    tipo: 'Escalera',
    desc: 'Escalera central Edificio B conectando Pisos 1, 2 y 3.',
    coordenadas: { x: -0.49, y: 0.05, z: -11.40 }
  },
];

// ── Salas Destacadas Representativas de cada Edificio ────────────────────────
const SALAS_DESTACADAS_VERIFICADAS: LocationDrawerItem[] = [
  {
    nombre: 'Sala A105',
    edificio: 'A',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 18,
    tipo: 'Sala de clases',
    desc: 'Sala de Clases — Cuerpo 18, Edificio A, Piso 1.',
    coordenadas: { x: 19.45, y: 2, z: 4.88 }
  },
  {
    nombre: 'Sala A201',
    edificio: 'A',
    piso: 'Piso 2',
    floorNum: 2,
    cuerpo: 6,
    tipo: 'Sala de clases',
    desc: 'Sala de Clases — Cuerpo 6, Edificio A, Piso 2.',
    coordenadas: { x: 6.88, y: 1.42, z: 2.85 }
  },
  {
    nombre: 'Sala B304',
    edificio: 'B',
    piso: 'Piso 3',
    floorNum: 3,
    cuerpo: 1,
    tipo: 'Sala de clases',
    desc: 'Sala de Clases — Cuerpo 1, Edificio B, Piso 3.',
    coordenadas: { x: 1.91, y: 0.18, z: -3.49 }
  },
  {
    nombre: 'Sala C101',
    edificio: 'C',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 17,
    meshName: 'C_P1_Grupo_17',
    tipo: 'Convenio Legrand',
    desc: 'Sala de especialidad Convenio Legrand — Cuerpo 17, Edificio C, Piso 1.',
    coordenadas: { x: 0.8, y: 1.2, z: 3.1 }
  },
  {
    nombre: 'Sala D101',
    edificio: 'D',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: 9,
    meshName: 'D_P1_Grupo_9',
    tipo: 'Sala de clases',
    desc: 'Sala de Clases — Cuerpo 9, Edificio D, Piso 1.',
    coordenadas: { x: 3, y: 1.6, z: 9.2 }
  },
  {
    nombre: 'Sala E101',
    edificio: 'E',
    piso: 'Piso 1',
    floorNum: 1,
    cuerpo: null,
    tipo: 'Sala de clases',
    desc: 'Sala de Clases — Edificio E, Piso 1.',
    coordenadas: null
  },
];

// LocalStorage key
const LS_RECIENTES_KEY = 'inago_recent_rooms';
const MAX_RECIENTES = 5;

/**
 * Resuelve de forma única y canónica el edificio de una locación o sala.
 * Previene inconsistencias causadas por hashes de documentos de Firestore.
 */
export function resolveLocationBuilding(l: any): BuildingId {
  if (!l) return 'A';

  // 1. Código de sala al inicio del nombre (ej. "E101", "Sala E101", "A105", "F206", "B304")
  const nombre = (l.Nombre || l.nombre || '').trim();
  const roomMatch = nombre.match(/^(?:sala\s+)?([a-zA-Z])\d{2,3}\b/i);
  if (roomMatch) {
    return roomMatch[1].toUpperCase() as BuildingId;
  }

  // 2. Nombre del edificio estructurado (ej. "Edificio E", "Edificio A")
  const edNombre = (l._edificioNombre || l.edificioNombre || '').toString();
  const edNombreMatch = edNombre.match(/edifici?o\s*([a-zA-Z0-9]+)/i);
  if (edNombreMatch) {
    return edNombreMatch[1].toUpperCase() as BuildingId;
  }

  // 3. Campo directo si ya es una letra simple (A, B, C, D, E, F)
  const direct = (l.edificio || l.Edificio || l._edificioCodigo || '').toString().trim().toUpperCase();
  if (/^[A-Z]$/.test(direct)) {
    return direct as BuildingId;
  }

  // 4. Si el id del edificio es una sola letra (no un hash de Firestore)
  const edId = (l.edificioId || l._edificioId || '').toString().trim();
  if (edId.length === 1 && /^[A-Z]$/i.test(edId)) {
    return edId.toUpperCase() as BuildingId;
  }

  // 5. En descripción o tipo
  const desc = (l.desc || l.Descripcion || l.tipo || '').toString();
  const descMatch = desc.match(/edifici?o\s*([a-zA-Z0-9]+)/i);
  if (descMatch) {
    return descMatch[1].toUpperCase() as BuildingId;
  }

  return 'A';
}

@Component({
  selector: 'app-nav-drawer',
  templateUrl: './nav-drawer.component.html',
  styleUrls: ['./nav-drawer.component.scss'],
})
export class NavDrawerComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Output() closeDrawer = new EventEmitter<void>();

  /**
   * Disparado cuando el usuario hace clic en cualquier localidad del drawer.
   * Emite el objeto completo para que Map3dContainer lo enfoque en 3D
   * y abra el panel de detalle exactamente como un click en el mapa.
   */
  @Output() selectLocation = new EventEmitter<LocationDrawerItem>();

  /** Emitido para compatibilidad directa con el calculador de rutas */
  @Output() destinationSelected = new EventEmitter<string>();

  /** Emitido cuando se necesita enfocar un mesh directamente */
  @Output() focusMesh = new EventEmitter<{ meshName: string; buildingId: BuildingId; floorNum: number }>();

  /** Emitido cuando se necesita cambiar de edificio/piso */
  @Output() navigateTo = new EventEmitter<{ buildingId: BuildingId; floorNum: number }>();

  currentView: DrawerView = 'main';
  previousView: DrawerView | null = null;

  // ── Baños ─────────────────────────────────────────────────────────────────
  banoGroups: BanoEdificioGroup[] = [];
  selectedBano: LocationDrawerItem | null = null;

  // ── Salas ─────────────────────────────────────────────────────────────────
  salasDestacadas: LocationDrawerItem[] = SALAS_DESTACADAS_VERIFICADAS;
  salasRecientes: LocationDrawerItem[] = [];
  salasSearchQuery = '';
  selectedBuildingFilter: BuildingId | 'ALL' = 'ALL';
  salasSearchResultsFiltered: LocationDrawerItem[] = [];
  allSalas: LocationDrawerItem[] = [];
  selectedSala: LocationDrawerItem | null = null;
  isLoadingSalas = false;

  // ── Laboratorios ──────────────────────────────────────────────────────────
  laboratoriosList: LocationDrawerItem[] = LABORATORIOS_VERIFICADOS;
  laboratoriosFiltered: LocationDrawerItem[] = LABORATORIOS_VERIFICADOS;
  selectedLabBuildingFilter: BuildingId | 'ALL' = 'ALL';
  isLoadingLabs = false;

  // ── Oficinas ─────────────────────────────────────────────────────────────
  allOficinas: LocationDrawerItem[] = OFICINAS_VERIFICADAS;
  oficinasSearchQuery = '';
  oficinasFiltered: LocationDrawerItem[] = OFICINAS_VERIFICADAS;
  selectedOficina: LocationDrawerItem | null = null;
  isLoadingOficinas = false;

  // ── Escaleras ─────────────────────────────────────────────────────────────
  escalerasList: LocationDrawerItem[] = ESCALERAS_VERIFICADAS;
  selectedEscalera: string | null = null;

  // ── Edificios para filtros ────────────────────────────────────────────────
  readonly buildingFilterOptions: { id: BuildingId | 'ALL'; label: string }[] = [
    { id: 'ALL', label: 'Todos' },
    { id: 'A', label: 'Edif. A' },
    { id: 'B', label: 'Edif. B' },
    { id: 'C', label: 'Edif. C' },
    { id: 'D', label: 'Edif. D' },
    { id: 'E', label: 'Edif. E' },
  ];

  get viewTitle(): string {
    const titles: Record<DrawerView, string> = {
      main: 'MENÚ',
      banos: 'Baños',
      biblioteca: 'Biblioteca',
      cafeteria: 'Cafetería',
      enfermeria: 'Enfermería',
      recepcion: 'Recepción',
      salas: 'Salas',
      laboratorios: 'Laboratorios',
      oficinas: 'Oficinas',
      escaleras: 'Escaleras',
    };
    return titles[this.currentView] ?? 'MENÚ';
  }

  // ── Getters para Salas Destacadas y Recientes filtradas por edificio ───────

  get filteredSalasDestacadas(): LocationDrawerItem[] {
    if (this.selectedBuildingFilter === 'ALL') {
      return this.salasDestacadas || [];
    }
    // Al elegir un edificio (ej. E), solo salas de ese edificio, máximo 5
    const pool = (this.allSalas && this.allSalas.length > 0) ? this.allSalas : SALAS_DESTACADAS_VERIFICADAS;
    return pool.filter(s => s && s.edificio === this.selectedBuildingFilter).slice(0, 5);
  }

  get filteredSalasRecientes(): LocationDrawerItem[] {
    if (this.selectedBuildingFilter === 'ALL') {
      return this.salasRecientes || [];
    }
    return (this.salasRecientes || []).filter(s => s && s.edificio === this.selectedBuildingFilter);
  }

  constructor(
    private espaciosApi: EspaciosApiService,
    private mapNavService: MapNavigationService,
    private buildingRegistry: BuildingRegistryService,
  ) {}

  ngOnInit(): void {
    this._buildBanoGroups();
    this._loadRecientes();
    this.onSalasSearch();
    this._ensureSalasLoaded();
  }

  ngOnDestroy(): void {}

  // ── Navegación interna del panel ──────────────────────────────────────────

  navigateToView(view: DrawerView): void {
    this.previousView = this.currentView;
    this.currentView = view;

    switch (view) {
      case 'salas':
        this._ensureSalasLoaded();
        break;
      case 'laboratorios':
        this._ensureLabsLoaded();
        break;
      case 'oficinas':
        this._ensureOficinasLoaded();
        break;
      case 'escaleras':
        this._buildEscaleras();
        break;
    }
  }

  goBack(): void {
    this.currentView = 'main';
    this.previousView = null;
    this.selectedBano = null;
    this.selectedSala = null;
    this.selectedOficina = null;
    this.selectedEscalera = null;
    this.salasSearchQuery = '';
    this.salasSearchResultsFiltered = [];
    this.oficinasSearchQuery = '';
    this.oficinasFiltered = [...this.allOficinas];
  }

  onClose(): void {
    this.goBack();
    this.closeDrawer.emit();
  }

  // ── Selección unificada de localidades (Igual a hacer clic en el mapa 3D) ─

  /**
   * Método central para seleccionar cualquier elemento del drawer.
   * Cierra el panel lateral, navega al piso/edificio correspondiente,
   * enfoca el cuerpo 3D con la cámara y abre el panel de detalle de locación
   * (`app-location-detail-panel`) con su botón "Cómo llegar", exactamente
   * como cuando el usuario hace clic directo sobre un cuerpo en el mapa.
   *
   * @param item Objeto de la localidad
   * @param autoRoute Si es true, inicia también de inmediato el trazado de la ruta
   */
  selectItem(item: LocationDrawerItem, autoRoute = false): void {
    this.closeDrawer.emit();
    this._addReciente(item);

    const payload: LocationDrawerItem = {
      ...item,
      autoRoute,
    };

    // Emitir el evento de selección completa hacia AppComponent -> Map3dContainer
    this.selectLocation.emit(payload);

    // Si se pidió cálculo inmediato de ruta, emitir también destinationSelected
    if (autoRoute) {
      this.destinationSelected.emit(item.nombre);
    }
  }

  // ── Baños ─────────────────────────────────────────────────────────────────

  private _buildBanoGroups(): void {
    const edificios: BuildingId[] = ['A', 'C', 'D'];
    const grupos: BanoEdificioGroup[] = [];

    for (const edId of edificios) {
      const banosDe = BANOS_VERIFICADOS.filter(b => b.edificio === edId);
      const pisos = Array.from(new Set(banosDe.map(b => b.piso))).sort();
      grupos.push({
        edificio: `Edificio ${edId}`,
        edificioId: edId,
        pisos: pisos.map(p => {
          const pBanos = banosDe.filter(b => b.piso === p);
          const floorNum = pBanos[0]?.floorNum || 1;
          return { piso: p, floorNum, banos: pBanos };
        }),
        expandido: edId === 'A', // Abrir Edificio A por defecto
      });
    }

    this.banoGroups = grupos;
  }

  toggleEdificioBano(group: BanoEdificioGroup): void {
    group.expandido = !group.expandido;
  }

  selectBano(bano: LocationDrawerItem, autoRoute = false): void {
    this.selectedBano = bano;
    this.selectItem(bano, autoRoute);
  }

  // ── Biblioteca ─────────────────────────────────────────────────────────────

  localizarBiblioteca(autoRoute = false): void {
    const biblioItem: LocationDrawerItem = {
      nombre: 'Biblioteca',
      edificio: 'B',
      piso: 'Piso 2',
      floorNum: 2,
      cuerpo: null,
      tipo: 'Servicio',
      desc: 'Centro de Recursos para el Aprendizaje INACAP. Libros, computadores y salas de estudio — Edificio B, Piso 2.',
      coordenadas: null,
      autoRoute,
    };
    this.selectItem(biblioItem, autoRoute);
  }

  // ── Cafetería ──────────────────────────────────────────────────────────────

  localizarCafeteria(autoRoute = false): void {
    const cafeItem: LocationDrawerItem = {
      nombre: 'Cafeteria',
      edificio: 'A',
      piso: 'Piso 1',
      floorNum: 1,
      cuerpo: null,
      tipo: 'Servicio',
      desc: 'Casino y cafetería de la comunidad INACAP — Edificio A, Piso Subterráneo / Acceso.',
      coordenadas: null,
      autoRoute,
    };
    this.selectItem(cafeItem, autoRoute);
  }

  // ── Enfermería ─────────────────────────────────────────────────────────────

  localizarEnfermeria(autoRoute = false): void {
    const enfItem: LocationDrawerItem = {
      nombre: 'Enfermería',
      edificio: 'A',
      piso: 'Piso 1',
      floorNum: 1,
      cuerpo: null,
      tipo: 'Servicio',
      desc: 'Atención médica y primeros auxilios — Hall Central / Edificio A, Piso 1.',
      coordenadas: null,
      autoRoute,
    };
    this.selectItem(enfItem, autoRoute);
  }

  // ── Recepción ──────────────────────────────────────────────────────────────

  localizarRecepcion(autoRoute = false): void {
    const recItem: LocationDrawerItem = {
      nombre: 'Recepción',
      edificio: 'A',
      piso: 'Piso 1',
      floorNum: 1,
      cuerpo: null,
      tipo: 'Servicio',
      desc: 'Punto de información y orientación institucional — Edificio A, Piso 1.',
      coordenadas: null,
      autoRoute,
    };
    this.selectItem(recItem, autoRoute);
  }

  // ── Salas ─────────────────────────────────────────────────────────────────

  private async _ensureSalasLoaded(): Promise<void> {
    if (this.allSalas.length > 0) return;
    this.isLoadingSalas = true;
    try {
      const locs = await this.espaciosApi.getLocacionesDeTodosLosEdificios();
      const mapped = (locs || [])
        .filter((l: any) => {
          const tipo = (l.Tipo || l.tipo || '').toLowerCase();
          const nombre = (l.Nombre || l.nombre || '').toLowerCase();
          const esSala = tipo.includes('sala') || tipo.includes('aula') || tipo.includes('clase') || /^[a-z]\d{3}/i.test(nombre);
          const esBanoOEscalera = tipo.includes('baño') || tipo.includes('escalera') || nombre.includes('baño') || nombre.includes('escalera');
          return esSala && !esBanoOEscalera;
        })
        .map((l: any): LocationDrawerItem => {
          const edificio = resolveLocationBuilding(l);
          const pisoRaw = l.Piso || l.piso || 'Piso 1';
          const pNumMatch = (pisoRaw || '').match(/\d+/);
          const floorNum = pNumMatch ? parseInt(pNumMatch[0], 10) : 1;
          const cuerpoRaw = l.Cuerpo ?? l.cuerpo ?? null;
          const cuerpo = cuerpoRaw != null ? parseInt(cuerpoRaw.toString().replace(/\D/g, ''), 10) || null : null;
          const coords = l.coordenadas || l.Coordenadas || l['Coordenadas 3D'] || null;

          return {
            nombre: l.Nombre || l.nombre || '',
            edificio,
            piso: `Piso ${floorNum}`,
            floorNum,
            cuerpo,
            meshName: l.MeshName || l.meshName || (cuerpo ? `cuerpo${cuerpo}` : undefined),
            tipo: l.Tipo || l.tipo || 'Sala de clases',
            desc: `${l.Tipo || l.tipo || 'Sala de clases'} — ${cuerpo ? `Cuerpo ${cuerpo}, ` : ''}Edificio ${edificio}, Piso ${floorNum}.`,
            coordenadas: coords,
          };
        })
        .filter((s: LocationDrawerItem) => s.nombre.trim() !== '');

      if (mapped.length > 0) {
        // Eliminar duplicados por nombre
        const map = new Map<string, LocationDrawerItem>();
        for (const s of mapped) {
          if (!map.has(s.nombre)) map.set(s.nombre, s);
        }
        this.allSalas = Array.from(map.values());
      } else {
        this.allSalas = [...SALAS_DESTACADAS_VERIFICADAS];
      }
    } catch {
      this.allSalas = [...SALAS_DESTACADAS_VERIFICADAS];
    }
    this.isLoadingSalas = false;
    this.onSalasSearch();
  }

  setBuildingFilter(buildingId: BuildingId | 'ALL'): void {
    this.selectedBuildingFilter = buildingId;
    this.onSalasSearch();
  }

  onSalasSearch(): void {
    const q = this.salasSearchQuery.trim().toLowerCase();
    let pool = this.allSalas.length > 0 ? this.allSalas : SALAS_DESTACADAS_VERIFICADAS;

    if (this.selectedBuildingFilter !== 'ALL') {
      pool = pool.filter(s => s.edificio === this.selectedBuildingFilter);
    }

    if (!q) {
      this.salasSearchResultsFiltered = [...pool];
      return;
    }

    this.salasSearchResultsFiltered = pool
      .filter(s => {
        const n = s.nombre.toLowerCase();
        const code = n.replace(/^sala\s*/i, '');
        return n.includes(q) || code.includes(q) || (s.tipo || '').toLowerCase().includes(q);
      });
  }

  onSalasSearchEnter(): void {
    if (this.salasSearchResultsFiltered.length > 0) {
      this.selectSala(this.salasSearchResultsFiltered[0]);
    } else if (this.salasSearchQuery.trim()) {
      const q = this.salasSearchQuery.trim().toLowerCase();
      const match = this.allSalas.find(s => s.nombre.toLowerCase().includes(q));
      if (match) {
        this.selectSala(match);
      } else {
        this.closeDrawer.emit();
        this.destinationSelected.emit(this.salasSearchQuery.trim());
      }
    }
  }

  selectSala(sala: LocationDrawerItem, autoRoute = false): void {
    this.selectedSala = sala;
    this.selectItem(sala, autoRoute);
  }

  // ── Búsquedas recientes ───────────────────────────────────────────────────

  private _loadRecientes(): void {
    try {
      const raw = localStorage.getItem(LS_RECIENTES_KEY);
      const parsed: LocationDrawerItem[] = raw ? JSON.parse(raw) : [];
      // Aseguramos que los elementos guardados previamente tengan su edificio resuelto de forma canónica
      this.salasRecientes = parsed.map(r => ({
        ...r,
        edificio: resolveLocationBuilding(r)
      }));
    } catch {
      this.salasRecientes = [];
    }
  }

  private _addReciente(sala: LocationDrawerItem): void {
    const itemToSave: LocationDrawerItem = {
      ...sala,
      edificio: sala.edificio || resolveLocationBuilding(sala)
    };
    this.salasRecientes = this.salasRecientes.filter(r => r.nombre !== itemToSave.nombre);
    this.salasRecientes.unshift(itemToSave);
    if (this.salasRecientes.length > MAX_RECIENTES) {
      this.salasRecientes = this.salasRecientes.slice(0, MAX_RECIENTES);
    }
    try {
      localStorage.setItem(LS_RECIENTES_KEY, JSON.stringify(this.salasRecientes));
    } catch {}
  }

  clearRecientes(): void {
    this.salasRecientes = [];
    try {
      localStorage.removeItem(LS_RECIENTES_KEY);
    } catch {}
  }

  // ── Laboratorios ──────────────────────────────────────────────────────────

  private async _ensureLabsLoaded(): Promise<void> {
    if (this.laboratoriosList.length > LABORATORIOS_VERIFICADOS.length) return;
    this.isLoadingLabs = true;
    try {
      const locs = await this.espaciosApi.getLocacionesDeTodosLosEdificios();
      const apiLabs = (locs || [])
        .filter((l: any) => {
          const tipo = (l.Tipo || l.tipo || '').toLowerCase();
          const nombre = (l.Nombre || l.nombre || '').toLowerCase();
          return (
            tipo.includes('lab') ||
            tipo.includes('taller') ||
            tipo.includes('computacion') ||
            tipo.includes('leica') ||
            tipo.includes('telecom') ||
            tipo.includes('plc') ||
            tipo.includes('electron') ||
            tipo.includes('electr') ||
            nombre.includes('crea')
          );
        })
        .map((l: any): LocationDrawerItem => {
          const edificio = resolveLocationBuilding(l);
          const pisoRaw = l.Piso || l.piso || 'Piso 1';
          const pNumMatch = (pisoRaw || '').match(/\d+/);
          const floorNum = pNumMatch ? parseInt(pNumMatch[0], 10) : 1;
          const cuerpoRaw = l.Cuerpo ?? l.cuerpo ?? null;
          const cuerpo = cuerpoRaw != null ? parseInt(cuerpoRaw.toString().replace(/\D/g, ''), 10) || null : null;
          const coords = l.coordenadas || l.Coordenadas || l['Coordenadas 3D'] || null;

          return {
            nombre: l.Nombre || l.nombre || '',
            edificio,
            piso: `Piso ${floorNum}`,
            floorNum,
            cuerpo,
            meshName: l.MeshName || l.meshName || (cuerpo ? `cuerpo${cuerpo}` : undefined),
            tipo: l.Tipo || l.tipo || 'Laboratorio',
            desc: `${l.Tipo || l.tipo || 'Laboratorio'} — ${cuerpo ? `Cuerpo ${cuerpo}, ` : ''}Edificio ${edificio}, Piso ${floorNum}.`,
            coordenadas: coords,
          };
        });

      if (apiLabs.length > 0) {
        const map = new Map<string, LocationDrawerItem>();
        for (const l of [...LABORATORIOS_VERIFICADOS, ...apiLabs]) {
          if (!map.has(l.nombre)) map.set(l.nombre, l);
        }
        this.laboratoriosList = Array.from(map.values());
      }
    } catch {
      this.laboratoriosList = [...LABORATORIOS_VERIFICADOS];
    }
    this.isLoadingLabs = false;
    this.filterLabs();
  }

  setLabBuildingFilter(buildingId: BuildingId | 'ALL'): void {
    this.selectedLabBuildingFilter = buildingId;
    this.filterLabs();
  }

  filterLabs(): void {
    if (this.selectedLabBuildingFilter === 'ALL') {
      this.laboratoriosFiltered = [...this.laboratoriosList];
    } else {
      this.laboratoriosFiltered = this.laboratoriosList.filter(l => l.edificio === this.selectedLabBuildingFilter);
    }
  }

  selectLaboratorio(lab: LocationDrawerItem, autoRoute = false): void {
    this.selectItem(lab, autoRoute);
  }

  // ── Oficinas ─────────────────────────────────────────────────────────────

  private async _ensureOficinasLoaded(): Promise<void> {
    if (this.allOficinas.length > OFICINAS_VERIFICADAS.length) return;
    this.isLoadingOficinas = true;
    try {
      const locs = await this.espaciosApi.getLocacionesDeTodosLosEdificios();
      const apiOficinas = (locs || [])
        .filter((l: any) => {
          const tipo = (l.Tipo || l.tipo || '').toLowerCase();
          const nombre = (l.Nombre || l.nombre || '').toLowerCase();
          return (
            tipo.includes('oficina') ||
            tipo.includes('admin') ||
            tipo.includes('reunio') ||
            tipo.includes('operacion') ||
            tipo.includes('jefe') ||
            tipo.includes('secretar') ||
            tipo.includes('tutoria') ||
            nombre.includes('tutoria') ||
            nombre.includes('jefe') ||
            nombre.includes('reunio')
          );
        })
        .map((l: any): LocationDrawerItem => {
          const edificio = resolveLocationBuilding(l);
          const pisoRaw = l.Piso || l.piso || 'Piso 1';
          const pNumMatch = (pisoRaw || '').match(/\d+/);
          const floorNum = pNumMatch ? parseInt(pNumMatch[0], 10) : 1;
          const cuerpoRaw = l.Cuerpo ?? l.cuerpo ?? null;
          const cuerpo = cuerpoRaw != null ? parseInt(cuerpoRaw.toString().replace(/\D/g, ''), 10) || null : null;
          const coords = l.coordenadas || l.Coordenadas || l['Coordenadas 3D'] || null;

          return {
            nombre: l.Nombre || l.nombre || '',
            edificio,
            piso: `Piso ${floorNum}`,
            floorNum,
            cuerpo,
            meshName: l.MeshName || l.meshName || (cuerpo ? `cuerpo${cuerpo}` : undefined),
            tipo: l.Tipo || l.tipo || 'Oficina',
            desc: `${l.Tipo || l.tipo || 'Oficina'} — ${cuerpo ? `Cuerpo ${cuerpo}, ` : ''}Edificio ${edificio}, Piso ${floorNum}.`,
            coordenadas: coords,
          };
        });

      if (apiOficinas.length > 0) {
        const map = new Map<string, LocationDrawerItem>();
        for (const o of [...OFICINAS_VERIFICADAS, ...apiOficinas]) {
          if (!map.has(o.nombre)) map.set(o.nombre, o);
        }
        this.allOficinas = Array.from(map.values());
      }
    } catch {
      this.allOficinas = [...OFICINAS_VERIFICADAS];
    }
    this.isLoadingOficinas = false;
    this.onOficinasSearch();
  }

  onOficinasSearch(): void {
    const q = this.oficinasSearchQuery.trim().toLowerCase();
    this.oficinasFiltered = q
      ? this.allOficinas.filter(o => o.nombre.toLowerCase().includes(q) || (o.tipo || '').toLowerCase().includes(q))
      : [...this.allOficinas];
  }

  selectOficina(oficina: LocationDrawerItem, autoRoute = false): void {
    this.selectedOficina = oficina;
    this.selectItem(oficina, autoRoute);
  }

  // ── Escaleras ─────────────────────────────────────────────────────────────

  private _buildEscaleras(): void {
    this.escalerasList = [...ESCALERAS_VERIFICADAS];
  }

  selectEscalera(item: LocationDrawerItem, autoRoute = false): void {
    this.selectedEscalera = item.nombre;
    this.selectItem(item, autoRoute);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatRoomName(name: string): string {
    return (name || '').replace(/^sala\s*/i, '');
  }

  cleanBanoName(name: string, edId: string): string {
    return (name || '').replace(` Edificio ${edId}`, '');
  }

  getPisoNum(piso: string): number {
    return parseInt(piso.replace(/\D/g, ''), 10) || 1;
  }

  trackByNombre(_: number, item: { nombre: string }): string {
    return item.nombre;
  }
}
