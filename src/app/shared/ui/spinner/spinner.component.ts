import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  template: `<div [class]="classes()" aria-hidden="true"></div>`,
})
export class SpinnerComponent {
  size = input<'xs' | 'sm' | 'md' | 'lg'>('md');
  variant = input<'accent' | 'success' | 'neutral'>('accent');

  classes = computed(() => {
    const sizeMap: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
      xs: 'w-8 h-8 border-[3px]',
      sm: 'w-10 h-10 border-[3px]',
      md: 'w-16 h-16 border-4',
      lg: 'w-20 h-20 border-[5px]',
    };
    const variantMap: Record<'accent' | 'success' | 'neutral', string> = {
      accent: 'border-accent-500',
      success: 'border-emerald-500',
      neutral: 'border-zinc-400',
    };
    return `${sizeMap[this.size()]} ${variantMap[this.variant()]} border-t-transparent rounded-full animate-spin`;
  });
}
