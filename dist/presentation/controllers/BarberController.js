"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BarberController = void 0;
const BarberRepository_1 = require("../../infrastructure/database/BarberRepository");
const CreateBarberUseCase_1 = require("../../application/barbers/CreateBarberUseCase");
const ListBarbersUseCase_1 = require("../../application/barbers/ListBarbersUseCase");
const BusinessRepository_1 = require("../../infrastructure/database/BusinessRepository");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const plan_limits_1 = require("../../domain/plan-limits");
class BarberController {
    constructor() {
        this.list = async (req, res, next) => {
            try {
                const barbers = await this.listBarbersUseCase.execute(req.businessId);
                res.json({ barbers });
            }
            catch (error) {
                next(error);
            }
        };
        this.create = async (req, res, next) => {
            try {
                const input = req.body;
                const business = await this.businessRepository.findById(req.businessId);
                if (!business)
                    throw new errorHandler_middleware_1.AppError("Negocio no encontrado", 404);
                const trialActivo = business.trial_ends_at
                    ? new Date(business.trial_ends_at) > new Date()
                    : false;
                const limits = (0, plan_limits_1.getPlanLimits)(business.plan, trialActivo);
                const count = await this.barberRepository.countByBusiness(req.businessId);
                if (count >= limits.maxBarberos) {
                    throw new errorHandler_middleware_1.AppError(`Tu plan ${business.plan} permite hasta ${limits.maxBarberos} ${limits.maxBarberos === 1 ? "profesional" : "profesionales"}. Actualizá tu plan para agregar más.`, 403);
                }
                const barber = await this.createBarberUseCase.execute({
                    ...input,
                    business_id: req.businessId,
                });
                res.status(201).json({ barber });
            }
            catch (error) {
                next(error);
            }
        };
        this.update = async (req, res, next) => {
            try {
                const id = req.params["id"];
                const input = req.body;
                const existing = await this.barberRepository.findById(id);
                if (!existing)
                    throw new errorHandler_middleware_1.NotFoundError("Profesional");
                if (existing.business_id !== req.businessId)
                    throw new errorHandler_middleware_1.ForbiddenError();
                const barber = await this.barberRepository.update(id, input);
                res.json({ barber });
            }
            catch (error) {
                next(error);
            }
        };
        this.delete = async (req, res, next) => {
            try {
                const id = req.params["id"];
                const existing = await this.barberRepository.findById(id);
                if (!existing)
                    throw new errorHandler_middleware_1.NotFoundError("Profesional");
                if (existing.business_id !== req.businessId)
                    throw new errorHandler_middleware_1.ForbiddenError();
                await this.barberRepository.deactivate(id);
                res.json({ message: "Profesional desactivado correctamente" });
            }
            catch (error) {
                next(error);
            }
        };
        this.barberRepository = new BarberRepository_1.BarberRepository();
        this.businessRepository = new BusinessRepository_1.BusinessRepository();
        this.createBarberUseCase = new CreateBarberUseCase_1.CreateBarberUseCase(this.barberRepository);
        this.listBarbersUseCase = new ListBarbersUseCase_1.ListBarbersUseCase(this.barberRepository);
    }
}
exports.BarberController = BarberController;
//# sourceMappingURL=BarberController.js.map