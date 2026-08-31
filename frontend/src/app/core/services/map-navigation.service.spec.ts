import { MapNavigationService } from './map-navigation.service';
import { Firebase } from '../../services/firebase';

describe('MapNavigationService', () => {
  it('should override the room label for Cuerpo20 on building A first floor', async () => {
    const firebaseService = {
      getLocacionesDeTodosLosEdificios: jasmine.createSpy().and.resolveTo([
        {
          Nombre: 'Sala A309',
          Cuerpo: 20,
          Edificio: 'A',
          Piso: 'Piso 1'
        }
      ])
    } as unknown as Firebase;

    const service = new MapNavigationService(firebaseService);
    service.setBuilding('A');
    service.setFloor('Edifico A - Piso 1.obj');

    const info = await service.getLocationInfoByMeshNameAsync('cuerpo20');

    expect(info?.nombre).toBe('Sala A106');
  });

  it('should show Sala A101 for Cuerpo3 on building A first floor', async () => {
    const firebaseService = {
      getLocacionesDeTodosLosEdificios: jasmine.createSpy().and.resolveTo([])
    } as unknown as Firebase;

    const service = new MapNavigationService(firebaseService);
    service.setBuilding('A');
    service.setFloor('Edifico A - Piso 1.obj');

    const info = await service.getLocationInfoByMeshNameAsync('cuerpo3');

    expect(info?.nombre).toBe('Sala A101');
  });

  it('should show Sala A202 for Cuerpo20 on building A second floor', async () => {
    const firebaseService = {
      getLocacionesDeTodosLosEdificios: jasmine.createSpy().and.resolveTo([])
    } as unknown as Firebase;

    const service = new MapNavigationService(firebaseService);
    service.setBuilding('A');
    service.setFloor('Edifico A - Piso 2.obj');

    const info = await service.getLocationInfoByMeshNameAsync('cuerpo20');

    expect(info?.nombre).toBe('Sala A202');
  });

  it('should show Sala A113 for Cuerpo17 on building A first floor', async () => {
    const firebaseService = {
      getLocacionesDeTodosLosEdificios: jasmine.createSpy().and.resolveTo([])
    } as unknown as Firebase;

    const service = new MapNavigationService(firebaseService);
    service.setBuilding('A');
    service.setFloor('Edifico A - Piso 1.obj');

    const info = await service.getLocationInfoByMeshNameAsync('cuerpo17');

    expect(info?.nombre).toBe('Sala A113');
  });

  it('should show second-floor room labels for specific bodies on building A', async () => {
    const firebaseService = {
      getLocacionesDeTodosLosEdificios: jasmine.createSpy().and.resolveTo([])
    } as unknown as Firebase;

    const service = new MapNavigationService(firebaseService);
    service.setBuilding('A');
    service.setFloor('Edifico A - Piso 2.obj');

    const info3 = await service.getLocationInfoByMeshNameAsync('cuerpo3');
    const info1 = await service.getLocationInfoByMeshNameAsync('cuerpo1');
    const info13 = await service.getLocationInfoByMeshNameAsync('cuerpo13');
    const info19 = await service.getLocationInfoByMeshNameAsync('cuerpo19');
    const info12 = await service.getLocationInfoByMeshNameAsync('cuerpo12');
    const info7 = await service.getLocationInfoByMeshNameAsync('cuerpo7');
    const info11 = await service.getLocationInfoByMeshNameAsync('cuerpo11');
    const info18 = await service.getLocationInfoByMeshNameAsync('cuerpo18');
    const info15 = await service.getLocationInfoByMeshNameAsync('cuerpo15');
    const info17 = await service.getLocationInfoByMeshNameAsync('cuerpo17');
    const info55 = await service.getLocationInfoByMeshNameAsync('cuerpo55');
    const info9 = await service.getLocationInfoByMeshNameAsync('cuerpo9');

    expect(info3?.nombre).toBe('Sala A216');
    expect(info1?.nombre).toBe('Sala A218');
    expect(info13?.nombre).toBe('Sala 203');
    expect(info19?.nombre).toBe('Sala A205');
    expect(info12?.nombre).toBe('Sala A207');
    expect(info7?.nombre).toBe('Sala A209');
    expect(info11?.nombre).toBe('Sala A213');
    expect(info18?.nombre).toBe('Sala A215');
    expect(info15?.nombre).toBe('Sala A204');
    expect(info17?.nombre).toBe('Sala A206');
    expect(info55?.nombre).toBe('Sala A208');
    expect(info9?.nombre).toBe('Sala A2010');
  });

  it('should show third-floor labels for specific bodies on building A', async () => {
    const firebaseService = {
      getLocacionesDeTodosLosEdificios: jasmine.createSpy().and.resolveTo([])
    } as unknown as Firebase;

    const service = new MapNavigationService(firebaseService);
    service.setBuilding('A');
    service.setFloor('Edifico A - Piso 3.obj');

    const info13 = await service.getLocationInfoByMeshNameAsync('cuerpo13');
    const info10 = await service.getLocationInfoByMeshNameAsync('cuerpo10');
    const info11 = await service.getLocationInfoByMeshNameAsync('cuerpo11');
    const info12 = await service.getLocationInfoByMeshNameAsync('cuerpo12');
    const info7 = await service.getLocationInfoByMeshNameAsync('cuerpo7');
    const info21 = await service.getLocationInfoByMeshNameAsync('cuerpo21');
    const info3 = await service.getLocationInfoByMeshNameAsync('cuerpo3');
    const info20 = await service.getLocationInfoByMeshNameAsync('cuerpo20');
    const info9 = await service.getLocationInfoByMeshNameAsync('cuerpo9');
    const info23 = await service.getLocationInfoByMeshNameAsync('cuerpo23');
    const info55 = await service.getLocationInfoByMeshNameAsync('cuerpo55');
    const info1 = await service.getLocationInfoByMeshNameAsync('cuerpo1');
    const info2 = await service.getLocationInfoByMeshNameAsync('cuerpo2');

    expect(info13?.nombre).toBe('Baño de Dama');
    expect(info10?.nombre).toBe('Sala A302');
    expect(info11?.nombre).toBe('Sala A306');
    expect(info12?.nombre).toBe('Sala A310');
    expect(info7?.nombre).toBe('Sala A318');
    expect(info21?.nombre).toBe('Sala A301');
    expect(info3?.nombre).toBe('Sala A311');
    expect(info20?.nombre).toBe('Sala A309');
    expect(info9?.nombre).toBe('Sala A311');
    expect(info23?.nombre).toBe('Sala A312');
    expect(info55?.nombre).toBe('Sala A314');
    expect(info1?.nombre).toBe('Sala A308');
    expect(info2?.nombre).toBe('Baño de Varones');
  });
});
