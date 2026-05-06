import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { UsersService } from '../../services/users.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-onboarding',
  imports: [ReactiveFormsModule],
  templateUrl: './onboarding.component.html',
})
export class OnboardingComponent {
  private fb = inject(FormBuilder);
  private users = inject(UsersService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotificationService);

  submitting = signal(false);
  error = signal<string>('');

  form: FormGroup = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    displayName: ['', [Validators.required, Validators.minLength(1)]],
    workspaceName: [''],
  });

  private finalizeSuccess(res: any, toastTitle: string, toastMsg: string): void {
    if (res?.status !== 'success' || !res?.data?.token) {
      this.error.set(res?.message || 'Could not complete setup');
      return;
    }
    const d = res.data;
    this.auth.refreshAuthAfterOnboarding({
      token: d.token,
      expiresIn: d.expiresIn,
      user: d.user,
    });
    this.users.getProfile().subscribe({
      next: () => {
        this.notify.success(toastMsg, toastTitle);
        void this.router.navigate(['/dashboard']);
      },
      error: () => void this.router.navigate(['/dashboard']),
    });
  }

  submit(): void {
    if (this.form.get('fullName')?.invalid || this.form.get('displayName')?.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const ws = String(this.form.get('workspaceName')?.value || '').trim();
    if (ws.length < 2) {
      this.form.get('workspaceName')?.markAsTouched();
      this.error.set('Choose a workspace name (at least 2 characters) or use “Choose workspace later”.');
      return;
    }
    this.error.set('');
    this.submitting.set(true);
    const v = this.form.getRawValue() as {
      fullName: string;
      displayName: string;
      workspaceName: string;
    };

    this.users
      .completeOnboarding({
        fullName: v.fullName.trim(),
        displayName: v.displayName.trim(),
        workspaceName: ws,
      })
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.finalizeSuccess(res, 'Welcome to Syncora!', 'Workspace ready');
        },
        error: (err) => {
          this.submitting.set(false);
          const msg =
            err?.error?.message || err?.message || 'Something went wrong';
          this.error.set(msg);
        },
      });
  }

  submitSkipWorkspace(): void {
    if (this.form.get('fullName')?.invalid || this.form.get('displayName')?.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set('');
    this.submitting.set(true);
    const v = this.form.getRawValue() as {
      fullName: string;
      displayName: string;
    };

    this.users
      .completeOnboarding({
        fullName: v.fullName.trim(),
        displayName: v.displayName.trim(),
        skipWorkspace: true,
      })
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          if (res?.status !== 'success' || !res?.data?.token) {
            this.error.set(res?.message || 'Could not save profile');
            return;
          }
          const d = res.data;
          this.auth.refreshAuthAfterOnboarding({
            token: d.token,
            expiresIn: d.expiresIn,
            user: d.user,
          });
          this.users.getProfile().subscribe({
            next: () => {
              void this.router.navigate(['/workspace-hub']);
            },
            error: () => void this.router.navigate(['/workspace-hub']),
          });
        },
        error: (err) => {
          this.submitting.set(false);
          const msg =
            err?.error?.message || err?.message || 'Something went wrong';
          this.error.set(msg);
        },
      });
  }
}
