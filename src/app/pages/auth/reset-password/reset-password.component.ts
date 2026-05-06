import { Component, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-reset-password',
    imports: [ReactiveFormsModule, RouterLink],
    templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent implements OnInit {
  resetPasswordForm: FormGroup = new FormGroup({});
  token: string;
  error = signal<string>('');
  success = signal<string>('');
  loading = signal<boolean>(false);

  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  constructor() {
    this.token = this.route.snapshot.paramMap.get('token') || '';
  }

  ngOnInit(): void {
    if (!this.token) {
      this.error.set('Invalid reset link. Please request a new password reset.');
    }

    this.resetPasswordForm = new FormGroup({
      password: new FormControl('', [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(64)
      ]),
      confirmPassword: new FormControl('', [Validators.required]),
    });
  }

  onSubmit() {
    if (this.resetPasswordForm.invalid || !this.token) return;

    if (this.resetPasswordForm.value.password !== this.resetPasswordForm.value.confirmPassword) {
      this.error.set('Passwords do not match');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.authService
      .resetPassword(this.token, this.resetPasswordForm.value.password)
      .subscribe({
        next: () => {
          this.success.set('Password has been reset successfully. Redirecting to login...');
          this.loading.set(false);
          setTimeout(() => this.router.navigate(['/login']), 2500);
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'Password reset failed. The link may have expired.');
          this.loading.set(false);
        },
      });
  }
}
