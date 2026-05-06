import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { OrganizationService } from '../../services/organization.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-browse-org-detail',
  imports: [RouterLink, NgClass],
  templateUrl: './browse-org-detail.component.html',
})
export class BrowseOrgDetailComponent implements OnInit {
  route = inject(ActivatedRoute);
  orgApi = inject(OrganizationService);
  auth = inject(AuthService);
  notify = inject(NotificationService);

  loading = signal(true);
  error = signal('');
  requesting = signal(false);
  detail = signal<{
    _id: string;
    name: string;
    description?: string;
    visibility: string;
    memberCount: number;
    viewerMembership?: boolean;
  } | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.error.set('Missing organization id');
      return;
    }
    this.orgApi.publicOrganizationDetail(id).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        if (res?.status === 'success' && res?.data) {
          this.detail.set(res.data);
        } else {
          this.error.set(res?.message || 'Organization not found');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Could not load organization');
      },
    });
  }

  requestJoin(): void {
    const d = this.detail();
    if (!d || this.auth.isGuest()) return;
    this.requesting.set(true);
    this.orgApi.requestJoinPublic(d._id).subscribe({
      next: () => {
        this.requesting.set(false);
        this.notify.success('Request sent', 'Organization admins have been notified.');
      },
      error: (err) => {
        this.requesting.set(false);
        this.notify.error(err?.error?.message || 'Could not send request');
      },
    });
  }
}
