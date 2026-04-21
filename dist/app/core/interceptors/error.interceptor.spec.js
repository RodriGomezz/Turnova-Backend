"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@angular/core/testing");
const testing_2 = require("@angular/common/http/testing");
const http_1 = require("@angular/common/http");
const error_interceptor_1 = require("./error.interceptor");
const toast_service_1 = require("../services/toast.service");
const testing_3 = require("@angular/common/http/testing");
describe('errorInterceptor', () => {
    let http;
    let httpController;
    let toastSpy;
    const TEST_URL = 'https://api.test.com/endpoint';
    beforeEach(() => {
        toastSpy = jasmine.createSpyObj('ToastService', ['error', 'success', 'info', 'warning']);
        testing_1.TestBed.configureTestingModule({
            providers: [
                (0, http_1.provideHttpClient)((0, http_1.withInterceptors)([error_interceptor_1.errorInterceptor])),
                (0, testing_3.provideHttpClientTesting)(),
                { provide: toast_service_1.ToastService, useValue: toastSpy },
            ],
        });
        http = testing_1.TestBed.inject(http_1.HttpClient);
        httpController = testing_1.TestBed.inject(testing_2.HttpTestingController);
    });
    afterEach(() => httpController.verify());
    // ── Pasa requests exitosos sin tocar ──────────────────────────────────────
    it('no llama a toastService en respuestas exitosas (200)', () => {
        http.get(TEST_URL).subscribe();
        httpController.expectOne(TEST_URL).flush({ ok: true });
        expect(toastSpy.error).not.toHaveBeenCalled();
    });
    // ── 401 — responsabilidad del authInterceptor ─────────────────────────────
    it('no muestra toast para errores 401', () => {
        http.get(TEST_URL).subscribe({ error: () => { } });
        httpController.expectOne(TEST_URL).flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
        expect(toastSpy.error).not.toHaveBeenCalled();
    });
    // ── Mensajes por defecto según código HTTP ────────────────────────────────
    it('muestra mensaje para error 400', () => {
        http.get(TEST_URL).subscribe({ error: () => { } });
        httpController.expectOne(TEST_URL).flush({}, { status: 400, statusText: 'Bad Request' });
        expect(toastSpy.error).toHaveBeenCalledWith('Solicitud inválida.');
    });
    it('muestra mensaje para error 403', () => {
        http.get(TEST_URL).subscribe({ error: () => { } });
        httpController.expectOne(TEST_URL).flush({}, { status: 403, statusText: 'Forbidden' });
        expect(toastSpy.error).toHaveBeenCalledWith('No tenés permiso para realizar esta acción.');
    });
    it('muestra mensaje para error 404', () => {
        http.get(TEST_URL).subscribe({ error: () => { } });
        httpController.expectOne(TEST_URL).flush({}, { status: 404, statusText: 'Not Found' });
        expect(toastSpy.error).toHaveBeenCalledWith('El recurso solicitado no existe.');
    });
    it('muestra mensaje para error 422', () => {
        http.get(TEST_URL).subscribe({ error: () => { } });
        httpController.expectOne(TEST_URL).flush({}, { status: 422, statusText: 'Unprocessable Entity' });
        expect(toastSpy.error).toHaveBeenCalledWith('Los datos enviados no son válidos.');
    });
    it('muestra mensaje para error 500', () => {
        http.get(TEST_URL).subscribe({ error: () => { } });
        httpController.expectOne(TEST_URL).flush({}, { status: 500, statusText: 'Internal Server Error' });
        expect(toastSpy.error).toHaveBeenCalledWith('Error interno del servidor. Intentá de nuevo.');
    });
    it('muestra mensaje para error 503', () => {
        http.get(TEST_URL).subscribe({ error: () => { } });
        httpController.expectOne(TEST_URL).flush({}, { status: 503, statusText: 'Service Unavailable' });
        expect(toastSpy.error).toHaveBeenCalledWith('Servicio no disponible. Intentá más tarde.');
    });
    it('muestra mensaje genérico para códigos desconocidos', () => {
        http.get(TEST_URL).subscribe({ error: () => { } });
        httpController.expectOne(TEST_URL).flush({}, { status: 418, statusText: "I'm a teapot" });
        expect(toastSpy.error).toHaveBeenCalledWith('Ocurrió un error inesperado.');
    });
    // ── Mensaje del servidor tiene prioridad ──────────────────────────────────
    it('usa error.error.message del servidor si está disponible', () => {
        http.get(TEST_URL).subscribe({ error: () => { } });
        httpController.expectOne(TEST_URL).flush({ message: 'El email ya está registrado' }, { status: 400, statusText: 'Bad Request' });
        expect(toastSpy.error).toHaveBeenCalledWith('El email ya está registrado');
    });
    it('usa mensaje del servidor sobre el mensaje por defecto para 500', () => {
        http.get(TEST_URL).subscribe({ error: () => { } });
        httpController.expectOne(TEST_URL).flush({ message: 'Database connection failed' }, { status: 500, statusText: 'Server Error' });
        expect(toastSpy.error).toHaveBeenCalledWith('Database connection failed');
    });
    // ── Re-lanza el error para que el componente pueda manejarlo ─────────────
    it('re-lanza el error tras mostrar el toast', (done) => {
        http.get(TEST_URL).subscribe({
            next: () => fail('debería fallar'),
            error: (err) => {
                expect(err.status).toBe(500);
                done();
            },
        });
        httpController.expectOne(TEST_URL).flush({}, { status: 500, statusText: 'Error' });
    });
});
//# sourceMappingURL=error.interceptor.spec.js.map