import { Component, inject, OnInit, signal } from '@angular/core';
import { OrganizationService } from '../../../services/organization.service';
import { Organization } from '../../../core/models/organization.model';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { LoadingStateComponent } from '../../../shared/ui/loading-state/loading-state.component';

@Component({
  selector: 'app-organization-list',
  imports: [RouterLink, LoadingStateComponent],
  templateUrl: './organization-list.component.html'
})
export class OrganizationListComponent implements OnInit {
  organizations = signal<Organization[]>([]);
  currentPage = signal<number>(1);
  itemsPerPage = signal<number>(10);
  totalPages = signal<number>(0);
  totalOrganizations = signal<number>(0);
  loading = signal<boolean>(false);
  error = signal<string>('');
  Math = Math;

  organizationService = inject(OrganizationService);
  private authService = inject(AuthService);

  ngOnInit() {
    this.loadOrganizations(this.currentPage(), this.itemsPerPage());
  }

  loadOrganizations(page: number, limit: number) {
    this.loading.set(true);

    const role = this.authService.getCurrentUserRole?.() || 'admin'; // fallback to admin

    let orgsObservable;
    if (role === 'super') {
      orgsObservable = this.organizationService.getAllOrganizations(page, limit);
    } else {
      orgsObservable = this.organizationService.getMyOrganizations(page, limit);
    }

    orgsObservable.subscribe({
      next: (response: any) => {
        const data = response?.data;
        if (role === 'super') {
          this.organizations.set(data?.organizations || []);
          this.totalPages.set(data?.totalPages || 1);
          this.currentPage.set(data?.currentPage || 1);
          this.totalOrganizations.set(data?.totalOrganizations || 0);
        } else {
          // GET /organizations/my returns the organization document directly on data (see backend getMyOrganization).
          // GET /organizations/my from older shapes may nest under data.organization or return a paginated list.
          let list: Organization[] = [];
          let total = 0;
          if (Array.isArray(data?.organizations)) {
            list = data.organizations;
            total = data.totalOrganizations ?? list.length;
            this.totalPages.set(data.totalPages || 1);
            this.currentPage.set(data.currentPage || 1);
          } else if (data?.organization) {
            list = [data.organization];
            total = 1;
            this.totalPages.set(1);
            this.currentPage.set(1);
          } else if (data && typeof data === 'object' && '_id' in data) {
            list = [data as Organization];
            total = 1;
            this.totalPages.set(1);
            this.currentPage.set(1);
          }
          this.organizations.set(list);
          this.totalOrganizations.set(total);
        }
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error getting organizations:', error);
        const msg = error?.error?.message || error?.message;
        this.error.set(
          typeof msg === 'string' ? msg : 'Error loading organizations. Please try again.'
        );
        this.loading.set(false);
      },
    });
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      const nextPageNum = this.currentPage() + 1;
      this.loadOrganizations(nextPageNum, this.itemsPerPage());
    }
  }

  previousPage() {
    if (this.currentPage() > 1) {
      const prevPageNum = this.currentPage() - 1;
      this.loadOrganizations(prevPageNum, this.itemsPerPage());
    }
  }
}
