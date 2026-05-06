import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UsersService, UserProfile } from '../../services/users.service';
import { catchError, map, of } from 'rxjs';

function exemptWorkspaceChoice(url: string): boolean {
  return (
    url.includes('/workspace-hub') ||
    url.includes('/browse/orgs') ||
    url.includes('/onboarding') ||
    url.includes('/organizations/new')
  );
}

function shouldRedirectWorkspaceChoice(url: string, p: UserProfile): boolean {
  return Boolean(p.needsWorkspaceChoice && !exemptWorkspaceChoice(url));
}

/** Redirect to onboarding until profile setup is complete; then workspace hub until user joins/creates org. */
export const onboardingRedirectGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const users = inject(UsersService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  if (state.url.includes('/onboarding')) {
    return true;
  }

  const cached = users.profile();
  if (cached != null) {
    if (cached.needsOnboarding === true) {
      void router.navigate(['/onboarding']);
      return false;
    }
    if (shouldRedirectWorkspaceChoice(state.url, cached)) {
      void router.navigate(['/workspace-hub']);
      return false;
    }
    return true;
  }

  return users.getProfile().pipe(
    map((res) => {
      const p = res?.data as UserProfile | undefined;
      if (p?.needsOnboarding === true) {
        void router.navigate(['/onboarding']);
        return false;
      }
      if (p && shouldRedirectWorkspaceChoice(state.url, p)) {
        void router.navigate(['/workspace-hub']);
        return false;
      }
      return true;
    }),
    catchError(() => of(true))
  );
};

/** Allow onboarding page only while profile setup is incomplete. */
export const onboardingPageGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const users = inject(UsersService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    void router.navigate(['/login']);
    return false;
  }

  const cached = users.profile();
  if (cached != null) {
    if (cached.needsOnboarding !== true) {
      void router.navigate(['/dashboard']);
      return false;
    }
    return true;
  }

  return users.getProfile().pipe(
    map((res) => {
      const p = res?.data as UserProfile | undefined;
      if (p?.needsOnboarding !== true) {
        void router.navigate(['/dashboard']);
        return false;
      }
      return true;
    }),
    catchError(() => {
      void router.navigate(['/dashboard']);
      return of(false);
    })
  );
};
