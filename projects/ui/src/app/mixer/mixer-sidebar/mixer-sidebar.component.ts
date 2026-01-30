import { Component, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatAccordion, MatExpansionPanel } from '@angular/material/expansion';
import { MatTooltip } from '@angular/material/tooltip';
import { OperationSearchComponent } from '../operation-search/operation-search.component';
import { OperationSearchModal } from '../operation-search/operation-search.modal';

@Component({
  selector: 'app-mixer-sidebar',
  templateUrl: './mixer-sidebar.component.html',
  styleUrls: ['./mixer-sidebar.component.scss'],
  imports: [MatAccordion, MatIconButton, MatExpansionPanel, MatButton, MatTooltip, OperationSearchComponent],
  standalone: true
})
export class MixerSidebarComponent {
  @Input() is_fullscreen: boolean;
  @Output() addOperation = new EventEmitter<string>();
  @Output() addDraft = new EventEmitter<void>();
  @Output() createNote = new EventEmitter<void>();

  private dialog = inject(MatDialog);

  @ViewChild(OperationSearchComponent) operationSearch: OperationSearchComponent;

  /** sidebar state */
  isCollapsed: boolean = false;

  onAddDraft() {

    this.addDraft.emit();
  }

  onCreateNote() {
    this.createNote.emit();
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
  }

  onCollapsedAddDraft() {
    this.addDraft.emit();
  }

  onCollapsedCreateNote() {
    this.createNote.emit();
  }

  onCollapsedSearchClick() {
    // Open the operation search modal when sidebar is collapsed
    const dialogRef = this.dialog.open(OperationSearchModal);
    dialogRef.componentInstance.addOperation.subscribe((opName: string) => {
      this.addOperation.emit(opName);
    });
  }

  onAddOperation(opName: string) {
    this.addOperation.emit(opName);
  }

  refreshOperations() {
    if (this.operationSearch) {
      this.operationSearch.refreshOperations();
    }
  }
}

