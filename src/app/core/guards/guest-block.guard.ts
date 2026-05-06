import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/** Block guests from routes that mutate real workspace data (JWT `isGuest`). */
export const guestBlockGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isGuest()) {
    void router.navigate(['/dashboard']);
    return false;
  }
  return true;
};
