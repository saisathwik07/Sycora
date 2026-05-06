import { Component, input } from '@angular/core';
import { SpinnerComponent } from '../spinner/spinner.component';

@Component({
  selector: 'app-loading-state',
  imports: [SpinnerComponent],
  template: `
    <div class="flex flex-col justify-center items-center py-16">
      <app-spinner [size]="size()" [variant]="variant()" />
      @if (message()) {
        <p class="mt-4 text-center text-sm text-syn-muted">{{ message() }}</p>
      }
    </div>
  `,
})
export class LoadingStateComponent {
  message = input<string>('Loading...');
  size = input<'xs' | 'sm' | 'md' | 'lg'>('md');
  variant = input<'accent' | 'success' | 'neutral'>('accent');
}
