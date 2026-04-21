"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleController = void 0;
const errors_1 = require("../../domain/errors");
class ScheduleController {
    constructor(scheduleRepository, blockedDateRepository) {
        this.scheduleRepository = scheduleRepository;
        this.blockedDateRepository = blockedDateRepository;
        // ── Horarios ──────────────────────────────────────────────────────────────
        this.listSchedules = async (req, res, next) => {
            try {
                const schedules = await this.scheduleRepository.findAllByBusiness(req.businessId);
                res.json({ schedules });
            }
            catch (error) {
                next(error);
            }
        };
        this.createSchedule = async (req, res, next) => {
            try {
                const input = req.body;
                const schedule = await this.scheduleRepository.create({
                    dia_semana: input.dia_semana,
                    hora_inicio: input.hora_inicio,
                    hora_fin: input.hora_fin,
                    barber_id: input.barber_id ?? null,
                    business_id: req.businessId,
                    activo: true,
                });
                res.status(201).json({ schedule });
            }
            catch (error) {
                next(error);
            }
        };
        this.updateSchedule = async (req, res, next) => {
            try {
                const id = req.params["id"];
                const input = req.body;
                const existing = await this.scheduleRepository.findById(id);
                if (!existing)
                    throw new errors_1.NotFoundError("Horario");
                if (existing.business_id !== req.businessId)
                    throw new errors_1.ForbiddenError();
                const schedule = await this.scheduleRepository.update(id, input);
                res.json({ schedule });
            }
            catch (error) {
                next(error);
            }
        };
        this.deleteSchedule = async (req, res, next) => {
            try {
                const id = req.params["id"];
                const existing = await this.scheduleRepository.findById(id);
                if (!existing)
                    throw new errors_1.NotFoundError("Horario");
                if (existing.business_id !== req.businessId)
                    throw new errors_1.ForbiddenError();
                await this.scheduleRepository.delete(id);
                res.json({ message: "Horario eliminado correctamente" });
            }
            catch (error) {
                next(error);
            }
        };
        // ── Fechas bloqueadas ─────────────────────────────────────────────────────
        this.listBlockedDates = async (req, res, next) => {
            try {
                const blockedDates = await this.blockedDateRepository.findByBusiness(req.businessId);
                res.json({ blockedDates });
            }
            catch (error) {
                next(error);
            }
        };
        this.createBlockedDate = async (req, res, next) => {
            try {
                const input = req.body;
                const blockedDate = await this.blockedDateRepository.create({
                    fecha: input.fecha,
                    fecha_fin: input.fecha_fin ?? null,
                    motivo: input.motivo ?? null,
                    barber_id: input.barber_id ?? null,
                    business_id: req.businessId,
                });
                res.status(201).json({ blockedDate });
            }
            catch (error) {
                next(error);
            }
        };
        this.deleteBlockedDate = async (req, res, next) => {
            try {
                const id = req.params["id"];
                const blockedDates = await this.blockedDateRepository.findByBusiness(req.businessId);
                const existing = blockedDates.find((b) => b.id === id);
                if (!existing)
                    throw new errors_1.NotFoundError("Fecha bloqueada");
                if (existing.business_id !== req.businessId)
                    throw new errors_1.ForbiddenError();
                await this.blockedDateRepository.delete(id);
                res.json({ message: "Fecha desbloqueada correctamente" });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.ScheduleController = ScheduleController;
//# sourceMappingURL=ScheduleController.js.map