import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { UsersService } from './users.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl + '/auth';
  private tokenExpirationTimer: ReturnType<typeof setTimeout> | null = null;

  http = inject(HttpClient);
  router = inject(Router);
  private users = inject(UsersService);

  constructor() {}

  redirectToTasks() {
    this.router.navigate(['/tasks']);
  }

  register(user: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user).pipe(
      tap((response: any) => {
        this.handleAuthentication(
          response.token,
          response.expiresIn,
          response.user.role,
          response.user.organization,
          response.user.email
        );
      })
    );
  }

  login(user: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, user).pipe(
      tap((response: any) => {
        this.handleAuthentication(
          response.token,
          response.expiresIn,
          response.user.role,
          response.user.organization,
          response.user.email
        );
      })
    );
  }

  isGuest(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const decoded = JSON.parse(atob(token.split('.')[1])) as { isGuest?: boolean };
      return decoded.isGuest === true;
    } catch {
      return false;
    }
  }

  isAuthenticated(): boolean {
    const token = sessionStorage.getItem('token');
    if (!token) return false;
    const expirationDate = sessionStorage.getItem('tokenExpirationDate');
    if (!expirationDate) return false;
    return new Date(expirationDate) > new Date();
  }

  isAdmin(): boolean {
    const role = this.getEffectiveRole();
    return role === 'admin';
  }

  isSuper(): boolean {
    const role = this.getEffectiveRole();
    return role === 'super';
  }

  /** Prefer JWT role when present so UI matches server after onboarding. */
  private getEffectiveRole(): string | null {
    const token = this.getToken();
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1])) as {
          role?: string;
        };
        if (
          decoded.role === 'admin' ||
          decoded.role === 'super' ||
          decoded.role === 'user'
        ) {
          return decoded.role;
        }
      } catch {
        /* ignore */
      }
    }
    return sessionStorage.getItem('role');
  }

  /**
   * Sync sessionStorage role/org after server-side workspace provisioning
   * (e.g. legacy JWT without role claim).
   */
  syncSessionFromServer(): Observable<unknown> {
    if (!this.isAuthenticated()) {
      return of(null);
    }
    return this.users.getProfile().pipe(
      tap((res: any) => {
        if (res?.status !== 'success' || !res?.data) return;
        const p = res.data;
        if (p.role) {
          sessionStorage.setItem('role', p.role);
        }
        if (p.organization?._id) {
          sessionStorage.setItem(
            'organization',
            JSON.stringify({
              id: p.organization._id,
              name: p.organization.name,
            })
          );
        } else {
          sessionStorage.removeItem('organization');
        }
        const cur = this.getCurrentUser();
        if (cur) {
          cur.role = p.role;
          if (p.organization?._id) {
            cur.organization = {
              id: p.organization._id,
              name: p.organization.name,
            };
          } else {
            delete cur.organization;
          }
          this.saveUserData(cur);
        }
      })
    );
  }

  getToken(): string | null {
    return sessionStorage.getItem('token');
  }

  getCurrentUserRole(): string | null {
    return this.getEffectiveRole();
  }

  logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('tokenExpirationDate');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('organization');
    this.users.clearProfile();
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = null;
    }
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password/${token}`, {
      password,
    });
  }

  private handleAuthentication(
    token: string,
    expiresIn: number,
    role: string,
    organization?: unknown,
    email?: string
  ) {
    let orgStore = '';
    if (organization != null && organization !== '') {
      orgStore =
        typeof organization === 'object'
          ? JSON.stringify(organization)
          : String(organization);
    }
    const prev = this.getCurrentUser();
    const resolvedEmail = email ?? prev?.email;
    const user: Record<string, unknown> = {
      token,
      expiresIn,
      role,
      organization,
    };
    if (resolvedEmail) {
      user['email'] = resolvedEmail;
    }
    const expirationDate = new Date(new Date().getTime() + expiresIn * 1000);
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('organization', orgStore);
    sessionStorage.setItem('user', JSON.stringify(user));
    sessionStorage.setItem('tokenExpirationDate', expirationDate.toISOString());
    sessionStorage.setItem('role', role);
    this.autoLogout(expiresIn * 1000);
  }

  /** After onboarding completes — JWT + user snapshot include refreshed organization & role. */
  refreshAuthAfterOnboarding(payload: {
    token: string;
    expiresIn?: number;
    user: {
      _id: string;
      email?: string;
      role: string;
      organization?: { id: string; name: string } | null;
    };
  }): void {
    const exp = payload.expiresIn ?? 3600;
    this.handleAuthentication(
      payload.token,
      exp,
      payload.user.role,
      payload.user.organization ?? '',
      payload.user.email
    );
  }

  /** After redirect from Google OAuth (fragment parsed by caller). */
  completeGoogleOAuth(
    token: string,
    expiresIn: number,
    role: string,
    organization: { id: string; name: string } | null | undefined,
    email?: string
  ): void {
    this.handleAuthentication(token, expiresIn, role, organization ?? '', email);
  }

  autoLogin() {
    const token = this.getToken();
    const expirationDate = new Date(
      sessionStorage.getItem('tokenExpirationDate') || ''
    );
    if (!token || expirationDate <= new Date()) {
      this.logout();
      return;
    }
    const expiresIn = expirationDate.getTime() - new Date().getTime();
    this.autoLogout(expiresIn);
  }

  autoLogout(expirationDuration: number) {
    this.tokenExpirationTimer = setTimeout(() => {
      this.logout();
    }, expirationDuration);
  }

  getCurrentUserId(): string | null {
    try {
      const token = this.getToken();
      if (!token) return null;
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded._id;
    } catch (e) {
      return null;
    }
  }

  getCurrentUser(): any {
    const userData = sessionStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  }

  saveUserData(user: any): void {
    sessionStorage.setItem('user', JSON.stringify(user));
  }
}


