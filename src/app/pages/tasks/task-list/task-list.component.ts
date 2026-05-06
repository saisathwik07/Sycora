import { Component, inject, OnInit, signal } from '@angular/core';
import { TaskService } from '../../../services/task.service';
import { Task } from '../../../core/models/tasks.model';
import { RouterLink } from '@angular/router';
import { NgClass, DatePipe } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { DeadlineAlertPipe } from '../../../shared/pipes/deadline-alert.pipe';
import { LoadingStateComponent } from '../../../shared/ui/loading-state/loading-state.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';

@Component({
    selector: 'app-task-list',
    imports: [
      RouterLink,
      NgClass,
      DatePipe,
      DeadlineAlertPipe,
      FormsModule,
      CdkDropList,
      CdkDrag,
      LoadingStateComponent,
      SpinnerComponent,
    ],
    templateUrl: './task-list.component.html',
})
export class TaskListComponent implements OnInit {
  // Change the name to be consistent (remove $ suffix)
  completedTasks = signal<Task[]>([]);
  pendingTasks = signal<Task[]>([]);

  completedPaginatedTasks = signal<Task[]>([]);
  pendingPaginatedTasks = signal<Task[]>([]);

  completedCurrentPage = signal<number>(1);
  pendingCurrentPage = signal<number>(1);

  completedItemsPerPage = signal<number>(10);
  pendingItemsPerPage = signal<number>(10);

  completedTotalPages = signal<number>(0);
  pendingTotalPages = signal<number>(0);

  completedTotalTasks = signal<number>(0); // Add signal for total completed tasks
  pendingTotalTasks = signal<number>(0);   // Add signal for total pending tasks

  taskService = inject(TaskService);
  auth = inject(AuthService);

  completedLoading = signal<boolean>(false);
  pendingLoading = signal<boolean>(false);

  completedError = signal<string>('');
  pendingError = signal<string>('');

  // Search and Filter Signals
  searchQuery = signal<string>('');
  priorityFilter = signal<string>('');
  sortBy = signal<string>('deadline');
  sortOrder = signal<string>('asc');

  private searchTimeout: any;

  constructor() {}

  ngOnInit() {
    this.refreshData();
  }

  loadCompletedTasks(page: number, limit: number) {
    this.completedLoading.set(true);
    this.taskService.getCompletedTasks(page, limit, this.searchQuery(), this.priorityFilter()).subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data) {
          // Set the tasks directly from the response
          this.completedTasks.set(response.data.tasks || []);
          this.completedTotalPages.set(response.data.totalPages || 1);
          this.completedCurrentPage.set(response.data.currentPage || 1);
          this.completedTotalTasks.set(response.data.totalTasks || 0);

          // No need to call updateCompletedPaginatedTasks() here
          // as we're directly using the paginated data from the API
          this.completedPaginatedTasks.set(response.data.tasks || []);
        } else {
          this.completedError.set('Invalid response format from server');
        }

        this.completedLoading.set(false);
      },
      error: (error) => {
        console.error('Error getting completed tasks:', error);
        const msg = error?.error?.message ?? error?.message;
        this.completedError.set(
          typeof msg === 'string' ? msg : 'Error getting completed tasks'
        );
        this.completedLoading.set(false);
      },
    });
  }

  loadPendingTasks(page: number, limit: number) {
    this.pendingLoading.set(true);
    this.taskService.getPendingTasks(
      page, 
      limit, 
      this.searchQuery(), 
      this.priorityFilter(), 
      this.sortBy(), 
      this.sortOrder()
    ).subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data) {
          this.pendingTasks.set(response.data.tasks || []);
          this.pendingTotalPages.set(response.data.totalPages || 1);
          this.pendingCurrentPage.set(response.data.currentPage || 1);
          this.pendingTotalTasks.set(response.data.totalTasks || 0);

          // Directly set the paginated tasks from the API response
          this.pendingPaginatedTasks.set(response.data.tasks || []);
        } else {
          this.pendingError.set('Invalid response format from server');
        }

        this.pendingLoading.set(false);
      },
      error: (error) => {
        console.error('Error getting pending tasks:', error);
        const msg = error?.error?.message ?? error?.message;
        this.pendingError.set(
          typeof msg === 'string' ? msg : 'Error getting pending tasks'
        );
        this.pendingLoading.set(false);
      },
    });
  }

  loadUserTasks(page: number, limit: number) {
    // This method is redundant if we use loadPendingTasks for all organizational tasks
    // But keeping it consistent if specific "My Tasks" view is needed
    this.loadPendingTasks(page, limit);
  }

  onFilterChange() {
    this.pendingCurrentPage.set(1);
    this.completedCurrentPage.set(1);
    this.refreshData();
  }

  onSearchChange() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.onFilterChange();
    }, 400); // 400ms debounce
  }

  toggleSortOrder() {
    this.sortOrder.set(this.sortOrder() === 'asc' ? 'desc' : 'asc');
    this.onFilterChange();
  }

  // These methods are not currently needed since we're using server-side pagination
  // but kept for potential client-side pagination fallback
  updateCompletedPaginatedTasks() {
    const startIndex =
      (this.completedCurrentPage() - 1) * this.completedItemsPerPage();
    const endIndex = startIndex + this.completedItemsPerPage();
    // Update to use the renamed signal
    this.completedPaginatedTasks.set(
      this.completedTasks().slice(startIndex, endIndex)
    );
  }

  updatePendingPaginatedTasks() {
    const startIndex =
      (this.pendingCurrentPage() - 1) * this.pendingItemsPerPage();
    const endIndex = startIndex + this.pendingItemsPerPage();
    this.pendingPaginatedTasks.set(
      this.pendingTasks().slice(startIndex, endIndex)
    );
  }

  nextCompletedPage() {
    if (this.completedCurrentPage() < this.completedTotalPages()) {
      this.completedCurrentPage.set(this.completedCurrentPage() + 1);
      this.loadCompletedTasks(
        this.completedCurrentPage(),
        this.completedItemsPerPage()
      );
    } else {
      console.log('No more pages to display.');
    }
  }

  nextPendingPage() {
    if (this.pendingCurrentPage() < this.pendingTotalPages()) {
      this.pendingCurrentPage.set(this.pendingCurrentPage() + 1);
      this.loadPendingTasks(
        this.pendingCurrentPage(),
        this.pendingItemsPerPage()
      );
    } else {
      console.log('No more pages to display.');
    }
  }

  previousCompletedPage() {
    if (this.completedCurrentPage() > 1) {
      this.completedCurrentPage.set(this.completedCurrentPage() - 1);
      this.loadCompletedTasks(
        this.completedCurrentPage(),
        this.completedItemsPerPage()
      );
    } else {
      console.log('Already on the first page.');
    }
  }

  previousPendingPage() {
    if (this.pendingCurrentPage() > 1) {
      this.pendingCurrentPage.set(this.pendingCurrentPage() - 1);
      this.loadPendingTasks(
        this.pendingCurrentPage(),
        this.pendingItemsPerPage()
      );
    } else {
      console.log('Already on the first page.');
    }
  }

  refreshData() {
    this.pendingLoading.set(true);
    this.completedLoading.set(true);
    this.pendingError.set('');
    this.completedError.set('');

    this.loadCompletedTasks(this.completedCurrentPage(), this.completedItemsPerPage());
    this.loadPendingTasks(this.pendingCurrentPage(), this.pendingItemsPerPage());
  }

  isAdmin() {
    return this.auth.isAdmin();
  }

  isSuperAdmin() {
    return this.auth.isSuper();
  }

  getSubtaskProgress(task: Task): string {
    if (!task.subtasks || task.subtasks.length === 0) return '';
    const completed = task.subtasks.filter(s => s.completed).length;
    return `${completed}/${task.subtasks.length} subtasks`;
  }

  getSubtaskProgressPercentage(task: Task): number {
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    const completed = task.subtasks.filter(s => s.completed).length;
    return (completed / task.subtasks.length) * 100;
  }

  onTaskDrop(event: CdkDragDrop<Task[]>) {
    if (event.previousContainer === event.container) {
      // Reordering within the same list
      const items = [...event.container.data];
      moveItemInArray(items, event.previousIndex, event.currentIndex);
      
      // Update the correct signal based on which list was reordered
      if (event.container.id === 'pendingList') {
        this.pendingPaginatedTasks.set(items);
      } else {
        this.completedPaginatedTasks.set(items);
      }
    } else {
      // Moving between lists
      const previousData = [...event.previousContainer.data];
      const currentData = [...event.container.data];
      
      transferArrayItem(
        previousData,
        currentData,
        event.previousIndex,
        event.currentIndex
      );

      const movedTask = currentData[event.currentIndex];

      // Update local UI state immediately for smooth UX
      if (event.previousContainer.id === 'pendingList') {
        this.pendingPaginatedTasks.set(previousData);
        this.completedPaginatedTasks.set(currentData);
        movedTask.completed = true;
      } else {
        this.completedPaginatedTasks.set(previousData);
        this.pendingPaginatedTasks.set(currentData);
        movedTask.completed = false;
      }

      // API Call to update the backend
      this.taskService.updateTask(movedTask._id!, { completed: movedTask.completed }).subscribe({
         next: () => {
            // Re-fetch to guarantee sync with server (including pagination calculations)
            this.refreshData();
         },
         error: (err) => {
            console.error('Failed to update task status on drag drop', err);
            // Revert changes on error
            this.refreshData();
         }
      });
    }
  }
}
