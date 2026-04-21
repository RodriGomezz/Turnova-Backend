import { TestBed, fakeAsync, tick, discardPeriodicTasks, flush } from '@angular/core/testing';
import { ToastService, Toast } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  // ── Estado inicial ────────────────────────────────────────────────────────

  it('arranca sin toasts', () => {
    expect(service.toasts()).toEqual([]);
  });

  // ── show() ────────────────────────────────────────────────────────────────

  describe('show()', () => {
    it('agrega un toast con el mensaje y tipo correctos', () => {
      service.show('Hola mundo', 'success');
      const toasts = service.toasts();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Hola mundo');
      expect(toasts[0].type).toBe('success');
    });

    it('genera un id único para cada toast', () => {
      service.show('msg 1');
      service.show('msg 2');
      const ids = service.toasts().map(t => t.id);
      expect(ids[0]).not.toBe(ids[1]);
    });

    it('usa tipo "success" por defecto', () => {
      service.show('mensaje sin tipo');
      expect(service.toasts()[0].type).toBe('success');
    });

    it('acumula múltiples toasts', () => {
      service.show('A', 'success');
      service.show('B', 'error');
      service.show('C', 'info');
      expect(service.toasts().length).toBe(3);
    });

    it('remueve el toast automáticamente tras la duración (default 3500ms)', fakeAsync(() => {
      service.show('auto-remove');
      expect(service.toasts().length).toBe(1);
      tick(3500);
      expect(service.toasts().length).toBe(0);
    }));

    it('remueve el toast en la duración personalizada', fakeAsync(() => {
      service.show('custom', 'info', 1000);
      tick(999);
      expect(service.toasts().length).toBe(1);
      tick(1);
      expect(service.toasts().length).toBe(0);
    }));

    it('no remueve otros toasts al remover uno', fakeAsync(() => {
      service.show('primero', 'success', 1000);
      service.show('segundo', 'info', 5000);
      tick(1000);
      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].message).toBe('segundo');
      // Drenar el timer pendiente del segundo toast para que fakeAsync no falle
      tick(4000);
    }));
  });

  // ── success() ────────────────────────────────────────────────────────────

  describe('success()', () => {
    it('agrega toast de tipo success', () => {
      service.success('Guardado correctamente');
      expect(service.toasts()[0].type).toBe('success');
      expect(service.toasts()[0].message).toBe('Guardado correctamente');
    });
  });

  // ── error() ───────────────────────────────────────────────────────────────

  describe('error()', () => {
    it('agrega toast de tipo error', () => {
      service.error('Algo salió mal');
      expect(service.toasts()[0].type).toBe('error');
    });

    it('usa duración de 5000ms para errores', fakeAsync(() => {
      service.error('Error persistente');
      tick(4999);
      expect(service.toasts().length).toBe(1);
      tick(1);
      expect(service.toasts().length).toBe(0);
    }));
  });

  // ── info() ────────────────────────────────────────────────────────────────

  describe('info()', () => {
    it('agrega toast de tipo info', () => {
      service.info('Información');
      expect(service.toasts()[0].type).toBe('info');
    });
  });

  // ── warning() ────────────────────────────────────────────────────────────

  describe('warning()', () => {
    it('agrega toast de tipo warning', () => {
      service.warning('Advertencia');
      expect(service.toasts()[0].type).toBe('warning');
    });
  });

  // ── remove() ─────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('elimina un toast por id', () => {
      service.show('A');
      service.show('B');
      const id = service.toasts()[0].id;
      service.remove(id);
      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].message).toBe('B');
    });

    it('no falla si el id no existe', () => {
      service.show('existe');
      expect(() => service.remove('id-inexistente')).not.toThrow();
      expect(service.toasts().length).toBe(1);
    });

    it('puede vaciar todos los toasts removiéndolos uno a uno', () => {
      service.show('A');
      service.show('B');
      const ids = service.toasts().map(t => t.id);
      ids.forEach(id => service.remove(id));
      expect(service.toasts().length).toBe(0);
    });
  });

});
