import { Component, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-forgot-password',
    imports: [ReactiveFormsModule, RouterLink],
    templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent implements OnInit {
  forgotPasswordForm: FormGroup = new FormGroup({});
  error = signal<string>('');
  success = signal<string>('');
  loading = signal<boolean>(false);

  private authService = inject(AuthService);

  ngOnInit() {
    this.forgotPasswordForm = new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
    });
  }

  get email() {
    return this.forgotPasswordForm.get('email');
  }

  onSubmit() {
    if (this.forgotPasswordForm.invalid) return;

    this.loading.set(true);
    this.error.set('');
    this.success.set('');

    this.authService
      .forgotPassword(this.forgotPasswordForm.value.email)
      .subscribe({
        next: () => {
          this.success.set('If an account with that email exists, a password reset link has been sent. Check your inbox.');
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'Failed to send reset email. Please try again.');
          this.loading.set(false);
        },
      });
  }
}
