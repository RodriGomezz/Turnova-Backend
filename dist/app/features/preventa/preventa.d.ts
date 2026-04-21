import { OnDestroy, OnInit } from '@angular/core';
export declare class Preventa implements OnInit, OnDestroy {
    private readonly seo;
    private readonly launchDate;
    private timerId;
    protected readonly countdown: any;
    protected readonly launchReached: any;
    protected readonly chips: string[];
    protected readonly countdownUnits: any;
    ngOnInit(): void;
    ngOnDestroy(): void;
    private updateCountdown;
    private pad;
}
//# sourceMappingURL=preventa.d.ts.map