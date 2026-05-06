import { Component, inject, OnInit, signal } from '@angular/core';
import { UsersService } from '../../../services/users.service';
import { UserItem } from '../../../core/models/users.model';
import { NgClass } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { LoadingStateComponent } from '../../../shared/ui/loading-state/loading-state.component';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-users-list',
  imports: [NgClass, LoadingStateComponent, ReactiveFormsModule],
  templateUrl: './users-list.component.html',
})
export class UsersListComponent implements OnInit {
  users = signal<UserItem[]>([]);
  paginatedUsers = signal<UserItem[]>([]);
  currentPage = signal<number>(1);
  itemsPerPage = signal<number>(10);
  totalPages = signal<number>(0);
  totalUsers = signal<number>(0);
  loading = signal<boolean>(false);
  error = signal<string>('');
  inviteOpen = signal(false);
  inviteSubmitting = signal(false);
  inviteError = signal<string>('');
  inviteForm: FormGroup;

  Math = Math;

  private usersService = inject(UsersService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private notify = inject(NotificationService);

  constructor() {
    this.inviteForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      role: ['member', Validators.required],
    });
  }

  ngOnInit() {
    this.loadUsers(this.currentPage(), this.itemsPerPage());
  }

  initials(user: UserItem): string {
    const basis =
      user.displayName?.trim() ||
      user.fullName?.trim() ||
      user.email?.split('@')[0] ||
      '?';
    const parts = basis.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (
        parts[0][0] + parts[parts.length - 1][0]
      ).toUpperCase();
    }
    return basis.slice(0, 2).toUpperCase();
  }

  openInvite(): void {
    this.inviteError.set('');
    this.inviteForm.reset({ email: '', role: 'member' });
    this.inviteOpen.set(true);
  }

  closeInvite(): void {
    this.inviteOpen.set(false);
  }

  submitInvite(): void {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }
    const raw = this.inviteForm.getRawValue() as {
      email: string;
      role: string;
    };
    this.inviteSubmitting.set(true);
    this.inviteError.set('');
    this.usersService
      .inviteMember({
        email: raw.email.trim().toLowerCase(),
        role: raw.role === 'admin' ? 'admin' : 'member',
      })
      .subscribe({
        next: (res) => {
          this.inviteSubmitting.set(false);
          if (res?.status !== 'success') {
            this.inviteError.set(res?.message || 'Invite failed');
            return;
          }
          this.notify.success(res?.message || 'Member added', 'Team');
          this.closeInvite();
          this.loadUsers(this.currentPage(), this.itemsPerPage());
        },
        error: (err) => {
          this.inviteSubmitting.set(false);
          const msg = err?.error?.message || 'Could not invite user';
          this.inviteError.set(msg);
          if (err?.status === 404) {
            this.notify.error('User not found', 'Invite');
          }
        },
      });
  }

  loadUsers(page: number, limit: number) {
    this.loading.set(true);
    const role = this.authService.getCurrentUserRole?.() || 'admin';

    let usersObservable;
    if (role === 'super') {
      usersObservable = this.usersService.getAllUsers(page, limit);
    } else {
      usersObservable = this.usersService.getUsersByOrganization(page, limit);
    }

    usersObservable.subscribe({
      next: (response) => {
        this.users.set(response?.data?.users || []);
        this.totalPages.set(response?.data?.totalPages || 1);
        this.currentPage.set(response?.data?.currentPage || 1);
        this.totalUsers.set(response?.data?.totalUsers || 0);
        this.paginatedUsers.set(response?.data?.users || []);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error getting users:', error);
        this.error.set('Error getting users');
        this.loading.set(false);
      },
    });
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.loadUsers(this.currentPage() + 1, this.itemsPerPage());
    }
  }

  previousPage() {
    if (this.currentPage() > 1) {
      this.loadUsers(this.currentPage() - 1, this.itemsPerPage());
    }
  }
}
