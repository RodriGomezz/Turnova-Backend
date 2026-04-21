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
import { CreateBusinessUseCase } from "./application/businesses/CreateBusinessUseCase";
import { CreateBarberUseCase } from "./application/barbers/CreateBarberUseCase";
import { CreateServiceUseCase } from "./application/services/CreateServiceUseCase";
import { BookingController } from "./presentation/controllers/BookingController";
import { BusinessController } from "./presentation/controllers/BusinessController";
import { ScheduleController } from "./presentation/controllers/ScheduleController";
import { ServiceController } from "./presentation/controllers/ServiceController";
import { SubscriptionController } from "./presentation/controllers/SubscriptionController";
import { WebhookController } from "./presentation/controllers/WebhookController";
export declare const createBusinessUseCase: CreateBusinessUseCase;
export declare const createBarberUseCase: CreateBarberUseCase;
export declare const createServiceUseCase: CreateServiceUseCase;
export declare const bookingController: BookingController;
export declare const businessController: BusinessController;
export declare const scheduleController: ScheduleController;
export declare const serviceController: ServiceController;
export declare const subscriptionController: SubscriptionController;
export declare const webhookController: WebhookController;
//# sourceMappingURL=container.d.ts.map