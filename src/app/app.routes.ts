import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { AdminGuard } from './core/guards/admin.guard';
import {
  onboardingPageGuard,
  onboardingRedirectGuard,
} from './core/guards/onboarding.guard';
import { workspaceTeamGuard } from './core/guards/workspace-team.guard';
import { guestBlockGuard } from './core/guards/guest-block.guard';
import { workspaceHubPageGuard } from './core/guards/workspace-hub.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/auth/register/register.component').then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: 'auth/google/callback',
    loadComponent: () =>
      import('./pages/auth/google-callback/google-callback.component').then(
        (m) => m.GoogleCallbackComponent
      ),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
  },
  {
    path: 'reset-password/:token',
    loadComponent: () =>
      import('./pages/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layouts/app-shell/app-shell.component').then(
        (m) => m.AppShellComponent
      ),
    canActivate: [AuthGuard],
    canActivateChild: [onboardingRedirectGuard],
    children: [
      {
        path: 'onboarding',
        loadComponent: () =>
          import('./pages/onboarding/onboarding.component').then(
            (m) => m.OnboardingComponent
          ),
        canActivate: [onboardingPageGuard],
      },
      {
        path: 'workspace-hub',
        loadComponent: () =>
          import('./pages/workspace-hub/workspace-hub.component').then(
            (m) => m.WorkspaceHubComponent
          ),
        canActivate: [workspaceHubPageGuard],
      },
      {
        path: 'browse/orgs',
        loadComponent: () =>
          import('./pages/browse-organizations/browse-organizations.component').then(
            (m) => m.BrowseOrganizationsComponent
          ),
      },
      {
        path: 'browse/orgs/:id',
        loadComponent: () =>
          import('./pages/browse-organizations/browse-org-detail.component').then(
            (m) => m.BrowseOrgDetailComponent
          ),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./pages/tasks/task-list/task-list.component').then(
            (m) => m.TaskListComponent
          ),
      },
      {
        path: 'tasks/new',
        loadComponent: () =>
          import('./pages/tasks/task-form/task-form.component').then(
            (m) => m.TaskFormComponent
          ),
        canActivate: [AdminGuard],
      },
      {
        path: 'tasks/edit/:id',
        loadComponent: () =>
          import('./pages/tasks/task-edit/task-edit.component').then(
            (m) => m.TaskEditComponent
          ),
      },
      {
        path: 'tasks/:id',
        loadComponent: () =>
          import('./pages/tasks/task-detail/task-detail.component').then(
            (m) => m.TaskDetailComponent
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/users/users-list/users-list.component').then(
            (m) => m.UsersListComponent
          ),
        canActivate: [workspaceTeamGuard],
      },
      {
        path: 'organizations',
        loadComponent: () =>
          import(
            './pages/organizations/organization-list/organization-list.component'
          ).then((m) => m.OrganizationListComponent),
      },
      {
        path: 'organizations/new',
        loadComponent: () =>
          import(
            './pages/organizations/organization-form/organization-form.component'
          ).then((m) => m.OrganizationFormComponent),
        canActivate: [guestBlockGuard],
      },
      {
        path: 'organizations/:id',
        loadComponent: () =>
          import(
            './pages/organizations/organization-detail/organization-detail.component'
          ).then((m) => m.OrganizationDetailComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then(
            (m) => m.ProfileComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
