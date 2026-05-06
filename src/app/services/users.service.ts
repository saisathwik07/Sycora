import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface OrgMembership {
  organization?: { _id: string; name: string; description?: string; visibility?: string };
  role?: string;
  joinedAt?: string;
}

export interface UserProfile {
  _id: string;
  email: string;
  role: string;
  fullName?: string;
  displayName?: string;
  isGuest?: boolean;
  organization?: { _id: string; name: string; visibility?: string };
  memberships?: OrgMembership[];
  organizationRole?: string | null;
  joinedAt?: string | null;
  needsOnboarding?: boolean;
  needsWorkspaceChoice?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private apiUrl = `${environment.apiUrl}/users`;
  private http = inject(HttpClient);

  readonly profile = signal<UserProfile | null>(null);

  clearProfile(): void {
    this.profile.set(null);
  }

  getProfile(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/profile`).pipe(
      tap((res) => {
        if (res?.status === 'success' && res?.data) {
          this.profile.set(res.data as UserProfile);
        }
      })
    );
  }

  getUsers(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/organization`);
  }

  getUsersByOrganization(page: number = 1, limit: number = 100): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/organization?page=${page}&limit=${limit}`
    );
  }

  getAllUsers(page: number = 1, limit: number = 100): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}?page=${page}&limit=${limit}`);
  }

  completeOnboarding(payload: {
    fullName: string;
    displayName: string;
    workspaceName?: string;
    skipWorkspace?: boolean;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/profile/onboarding`, payload);
  }

  switchWorkspace(organizationId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/me/workspace`, { organizationId });
  }

  becomeGuest(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/me/guest`, {});
  }

  listNotifications(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/me/notifications`);
  }

  markNotificationRead(notificationId: string): Observable<any> {
    return this.http.patch<any>(
      `${this.apiUrl}/me/notifications/${notificationId}/read`,
      {}
    );
  }

  inviteMember(payload: { email: string; role: 'admin' | 'member' }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/invite`, payload);
  }
}
