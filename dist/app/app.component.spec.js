"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@angular/core/testing");
const app_1 = require("./app");
const testing_2 = require("@angular/router/testing");
describe('AppComponent', () => {
    beforeEach(async () => {
        await testing_1.TestBed.configureTestingModule({
            imports: [app_1.AppComponent, testing_2.RouterTestingModule],
        }).compileComponents();
    });
    it('debería crearse correctamente', () => {
        const fixture = testing_1.TestBed.createComponent(app_1.AppComponent);
        expect(fixture.componentInstance).toBeTruthy();
    });
});
//# sourceMappingURL=app.component.spec.js.map