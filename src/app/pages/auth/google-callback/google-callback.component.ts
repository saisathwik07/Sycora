import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-google-callback',
  template: `
    <div
      class="min-h-[60vh] flex items-center justify-center p-6 text-gray-600 dark:text-gray-400"
    >
      Completing Google sign-in…
    </div>
  `,
})
export class GoogleCallbackComponent implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);

  ngOnInit(): void {
    const raw = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(raw);
    const token = params.get('token');
    const metaStr = params.get('meta');

    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search
    );

    if (!token || !metaStr) {
      void this.router.navigate(['/login'], {
        queryParams: { oauth_error: 'missing_token' },
      });
      return;
    }

    try {
      const meta = JSON.parse(decodeURIComponent(metaStr)) as {
        expiresIn?: number;
        role: string;
        organization?: { id: string; name: string } | null;
        email?: string;
        needsOnboarding?: boolean;
      };
      this.auth.completeGoogleOAuth(
        token,
        meta.expiresIn ?? 3600,
        meta.role,
        meta.organization ?? undefined,
        meta.email
      );
      this.notify.success('Signed in with Google.', 'Welcome');
      void this.router.navigate(['/dashboard']);
    } catch {
      void this.router.navigate(['/login'], {
        queryParams: { oauth_error: 'bad_payload' },
      });
    }
  }
}
