import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { ToastComponent } from './shared/toast/toast.component';
import { AuthService } from './services/auth.service';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, ToastComponent],
    templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  private title = inject(Title);
  meta = inject(Meta);

  constructor() {
    this.title.setTitle('Syncora');
    this.meta.addTags([
      {
        name: 'description',
        content:
          'Syncora helps teams organize tasks, deadlines, and assignments.',
      },
      { property: 'og:title', content: 'Syncora' },
      {
        property: 'og:description',
        content:
          'Syncora helps teams organize tasks, deadlines, and assignments.',
      },
      { name: 'keywords', content: 'tasks, team, productivity, Syncora, SaaS' },
      { name: 'robots', content: 'index, follow' },
    ]);
  }

  ngOnInit() {
    this.authService.autoLogin();
  }
}
