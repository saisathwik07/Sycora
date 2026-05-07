import { Component, inject, signal, OnInit } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { OrganizationService } from '../../../services/organization.service';
import { Organization } from '../../../core/models/organization.model';
import { environment } from '../../../../environments/environment';

/** Matches backend registration rules: 6–20 chars, upper, lower, number, special */
const REGISTER_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,20}$/;

function registerPasswordStrengthValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const v = control.value;
  if (v == null || v === '') {
    return null;
  }
  return REGISTER_PASSWORD_PATTERN.test(String(v))
    ? null
    : { passwordRules: true };
}

@Component({
    selector: 'app-register',
    imports: [ReactiveFormsModule, RouterLink, NgClass],
    templateUrl: './register.component.html',
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;
  error = signal<string>('');
  showPassword = signal<boolean>(false);
  isAdmin = signal<boolean>(false);
  organizations: Organization[] = [];

  authService = inject(AuthService);
  router = inject(Router);
  fb = inject(FormBuilder);
  organizationService = inject(OrganizationService);

  constructor() {
    this.registerForm = this.fb.group({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(20),
        registerPasswordStrengthValidator,
      ]),
      organization: new FormControl(''),
      role: new FormControl('user', Validators.required)
    });
  }

  ngOnInit(): void {
    this.updateRoleSelection();
  }

  signInWithGoogle(): void {
    window.location.href = `${environment.apiUrl}/auth/google`;
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((state) => !state);
  }

  updateRoleSelection() {
    const roleControl = this.registerForm.get('role');
    const orgNameControl = this.registerForm.get('organization');

    this.isAdmin.set(roleControl?.value === 'admin');

    if (roleControl?.value === 'admin') {
      orgNameControl?.setValidators([Validators.required]);
    } else {
      orgNameControl?.clearValidators();
    }

    orgNameControl?.updateValueAndValidity();
  }

  onSubmit() {
    if (this.registerForm.invalid) {
      Object.keys(this.registerForm.controls).forEach(key => {
        const control = this.registerForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    const data = {
      email: this.registerForm.value.email,
      password: this.registerForm.value.password,
      organization: this.registerForm.value.organization,
      role: this.registerForm.value.role
    };

    this.error.set('');
    this.authService.register(data).subscribe({
      next: () => {
        void this.router.navigate(['/dashboard']);
      },
      error: (err: unknown) => {
        console.error(err);
        this.error.set(this.extractRegisterErrorMessage(err));
      },
    });
  }

  private extractRegisterErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (body && typeof body === 'object' && 'message' in body) {
        const msg = (body as { message: unknown }).message;
        if (typeof msg === 'string' && msg.trim()) {
          return msg;
        }
      }
    }
    return 'An error occurred';
  }
}
