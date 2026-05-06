import { Component, inject, OnInit, signal } from '@angular/core';
import { TaskService } from '../../services/task.service';
import { NgClass, DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Task } from '../../core/models/tasks.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [NgClass, DecimalPipe, RouterLink, DatePipe],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  stats = signal<any>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  overdueTasks = signal<Task[]>([]);
  recentTasks = signal<Task[]>([]);
  tasksLoading = signal<boolean>(false);

  taskService = inject(TaskService);
  auth = inject(AuthService);

  ngOnInit() {
    this.loadStats();
    this.loadTaskInsights();
  }

  loadStats() {
    this.loading.set(true);
    this.taskService.getTaskStats().subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.stats.set(response.data);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading stats:', err);
        const msg = err?.error?.message ?? err?.message;
        this.error.set(
          typeof msg === 'string' ? msg : 'Failed to load dashboard statistics'
        );
        this.loading.set(false);
      },
    });
  }

  loadTaskInsights() {
    this.tasksLoading.set(true);
    this.taskService.getAllTasks().subscribe({
      next: (response: any) => {
        const tasks: Task[] = response?.data?.tasks ?? response?.data ?? [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const overdue = tasks
          .filter(
            (t) =>
              !t.completed &&
              t.deadline &&
              new Date(t.deadline).getTime() < today.getTime()
          )
          .sort(
            (a, b) =>
              new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
          );

        const recent = [...tasks]
          .sort((a, b) => {
            const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
            const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
            return tb - ta;
          })
          .slice(0, 6);

        this.overdueTasks.set(overdue.slice(0, 8));
        this.recentTasks.set(recent);
        this.tasksLoading.set(false);
      },
      error: () => this.tasksLoading.set(false),
    });
  }

  getCompletionPercentage(): number {
    const s = this.stats();
    if (!s || s.total === 0) return 0;
    return (s.completed / s.total) * 100;
  }

  priorityRing(p: string): string {
    switch (p) {
      case 'High':
        return 'bg-rose-100 text-rose-800 ring-1 ring-rose-200 dark:bg-rose-500/90 dark:text-white dark:ring-0';
      case 'Medium':
        return 'bg-amber-100 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-400/90 dark:text-zinc-950 dark:ring-0';
      default:
        return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-600/85 dark:text-white dark:ring-0';
    }
  }

  isAdmin(): boolean {
    return this.auth.isAdmin() || this.auth.isSuper();
  }
}
