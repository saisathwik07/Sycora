import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UsersService, UserProfile } from '../../services/users.service';
import { catchError, map, of } from 'rxjs';

/** Workspace hub is only for users who still need to join or create an organization. */
export const workspaceHubPageGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const users = inject(UsersService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    void router.navigate(['/login']);
    return false;
  }

  const decide = (p: UserProfile | null): boolean => {
    if (!p?.needsWorkspaceChoice) {
      void router.navigate(['/dashboard']);
      return false;
    }
    return true;
  };

  const cached = users.profile();
  if (cached != null) {
    return decide(cached);
  }

  return users.getProfile().pipe(
    map((res) => decide((res?.data as UserProfile) ?? null)),
    catchError(() => {
      void router.navigate(['/dashboard']);
      return of(false);
    })
  );
};
