import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UsersService } from '../../services/users.service';
import { catchError, map, of } from 'rxjs';

/** Team page & invites: platform admin/super or workspace (organization) admin. */
export const workspaceTeamGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const users = inject(UsersService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    void router.navigate(['/login']);
    return false;
  }

  const allow = () => {
    if (auth.isSuper() || auth.isAdmin()) {
      return true;
    }
    const p = users.profile();
    if (p?.organizationRole === 'admin') {
      return true;
    }
    void router.navigate(['/dashboard']);
    return false;
  };

  if (users.profile() != null) {
    return allow();
  }

  return users.getProfile().pipe(
    map(() => allow()),
    catchError(() => {
      void router.navigate(['/dashboard']);
      return of(false);
    })
  );
};
