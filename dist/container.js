"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookController = exports.subscriptionController = exports.serviceController = exports.scheduleController = exports.businessController = exports.bookingController = exports.createServiceUseCase = exports.createBarberUseCase = exports.createBusinessUseCase = void 0;
// ── Infraestructura ───────────────────────────────────────────────────────────
const BookingRepository_1 = require("./infrastructure/database/BookingRepository");
const BusinessRepository_1 = require("./infrastructure/database/BusinessRepository");
const BarberRepository_1 = require("./infrastructure/database/BarberRepository"); // refactorizado
const ServiceRepository_1 = require("./infrastructure/database/ServiceRepository");
const ScheduleRepository_1 = require("./infrastructure/database/ScheduleRepository"); // refactorizado
const BlockedDateRepository_1 = require("./infrastructure/database/BlockedDateRepository");
const UserRepository_1 = require("./infrastructure/database/UserRepository");
const UserBusinessAccessRepository_1 = require("./infrastructure/database/UserBusinessAccessRepository");
const SubscriptionRepository_1 = require("./infrastructure/database/SubscriptionRepository");
const email_service_1 = require("./application/email/email.service");
const dlocal_client_1 = require("./infrastructure/payments/dlocal.client");
// ── Use Cases ─────────────────────────────────────────────────────────────────
const GetAvailableSlotsUseCase_1 = require("./application/bookings/GetAvailableSlotsUseCase");
const CreateBookingUseCase_1 = require("./application/bookings/CreateBookingUseCase");
const GetDaySummaryUseCase_1 = require("./application/bookings/GetDaySummaryUseCase");
const GetAvailableDaysUseCase_1 = require("./application/bookings/GetAvailableDaysUseCase");
const CreateBusinessUseCase_1 = require("./application/businesses/CreateBusinessUseCase");
const CreateBarberUseCase_1 = require("./application/barbers/CreateBarberUseCase");
const CreateSubscriptionUseCase_1 = require("./application/subscriptions/CreateSubscriptionUseCase");
const HandleWebhookUseCase_1 = require("./application/subscriptions/HandleWebhookUseCase");
const CreateServiceUseCase_1 = require("./application/services/CreateServiceUseCase");
// ── Controllers ───────────────────────────────────────────────────────────────
const BookingController_1 = require("./presentation/controllers/BookingController");
const BusinessController_1 = require("./presentation/controllers/BusinessController");
const ScheduleController_1 = require("./presentation/controllers/ScheduleController");
const ServiceController_1 = require("./presentation/controllers/ServiceController");
const SubscriptionController_1 = require("./presentation/controllers/SubscriptionController");
const WebhookController_1 = require("./presentation/controllers/WebhookController");
// ─────────────────────────────────────────────────────────────────────────────
// Repositories (singletons — una instancia por proceso)
// ─────────────────────────────────────────────────────────────────────────────
const bookingRepository = new BookingRepository_1.BookingRepository();
const businessRepository = new BusinessRepository_1.BusinessRepository();
const barberRepository = new BarberRepository_1.BarberRepository();
const serviceRepository = new ServiceRepository_1.ServiceRepository();
const scheduleRepository = new ScheduleRepository_1.ScheduleRepository();
const blockedDateRepository = new BlockedDateRepository_1.BlockedDateRepository();
const userRepository = new UserRepository_1.UserRepository();
const userBusinessAccessRepository = new UserBusinessAccessRepository_1.UserBusinessAccessRepository();
const subscriptionRepository = new SubscriptionRepository_1.SubscriptionRepository();
const emailService = new email_service_1.EmailService();
// ─────────────────────────────────────────────────────────────────────────────
// Use Cases
// ─────────────────────────────────────────────────────────────────────────────
const getAvailableSlotsUseCase = new GetAvailableSlotsUseCase_1.GetAvailableSlotsUseCase(bookingRepository, scheduleRepository, blockedDateRepository);
const createBookingUseCase = new CreateBookingUseCase_1.CreateBookingUseCase(bookingRepository, getAvailableSlotsUseCase);
const getDaySummaryUseCase = new GetDaySummaryUseCase_1.GetDaySummaryUseCase(bookingRepository, scheduleRepository, blockedDateRepository, barberRepository, businessRepository);
const getAvailableDaysUseCase = new GetAvailableDaysUseCase_1.GetAvailableDaysUseCase(businessRepository, serviceRepository, scheduleRepository, blockedDateRepository, bookingRepository);
exports.createBusinessUseCase = new CreateBusinessUseCase_1.CreateBusinessUseCase(businessRepository, userRepository);
exports.createBarberUseCase = new CreateBarberUseCase_1.CreateBarberUseCase(barberRepository);
exports.createServiceUseCase = new CreateServiceUseCase_1.CreateServiceUseCase(serviceRepository);
const createSubscriptionUseCase = new CreateSubscriptionUseCase_1.CreateSubscriptionUseCase(subscriptionRepository, businessRepository, dlocal_client_1.dlocalClient);
const handleWebhookUseCase = new HandleWebhookUseCase_1.HandleWebhookUseCase(subscriptionRepository, businessRepository, emailService);
// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────
exports.bookingController = new BookingController_1.BookingController(bookingRepository, barberRepository, serviceRepository, businessRepository, getAvailableSlotsUseCase, createBookingUseCase, getDaySummaryUseCase, getAvailableDaysUseCase, emailService);
exports.businessController = new BusinessController_1.BusinessController(businessRepository, barberRepository, userRepository, userBusinessAccessRepository);
exports.scheduleController = new ScheduleController_1.ScheduleController(scheduleRepository, blockedDateRepository);
exports.serviceController = new ServiceController_1.ServiceController(serviceRepository, exports.createServiceUseCase);
exports.subscriptionController = new SubscriptionController_1.SubscriptionController(subscriptionRepository, dlocal_client_1.dlocalClient, createSubscriptionUseCase, userRepository, businessRepository);
exports.webhookController = new WebhookController_1.WebhookController(handleWebhookUseCase);
//# sourceMappingURL=container.js.map