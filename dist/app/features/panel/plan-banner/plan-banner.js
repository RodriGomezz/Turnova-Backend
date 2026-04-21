"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanBanner = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const business_status_service_1 = require("../../../core/services/business-status.service");
let PlanBanner = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-plan-banner',
            standalone: true,
            template: `
    @if (banner().type) {
      <div class="plan-banner" [class]="'plan-banner--' + banner().type">
        <span class="plan-banner__msg">{{ banner().message }}</span>
        <button class="plan-banner__cta" (click)="goToPlanes()">
          Ver planes
        </button>
      </div>
    }
  `,
            styles: [`
    .plan-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.625rem 1.5rem;
      font-size: 0.85rem;
      flex-wrap: wrap;
    }
    .plan-banner--info    { background: #dbeafe; color: #1e40af; }
    .plan-banner--warning { background: #fef3c7; color: #92400e; }
    .plan-banner--danger  { background: #fee2e2; color: #991b1b; }

    .plan-banner__cta {
      white-space: nowrap;
      padding: 0.3rem 0.875rem;
      border-radius: 6px;
      border: 1px solid currentColor;
      background: transparent;
      color: inherit;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      opacity: 0.85;
    }
    .plan-banner__cta:hover { opacity: 1; }
  `],
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var PlanBanner = _classThis = class {
        constructor() {
            this.statusService = (0, core_1.inject)(business_status_service_1.BusinessStatusService);
            this.router = (0, core_1.inject)(router_1.Router);
            this.banner = (0, core_1.computed)(() => this.statusService.bannerInfo());
        }
        goToPlanes() {
            this.router.navigate(['/panel/configuracion'], {
                queryParams: { tab: 'planes' },
            });
        }
    };
    __setFunctionName(_classThis, "PlanBanner");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PlanBanner = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PlanBanner = _classThis;
})();
exports.PlanBanner = PlanBanner;
//# sourceMappingURL=plan-banner.js.map