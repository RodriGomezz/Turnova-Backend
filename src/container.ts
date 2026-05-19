/**
 * Composition Root
 *
 * Único lugar de la aplicación donde se instancian dependencias concretas.
 * Los controladores y use cases reciben interfaces — solo aquí saben qué
 * implementación concreta se usa.
 *
 * PROVEEDOR DE PAGOS ACTIVO: MercadoPago
 * Para reactivar dLocal Go:
 *   1. Cambiar `mercadoPagoClient` → `dlocalGoClient` en las líneas marcadas
 *   2. Descomentar la ruta /dlocal en subscription.routes.ts
 *   3. Descomentar el middleware raw body en app.ts
 */

// ── Infraestructura ───────────────────────────────────────────────────────────
import { BookingRepository } from "./infrastructure/database/BookingRepository";
import { BusinessRepository } from "./infrastructure/database/BusinessRepository";
import { BarberRepository } from "./infrastructure/database/BarberRepository";
import { ServiceRepository } from "./infrastructure/database/ServiceRepository";
import { ScheduleRepository } from "./infrastructure/database/ScheduleRepository";
import { BlockedDateRepository } from "./infrastructure/database/BlockedDateRepository";
import { UserRepository } from "./infrastructure/database/UserRepository";
import { UserBusinessAccessRepository } from "./infrastructure/database/UserBusinessAccessRepository";
import { SubscriptionRepository } from "./infrastructure/database/SubscriptionRepository";
import { EmailService } from "./application/email/email.service";

// ── Proveedores de pago ───────────────────────────────────────────────────────
// ACTIVO: MercadoPago
import { mercadoPagoClient } from "./infrastructure/payments/mercadopago.cliente";
// DESACTIVADO: dLocal Go (mantener import para reactivar rápidamente)
import { dlocalGoClient as _dlocalGoClient } from "./infrastructure/payments/dlocalgo.client";

// El proveedor activo — cambiar aquí para switchar entre proveedores
const activePaymentProvider = mercadoPagoClient;

// ── Use Cases ─────────────────────────────────────────────────────────────────
import { GetAvailableSlotsUseCase } from "./application/bookings/GetAvailableSlotsUseCase";
import { CreateBookingUseCase } from "./application/bookings/CreateBookingUseCase";
import { GetDaySummaryUseCase } from "./application/bookings/GetDaySummaryUseCase";
import { GetAvailableDaysUseCase } from "./application/bookings/GetAvailableDaysUseCase";
import { CreateBusinessUseCase } from "./application/businesses/CreateBusinessUseCase";
import { CreateBarberUseCase } from "./application/barbers/CreateBarberUseCase";
import { CreateSubscriptionUseCase } from "./application/subscriptions/CreateSubscriptionUseCase";
import { HandleWebhookUseCase } from "./application/subscriptions/HandleWebhookUseCase";
import { HandleMPWebhookUseCase } from "./application/subscriptions/Handlempwebhookusecase";
import { CreateServiceUseCase } from "./application/services/CreateServiceUseCase";

// ── Controllers ───────────────────────────────────────────────────────────────
import { BookingController } from "./presentation/controllers/BookingController";
import { BusinessController } from "./presentation/controllers/BusinessController";
import { ScheduleController } from "./presentation/controllers/ScheduleController";
import { ServiceController } from "./presentation/controllers/ServiceController";
import { SubscriptionController } from "./presentation/controllers/SubscriptionController";
import { WebhookController } from "./presentation/controllers/WebhookController";

// ─────────────────────────────────────────────────────────────────────────────
// Repositories (singletons)
// ─────────────────────────────────────────────────────────────────────────────

const bookingRepository           = new BookingRepository();
const businessRepository          = new BusinessRepository();
const barberRepository            = new BarberRepository();
const serviceRepository           = new ServiceRepository();
const scheduleRepository          = new ScheduleRepository();
const blockedDateRepository       = new BlockedDateRepository();
const userRepository              = new UserRepository();
const userBusinessAccessRepository= new UserBusinessAccessRepository();
const subscriptionRepository      = new SubscriptionRepository();
const emailService                = new EmailService();

// ─────────────────────────────────────────────────────────────────────────────
// Use Cases
// ─────────────────────────────────────────────────────────────────────────────

const getAvailableSlotsUseCase = new GetAvailableSlotsUseCase(
  bookingRepository,
  scheduleRepository,
  blockedDateRepository,
);

const createBookingUseCase = new CreateBookingUseCase(
  bookingRepository,
  getAvailableSlotsUseCase,
);

const getDaySummaryUseCase = new GetDaySummaryUseCase(
  bookingRepository,
  scheduleRepository,
  blockedDateRepository,
  barberRepository,
  businessRepository,
);

const getAvailableDaysUseCase = new GetAvailableDaysUseCase(
  businessRepository,
  serviceRepository,
  scheduleRepository,
  blockedDateRepository,
  bookingRepository,
);

export const createBusinessUseCase = new CreateBusinessUseCase(
  businessRepository,
  userRepository,
);

export const createBarberUseCase = new CreateBarberUseCase(barberRepository);
export const createServiceUseCase = new CreateServiceUseCase(serviceRepository);

const createSubscriptionUseCase = new CreateSubscriptionUseCase(
  subscriptionRepository,
  businessRepository,
  activePaymentProvider,   // ← MP activo
);

// HandleWebhookUseCase (dLocal) — instanciado pero la ruta está desactivada
const handleDLocalWebhookUseCase = new HandleWebhookUseCase(
  subscriptionRepository,
  businessRepository,
  emailService,
);

// HandleMPWebhookUseCase — activo
const handleMPWebhookUseCase = new HandleMPWebhookUseCase(
  subscriptionRepository,
  businessRepository,
  emailService,
);

// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────

export const bookingController = new BookingController(
  bookingRepository,
  barberRepository,
  serviceRepository,
  businessRepository,
  getAvailableSlotsUseCase,
  createBookingUseCase,
  getDaySummaryUseCase,
  getAvailableDaysUseCase,
  emailService,
);

export const businessController = new BusinessController(
  businessRepository,
  barberRepository,
  userRepository,
  userBusinessAccessRepository,
);

export const scheduleController = new ScheduleController(
  scheduleRepository,
  blockedDateRepository,
);

export const serviceController = new ServiceController(
  serviceRepository,
  createServiceUseCase,
);

export const subscriptionController = new SubscriptionController(
  subscriptionRepository,
  activePaymentProvider,   // ← MP activo
  createSubscriptionUseCase,
  userRepository,
  businessRepository,
);

export const webhookController = new WebhookController(
  handleDLocalWebhookUseCase,   // dLocal preservado
  handleMPWebhookUseCase,       // MP activo
);