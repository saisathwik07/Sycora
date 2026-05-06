import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OrganizationService } from '../../services/organization.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-browse-organizations',
  imports: [NgClass],
  templateUrl: './browse-organizations.component.html',
})
export class BrowseOrganizationsComponent implements OnInit {
  private orgApi = inject(OrganizationService);
  private router = inject(Router);
  auth = inject(AuthService);
  private notify = inject(NotificationService);

  loading = signal(true);
  error = signal('');
  rows = signal<
    {
      _id: string;
      name: string;
      description?: string;
      visibility: string;
      memberCount: number;
    }[]
  >([]);

  requestingId = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.orgApi.publicMarketplace(1, 50).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        const list = res?.data?.organizations ?? [];
        this.rows.set(list);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Could not load organizations');
      },
    });
  }

  view(orgId: string): void {
    void this.router.navigate(['/browse/orgs', orgId]);
  }

  requestJoin(orgId: string): void {
    if (this.auth.isGuest()) {
      this.notify.error('Guests cannot request to join', 'Create an account workspace first.');
      return;
    }
    this.requestingId.set(orgId);
    this.orgApi.requestJoinPublic(orgId).subscribe({
      next: () => {
        this.requestingId.set(null);
        this.notify.success('Request sent', 'Admins will review your join request.');
      },
      error: (err) => {
        this.requestingId.set(null);
        const msg = err?.error?.message || err?.message || 'Request failed';
        this.notify.error(msg);
      },
    });
  }
}
