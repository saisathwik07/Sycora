import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Organizations, SingleOrganization } from '../core/models/organization.model';

@Injectable({
  providedIn: 'root',
})
export class OrganizationService {
  private apiUrl = `${environment.apiUrl}/organizations`;
  private http = inject(HttpClient);

  /** Organizations the current user belongs to (paginated). */
  getMyOrganizations(page: number = 1, limit: number = 50): Observable<Organizations> {
    return this.http.get<Organizations>(
      `${this.apiUrl}/my/list?page=${page}&limit=${limit}`
    );
  }

  publicMarketplace(page: number = 1, limit: number = 20): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/public/marketplace?page=${page}&limit=${limit}`
    );
  }

  publicOrganizationDetail(orgId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/public/${orgId}`);
  }

  requestJoinPublic(orgId: string, message?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/public/${orgId}/join-request`, {
      message,
    });
  }

  leaveOrganization(orgId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${orgId}/leave`, {});
  }

  transferOwnership(orgId: string, newOwnerId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${orgId}/transfer-ownership`, {
      newOwnerId,
    });
  }

  listJoinRequests(orgId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${orgId}/join-requests`);
  }

  reviewJoinRequest(
    orgId: string,
    requestId: string,
    decision: 'accept' | 'reject'
  ): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/${orgId}/join-requests/${requestId}/review`,
      { decision }
    );
  }

  getAllOrganizations(page: number, limit: number): Observable<Organizations> {
    return this.http.get<Organizations>(`${this.apiUrl}?page=${page}&limit=${limit}`);
  }

  getOrganizationById(id: string): Observable<SingleOrganization> {
    return this.http.get<SingleOrganization>(`${this.apiUrl}/${id}`);
  }

  createOrganization(organization: {
    name: string;
    description?: string;
    visibility?: 'public' | 'private';
  }): Observable<any> {
    return this.http.post<any>(this.apiUrl, organization);
  }

  updateOrganization(id: string, organization: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, organization);
  }

  addMember(organizationId: string, userId: string, role: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${organizationId}/members`, {
      userId,
      role,
    });
  }

  removeMember(organizationId: string, userId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${organizationId}/members`, {
      body: { userId },
    });
  }

  deleteOrganization(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}
