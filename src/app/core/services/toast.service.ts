import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(
    message: string,
    type: Toast['type'] = 'success',
    duration = 3500,
  ): void {
    const id = crypto.randomUUID();
    this._toasts.update((t) => [...t, { id, message, type }]);
    setTimeout(() => this.remove(id), duration);
  }

  success(message: string): void {
    this.show(message, 'success');
  }
  error(message: string): void {
    this.show(message, 'error', 5000);
  }
  info(message: string): void {
    this.show(message, 'info');
  }
  warning(message: string): void {
    this.show(message, 'warning');
  }

  remove(id: string): void {
    this._toasts.update((t) => t.filter((toast) => toast.id !== id));
  }
}
