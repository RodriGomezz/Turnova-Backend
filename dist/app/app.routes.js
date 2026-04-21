"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.routes = void 0;
const core_1 = require("@angular/core");
const auth_guard_1 = require("./core/guards/auth.guard");
const trial_expired_guard_1 = require("./core/guards/trial-expired.guard");
const subdomain_service_1 = require("./core/services/subdomain.service");
exports.routes = [
    // ── Rutas de subdominio ───────────────────────────────────────────────────
    {
        path: '',
        canMatch: [() => (0, core_1.inject)(subdomain_service_1.SubdomainService).isSubdomain()],
        loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/public/home/public-home'))).then((m) => m.PublicHome),
    },
    {
        path: 'reservar',
        canMatch: [() => (0, core_1.inject)(subdomain_service_1.SubdomainService).isSubdomain()],
        loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/public/booking/booking'))).then((m) => m.Booking),
    },
    {
        path: 'cancelar/:token',
        canMatch: [() => (0, core_1.inject)(subdomain_service_1.SubdomainService).isSubdomain()],
        loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/public/cancel/cancel'))).then((m) => m.Cancel),
    },
    {
        path: 'confirmar',
        canMatch: [() => (0, core_1.inject)(subdomain_service_1.SubdomainService).isSubdomain()],
        loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/public/confirm/confirm'))).then((m) => m.Confirm),
    },
    // ── Rutas del dominio raíz ────────────────────────────────────────────────
    {
        path: '',
        loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/preventa/preventa'))).then((m) => m.Preventa),
    },
    {
        path: 'fundadores',
        loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/preventa-fundadores/preventa-fundadores'))).then((m) => m.PreventaFundadores),
    },
    {
        path: 'landing',
        loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/landing/landing'))).then((m) => m.Landing),
    },
    {
        path: 'login',
        loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/auth/login/login'))).then((m) => m.Login),
    },
    {
        path: 'registro',
        loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/auth/register/register'))).then((m) => m.Register),
    },
    {
        path: 'recuperar-contrasena',
        loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/auth/forgot-password/forgot-password'))).then((m) => m.ForgotPassword),
    },
    {
        path: 'reset-password',
        loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/auth/reset-password/reset-password'))).then((m) => m.ResetPassword),
    },
    // ── Panel (requiere auth) ─────────────────────────────────────────────────
    {
        path: 'panel',
        canActivate: [auth_guard_1.authGuard],
        canActivateChild: [auth_guard_1.authGuard],
        loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/panel/panel'))).then((m) => m.Panel),
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            {
                path: 'dashboard',
                loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/panel/dashboard/dashboard'))).then((m) => m.Dashboard),
            },
            {
                path: 'reservas',
                loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/panel/bookings/bookings'))).then((m) => m.Bookings),
            },
            {
                path: 'barberos',
                loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/panel/barbers/barbers'))).then((m) => m.Barbers),
            },
            {
                path: 'servicios',
                loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/panel/services/services'))).then((m) => m.Services),
            },
            {
                path: 'horarios',
                loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/panel/schedules/schedules'))).then((m) => m.Schedules),
            },
            {
                path: 'configuracion',
                loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/panel/config/config'))).then((m) => m.Config),
            },
            {
                path: 'estadisticas',
                // Reemplaza proGuard por proRequiredGuard que también verifica trial
                canActivate: [trial_expired_guard_1.proRequiredGuard],
                loadComponent: () => Promise.resolve().then(() => __importStar(require('./features/panel/stats/stats'))).then((m) => m.Stats),
            },
        ],
    },
    { path: '**', redirectTo: '' },
];
//# sourceMappingURL=app.routes.js.map