import { Component, inject, signal, computed, effect, untracked } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { UsersService } from '../../services/users.service';
import { UserItem } from '../../core/models/users.model';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgClass],
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent {
  auth = inject(AuthService);
  theme = inject(ThemeService);
  router = inject(Router);
  users = inject(UsersService);
  private notify = inject(NotificationService);

  sidebarCollapsed = signal(false);
  mobileOpen = signal(false);
  teamCount = signal(0);
  teamPreview = signal<UserItem[]>([]);
  private teamPreviewOrgKey = signal<string>('');

  showTeamNav = computed(() => {
    if (!this.auth.isAuthenticated()) return false;
    if (this.auth.isGuest()) return false;
    if (this.auth.isSuper()) return true;
    if (this.auth.isAdmin()) return true;
    const p = this.users.profile();
    return p?.organizationRole === 'admin';
  });

  workspaceChoices = computed(() => {
    const p = this.users.profile();
    const memberships = p?.memberships ?? [];
    return memberships
      .map((m) => m.organization)
      .filter(
        (o): o is { _id: string; name: string } =>
          !!o && typeof o._id === 'string'
      );
  });

  showWorkspaceSwitcher = computed(
    () => !this.auth.isGuest() && this.workspaceChoices().length > 1
  );

  activeOrganizationId = computed(
    () => this.users.profile()?.organization?._id ?? ''
  );

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.sidebarCollapsed.set(localStorage.getItem('tf_sidebar_collapsed') === '1');
    }

    effect(() => {
      if (!this.auth.isAuthenticated()) return;
      const show = this.showTeamNav();
      const orgPart =
        this.users.profile()?.organization?._id != null
          ? String(this.users.profile()?.organization?._id)
          : '';
      if (!show || !orgPart) return;

      const key = `${show}:${orgPart}`;
      if (this.teamPreviewOrgKey() === key) return;
      this.teamPreviewOrgKey.set(key);

      untracked(() => {
        this.users.getUsersByOrganization(1, 8).subscribe({
          next: (res) => {
            const list = (res?.data?.users ?? []) as UserItem[];
            this.teamCount.set(res?.data?.totalUsers ?? list.length);
            this.teamPreview.set(list.slice(0, 4));
          },
          error: () => {},
        });
      });
    });
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

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
    localStorage.setItem('tf_sidebar_collapsed', this.sidebarCollapsed() ? '1' : '0');
  }

  toggleMobile(): void {
    this.mobileOpen.update((v) => !v);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }

  isAdmin(): boolean {
    return this.auth.isAdmin() && this.auth.isAuthenticated();
  }

  isSuperAdmin(): boolean {
    return this.auth.isSuper() && this.auth.isAuthenticated();
  }

  userEmail(): string {
    const u = this.auth.getCurrentUser() as { email?: string } | null;
    if (u?.email) return u.email;
    try {
      const token = this.auth.getToken();
      if (!token) return '';
      const payload = JSON.parse(atob(token.split('.')[1])) as { email?: string };
      return payload.email ?? '';
    } catch {
      return '';
    }
  }

  switchOrganization(ev: Event): void {
    const sel = ev.target as HTMLSelectElement;
    const nextId = sel.value;
    const cur = this.activeOrganizationId();
    if (!nextId || nextId === cur) return;

    this.users.switchWorkspace(nextId).subscribe({
      next: (res: any) => {
        const d = res?.data;
        if (!d?.token) return;
        const curUser = this.auth.getCurrentUser() as {
          _id?: string;
          email?: string;
          role?: string;
        } | null;
        this.auth.refreshAuthAfterOnboarding({
          token: d.token,
          expiresIn: d.expiresIn ?? 3600,
          user: {
            _id:
              this.auth.getCurrentUserId() ??
              curUser?._id ??
              '',
            email: curUser?.email ?? this.userEmail(),
            role: curUser?.role ?? this.auth.getCurrentUserRole() ?? 'user',
            organization: d.organization ?? null,
          },
        });
        this.users.getProfile().subscribe();
      },
      error: (err) => {
        sel.value = cur;
        const msg = err?.error?.message || err?.message || 'Could not switch workspace';
        this.notify.error(msg);
      },
    });
  }

  logout(): void {
    this.teamPreviewOrgKey.set('');
    this.teamCount.set(0);
    this.teamPreview.set([]);
    this.auth.logout();
    this.closeMobile();
    void this.router.navigate(['/login']);
  }
}
