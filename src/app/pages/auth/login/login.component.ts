import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { NotificationService } from '../../../services/notification.service';
import { environment } from '../../../../environments/environment';

@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule, RouterLink, NgClass],
    templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  error = signal<string>('');
  showPassword = signal<boolean>(false);
  loading = signal<boolean>(false);
  isLoading = computed(() => this.loading());

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private notificationService = inject(NotificationService);

  constructor() {
    this.loginForm = this.fb.group({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(20),
      ]),
    });
  }

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('error') === 'access_denied') {
      this.error.set(
        'Access denied. Your account is not authorized. Contact the admin to request access.',
      );
      return;
    }
    const err = this.route.snapshot.queryParamMap.get('oauth_error');
    if (err) {
      this.error.set(this.oauthErrorMessage(err));
    }
  }

  signInWithGoogle(): void {
    window.location.href = `${environment.apiUrl}/auth/google`;
  }

  private oauthErrorMessage(code: string): string {
    const map: Record<string, string> = {
      invalid_state: 'Google sign-in was interrupted. Please try again.',
      not_configured: 'Google sign-in is not available.',
      token_exchange_failed: 'Could not complete Google sign-in. Try again.',
      profile_incomplete: 'Google did not return your email. Try another account.',
      account_conflict: 'This Google account cannot be linked. Contact support.',
      missing_token: 'Google sign-in did not return a session. Try again.',
      bad_payload: 'Google sign-in response was invalid. Try again.',
      server_error: 'Something went wrong with Google sign-in.',
    };
    return map[code] ?? 'Google sign-in failed. Please try again.';
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((state) => !state);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }
    this.setLoadingState(true);
    const data = this.getFormData();
    this.authService.login(data).subscribe({
      next: () => this.handleLoginSuccess(),
      error: (err) => this.handleLoginError(err),
    });
  }

  private setLoadingState(state: boolean): void {
    this.loading.set(state);
  }

  private getFormData(): { email: string; password: string } {
    return {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password,
    };
  }

  private handleLoginSuccess(): void {
    this.setLoadingState(false);
    this.notificationService.success('Welcome back! You have successfully logged in.', 'Login Successful');
    void this.router.navigate(['/dashboard']);
  }

  private handleLoginError(err: any): void {
    this.setLoadingState(false);
    console.error(err);
    const msg = err?.error?.message || 'Invalid credentials. Please try again.';
    this.error.set(msg);
    this.notificationService.error(msg, 'Login Failed');
  }
}