import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
    selector: 'app-home',
    imports: [RouterLink, NgClass],
    templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  auth = inject(AuthService);
  theme = inject(ThemeService);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.auth.redirectToTasks();
    }
  }
}
