import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'replace',
  standalone: true
})
export class ReplacePipe implements PipeTransform {
  transform(value: string, strToReplace: string, replacement: string): string {
    if (!value || !strToReplace) return value || '';
    const escaped = strToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return value.replace(new RegExp(escaped, 'g'), replacement);
  }
}
