import { Pipe, PipeTransform } from '@angular/core';

export interface DeadlineStatus {
  text: string;
  colorClass: string;
  urgency: 'overdue' | 'urgent' | 'soon' | 'normal';
}

@Pipe({
  name: 'deadlineAlert',
  standalone: true,
})
export class DeadlineAlertPipe implements PipeTransform {
  transform(deadline: string | Date | undefined): DeadlineStatus | null {
    if (!deadline) return null;

    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffMs < 0) {
      return {
        text: 'Overdue',
        colorClass:
          'bg-rose-100 text-rose-900 ring-1 ring-rose-300 shadow-sm dark:bg-rose-500/90 dark:text-white dark:ring-rose-400/40 dark:shadow-[0_0_16px_-4px_rgba(244,63,94,0.5)]',
        urgency: 'overdue',
      };
    }

    if (diffHours < 24) {
      const hours = Math.floor(diffHours);
      const mins = Math.floor((diffHours % 1) * 60);
      return {
        text: hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`,
        colorClass:
          'bg-amber-100 text-amber-950 ring-1 ring-amber-300 animate-pulse dark:bg-amber-500/90 dark:text-zinc-950 dark:ring-amber-400/40',
        urgency: 'urgent',
      };
    }

    if (diffHours < 72) {
      const days = Math.floor(diffHours / 24);
      return {
        text: `${days}d left`,
        colorClass:
          'bg-amber-50 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-400/25 dark:text-amber-200 dark:ring-amber-400/25',
        urgency: 'soon',
      };
    }

    return {
      text: 'On track',
      colorClass:
        'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-400/25',
      urgency: 'normal',
    };
  }
}
