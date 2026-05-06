import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Toast } from '../../services/notification.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
})
export class ToastComponent {
  notificationService = inject(NotificationService);
  toasts = this.notificationService.toasts;

  remove(id: number) {
    this.notificationService.remove(id);
  }

  getIcon(type: Toast['type']): string {
    switch (type) {
      case 'success':
        return 'fa-check-circle';
      case 'error':
        return 'fa-circle-xmark';
      case 'warning':
        return 'fa-triangle-exclamation';
      default:
        return 'fa-circle-info';
    }
  }

  getColorClass(type: Toast['type']): string {
    switch (type) {
      case 'success':
        return 'border-emerald-500/35 ring-1 ring-emerald-500/15';
      case 'error':
        return 'border-red-500/40 ring-1 ring-red-500/15';
      case 'warning':
        return 'border-amber-500/40 ring-1 ring-amber-500/15';
      default:
        return 'border-accent-500/35 ring-1 ring-accent-500/15';
    }
  }

  getIconColorClass(type: Toast['type']): string {
    switch (type) {
      case 'success':
        return 'text-emerald-400';
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-amber-400';
      default:
        return 'text-accent-400';
    }
  }
}
