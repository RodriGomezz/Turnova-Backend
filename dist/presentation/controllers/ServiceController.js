"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceController = void 0;
const errors_1 = require("../../domain/errors");
class ServiceController {
    constructor(serviceRepository, createServiceUseCase) {
        this.serviceRepository = serviceRepository;
        this.createServiceUseCase = createServiceUseCase;
        this.list = async (req, res, next) => {
            try {
                const services = await this.serviceRepository.findByBusiness(req.businessId);
                res.json({ services });
            }
            catch (error) {
                next(error);
            }
        };
        this.listDefaults = async (req, res, next) => {
            try {
                const tipoNegocio = req.query["tipo_negocio"];
                const defaults = await this.serviceRepository.listDefaults(tipoNegocio);
                res.json({ defaults });
            }
            catch (error) {
                next(error);
            }
        };
        this.create = async (req, res, next) => {
            try {
                const input = req.body;
                const service = await this.createServiceUseCase.execute({
                    ...input,
                    business_id: req.businessId,
                });
                res.status(201).json({ service });
            }
            catch (error) {
                next(error);
            }
        };
        this.update = async (req, res, next) => {
            try {
                const id = req.params["id"];
                const input = req.body;
                const existing = await this.serviceRepository.findById(id);
                if (!existing)
                    throw new errors_1.NotFoundError("Servicio");
                if (existing.business_id !== req.businessId)
                    throw new errors_1.ForbiddenError();
                const service = await this.serviceRepository.update(id, input);
                res.json({ service });
            }
            catch (error) {
                next(error);
            }
        };
        this.delete = async (req, res, next) => {
            try {
                const id = req.params["id"];
                const existing = await this.serviceRepository.findById(id);
                if (!existing)
                    throw new errors_1.NotFoundError("Servicio");
                if (existing.business_id !== req.businessId)
                    throw new errors_1.ForbiddenError();
                await this.serviceRepository.deactivate(id);
                res.json({ message: "Servicio desactivado correctamente" });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.ServiceController = ServiceController;
//# sourceMappingURL=ServiceController.js.map