import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Map3dContainerComponent } from './map3d-container.component';
import { Firebase } from '../../../services/firebase';

describe('Map3dContainerComponent sede model selection', () => {
  it('should use the renamed Sede asset while still accepting the legacy file name', () => {
    const component = Map3dContainerComponent.createForTest(
      {} as Firebase,
      { run: (fn: () => unknown) => fn() } as NgZone,
      { detectChanges: () => undefined } as ChangeDetectorRef
    );

    expect((component as any).sedeModel).toBe('INSTITUTO CON LETRAS CON BASE FORMATO SKP.obj');
    expect((component as any).isSedeModel('MODELO_INACAP_FIXED.obj')).toBeTrue();
    expect((component as any).isSedeModel('INSTITUTO CON LETRAS CON BASE FORMATO SKP.obj')).toBeTrue();
  });
});
