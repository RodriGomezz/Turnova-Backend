export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}
export declare class ToastService {
    private readonly _toasts;
    readonly toasts: any;
    show(message: string, type?: Toast['type'], duration?: number): void;
    success(message: string): void;
    error(message: string): void;
    info(message: string): void;
    warning(message: string): void;
    remove(id: string): void;
}
//# sourceMappingURL=toast.service.d.ts.map