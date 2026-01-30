import { DragDropModule } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { StringParam } from 'adacad-drafting-lib';

@Component({
  selector: 'app-textparam',
  imports: [ReactiveFormsModule, MatDialogModule, DragDropModule, MatInputModule, CdkScrollable, MatDialogContent, MatDialogActions, MatButton, MatHint, MatLabel, MatFormField],
  templateUrl: './textparam.component.html',
  styleUrl: './textparam.component.scss'
})
export class TextparamComponent {

  private dialogRef = inject<MatDialogRef<TextparamComponent>>(MatDialogRef);
  private data = inject(MAT_DIALOG_DATA);
  @Output() onUpdate = new EventEmitter<string>();

  stringparam: StringParam;
  value: string;
  fc: FormControl;
  original: String;

  constructor() {
    this.stringparam = <StringParam>this.data.param;
    this.value = <string>this.data.val;
    this.original = this.value;
    this.fc = new FormControl(this.value, [Validators.required, Validators.pattern(this.stringparam.regex)]);
  }

  ngOnInit(): void {
    this.fc.valueChanges.subscribe(val => {
      this.value = val ? val.replace(/[\r\n]/g, '') : val;
      this.fc.setValue(this.value, { emitEvent: false });
    });
  }

  save() {
    this.onUpdate.emit(this.value);
  }


  close() {
    this.dialogRef.close(this.value);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const content = e.target?.result as string;
      let processedContent = '';

      if (fileExtension === 'csv') {
        // Parse CSV: one value per row, combine with spaces
        const lines = content.split(/\r?\n/);
        const values = lines
          .map(line => line.trim())
          .filter(line => line.length > 0) // Remove empty lines
          .map(line => {
            // If line contains commas, take the first column
            if (line.includes(',')) {
              const firstColumn = line.split(',')[0].trim();
              // Remove quotes if present
              if ((firstColumn.startsWith('"') && firstColumn.endsWith('"')) ||
                (firstColumn.startsWith("'") && firstColumn.endsWith("'"))) {
                return firstColumn.slice(1, -1);
              }
              return firstColumn;
            }
            // No commas, treat whole line as value
            const trimmed = line.trim();
            if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
              (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
              return trimmed.slice(1, -1);
            }
            return trimmed;
          });
        processedContent = values.join(' ');
      } else if (fileExtension === 'txt' || fileExtension === 'text') {
        // For text files, use content directly
        processedContent = content.trim();
      } else {
        // Default: treat as text file
        processedContent = content.trim();
      }

      // Update the value and form control
      this.value = processedContent;
      this.fc.setValue(processedContent);
    };

    reader.readAsText(file);

    // Reset the input so the same file can be selected again
    input.value = '';
  }

}
