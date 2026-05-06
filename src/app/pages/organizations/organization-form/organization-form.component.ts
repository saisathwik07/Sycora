import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { OrganizationService } from '../../../services/organization.service';
import { UsersService } from '../../../services/users.service';
import { AuthService } from '../../../services/auth.service';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-organization-form',
  imports: [ReactiveFormsModule, RouterLink, NgClass],
  templateUrl: './organization-form.component.html'
})
export class OrganizationFormComponent {
  organizationForm: FormGroup;
  error = '';
  loading = false;
  
  private organizationService = inject(OrganizationService);
  private users = inject(UsersService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  
  constructor() {
    this.organizationForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      visibility: ['private'],
    });
  }
  
  onSubmit() {
    if (this.organizationForm.invalid) {
      return;
    }
    
    this.loading = true;
    const { name, description, visibility } = this.organizationForm.value;
    
    this.organizationService.createOrganization({
      name,
      description,
      visibility,
    })
      .subscribe({
        next: () => {
          this.users.getProfile().subscribe({
            next: () => {
              this.auth.syncSessionFromServer().subscribe({
                next: () => {
                  this.loading = false;
                  void this.router.navigate(['/dashboard']);
                },
                error: () => {
                  this.loading = false;
                  void this.router.navigate(['/dashboard']);
                },
              });
            },
            error: () => {
              this.loading = false;
              void this.router.navigate(['/dashboard']);
            },
          });
        },
        error: (error) => {
          console.error('Error creating organization:', error);
          this.error = error?.error?.message || 'Failed to create organization';
          this.loading = false;
        }
      });
  }
}