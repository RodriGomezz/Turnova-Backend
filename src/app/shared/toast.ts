import { Component } from '@angular/core';
import { ToastService, Toast } from '../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}

  trackById(_: number, toast: Toast): string {
    return toast.id;
  }
}