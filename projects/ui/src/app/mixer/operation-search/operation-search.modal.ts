import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { OperationSearchComponent } from './operation-search.component';

@Component({
  selector: 'app-operation-search-modal',
  templateUrl: './operation-search.modal.html',
  styleUrls: ['./operation-search.modal.scss'],
  imports: [MatDialogTitle, CdkScrollable, MatDialogContent, MatDialogActions, MatButton, MatDialogClose, OperationSearchComponent],
  standalone: true
})
export class OperationSearchModal {
  private dialogRef = inject<MatDialogRef<OperationSearchModal>>(MatDialogRef);

  @Output() addOperation = new EventEmitter<string>();

  onAddOperation(opName: string) {
    this.addOperation.emit(opName);
    this.dialogRef.close();
  }

  close(): void {
    this.dialogRef.close();
  }
}

