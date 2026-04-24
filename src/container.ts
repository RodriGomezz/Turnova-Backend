/**
 * Composition Root
 *
 * Único lugar de la aplicación donde se instancian dependencias concretas.
 * Los controladores y use cases reciben interfaces — solo aquí saben qué
 * implementación concreta se usa.
 *
 * Principios aplicados:
 *  - DIP: las capas internas dependen de abstracciones, no de implementaciones
 *  - SRP: cada clase tiene una sola razón para cambiar
 *  - OCP: agregar una implementación alternativa no requiere tocar use cases ni controllers
 */

// ── Infraestructura ───────────────────────────────────────────────────────────
import { BookingRepository } from "./infrastructure/database/BookingRepository";
import { BusinessRepository } from "./infrastructure/database/BusinessRepository";
import { BarberRepository } from "./infrastructure/database/BarberRepository"; // refactorizado
import { ServiceRepository } from "./infrastructure/database/ServiceRepository";
import { ScheduleRepository } from "./infrastructure/database/ScheduleRepository"; // refactorizado
import { BlockedDateRepository } from "./infrastructure/database/BlockedDateRepository";
import { UserRepository } from "./infrastructure/database/UserRepository";
import { UserBusinessAccessRepository } from "./infrastructure/database/UserBusinessAccessRepository";
import { SubscriptionRepository } from "./infrastructure/database/SubscriptionRepository";
import { EmailService } from "./application/email/email.service";
import { dlocalClient } from "./infrastructure/payments/dlocal.client";

// ── Use Cases ─────────────────────────────────────────────────────────────────
import { GetAvailableSlotsUseCase } from "./application/bookings/GetAvailableSlotsUseCase";
import { CreateBookingUseCase } from "./application/bookings/CreateBookingUseCase";
import { GetDaySummaryUseCase } from "./application/bookings/GetDaySummaryUseCase";
import { GetAvailableDaysUseCase } from "./application/bookings/GetAvailableDaysUseCase";
import { CreateBusinessUseCase } from "./application/businesses/CreateBusinessUseCase";
import { CreateBarberUseCase } from "./application/barbers/CreateBarberUseCase";
import { CreateSubscriptionUseCase } from "./application/subscriptions/CreateSubscriptionUseCase";
import { HandleWebhookUseCase } from "./application/subscriptions/HandleWebhookUseCase";
import { CreateServiceUseCase } from "./application/services/CreateServiceUseCase";

// ── Controllers ───────────────────────────────────────────────────────────────
import { BookingController } from "./presentation/controllers/BookingController";
import { BusinessController } from "./presentation/controllers/BusinessController";
import { ScheduleController } from "./presentation/controllers/ScheduleController";
import { ServiceController } from "./presentation/controllers/ServiceController";
import { SubscriptionController } from "./presentation/controllers/SubscriptionController";
import { WebhookController } from "./presentation/controllers/WebhookController";

// ─────────────────────────────────────────────────────────────────────────────
// Repositories (singletons — una instancia por proceso)
// ─────────────────────────────────────────────────────────────────────────────

const bookingRepository = new BookingRepository();
const businessRepository = new BusinessRepository();
const barberRepository = new BarberRepository();
const serviceRepository = new ServiceRepository();
const scheduleRepository = new ScheduleRepository();
const blockedDateRepository = new BlockedDateRepository();
const userRepository = new UserRepository();
const userBusinessAccessRepository = new UserBusinessAccessRepository();
const subscriptionRepository = new SubscriptionRepository();
const emailService = new EmailService();

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
  dlocalClient,
);

const handleWebhookUseCase = new HandleWebhookUseCase(
  subscriptionRepository,
  businessRepository,
  emailService,
  dlocalClient,
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
  dlocalClient,
  createSubscriptionUseCase,
  userRepository,
  businessRepository,
);

export const webhookController = new WebhookController(
  handleWebhookUseCase,
);