import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UsersService } from '../../services/users.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-workspace-hub',
  imports: [RouterLink],
  templateUrl: './workspace-hub.component.html',
})
export class WorkspaceHubComponent {
  private users = inject(UsersService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotificationService);

  loadingGuest = signal(false);

  continueBrowseMarketplace(): void {
    void this.router.navigate(['/browse/orgs']);
  }

  createOrganization(): void {
    void this.router.navigate(['/organizations/new']);
  }

  continueAsGuest(): void {
    this.loadingGuest.set(true);
    this.users.becomeGuest().subscribe({
      next: (res) => {
        this.loadingGuest.set(false);
        if (res?.status !== 'success' || !res?.data?.token) {
          this.notify.error('Could not continue as guest', res?.message || 'Try again.');
          return;
        }
        const d = res.data;
        this.auth.refreshAuthAfterOnboarding({
          token: d.token,
          expiresIn: d.expiresIn,
          user: d.user,
        });
        this.users.getProfile().subscribe({
          next: () => {
            this.notify.success('Guest mode', 'Explore Syncora — demo tasks only.');
            void this.router.navigate(['/dashboard']);
          },
          error: () => void this.router.navigate(['/dashboard']),
        });
      },
      error: (err) => {
        this.loadingGuest.set(false);
        const msg =
          err?.error?.message || err?.message || 'Could not continue as guest';
        this.notify.error(msg);
      },
    });
  }
}
