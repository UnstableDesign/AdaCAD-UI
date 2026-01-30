
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Subscription } from 'rxjs';
import { ConnectionStateEvent, DraftExistenceChange, DraftNode, DraftStateChange, DraftStateEvent, DraftStateMove, DraftStateNameChange, FileMetaStateChange, MaterialsStateChange, MixerStateChangeEvent, NoteStateChange, OpExistenceChanged, OpNode, OpStateEvent, OpStateParamChange, StateChangeEvent } from '../../model/datatypes';
import { StateService } from '../../provider/state.service';
import { TreeService } from '../../provider/tree.service';

@Component({
  selector: 'app-history',
  imports: [
    MatCardModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatDividerModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions
],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss'
})
export class HistoryComponent {
  private stateService = inject(StateService);
  private dialogRef = inject<MatDialogRef<HistoryComponent>>(MatDialogRef);
  private data = inject(MAT_DIALOG_DATA);
  private tree = inject(TreeService);

  historyReversed: Array<{ change: StateChangeEvent, description: string }> = [];
  stateChangeSubscription: Subscription;

  get activeId(): number {
    return this.stateService.active_id;
  }

  ngOnInit() {
    this.updateHistory();
    this.stateChangeSubscription = this.stateService.stateChange$.subscribe(() => {
      this.updateHistory();
    });
  }

  ngOnDestroy() {
    this.stateChangeSubscription.unsubscribe();
  }

  updateHistory() {
    this.historyReversed = this.stateService.history.slice().reverse()
      .map(change => ({ change, description: this.formatStateChange(change) }));
  }

  trackHistory(_, item) { return item.change.id; }



  getStateChangeIcon(originator: string): string {
    switch (originator) {
      case 'DRAFT': return 'texture';
      case 'OP': return 'build';
      case 'CONNECTION': return 'link';
      case 'NOTE': return 'note';
      case 'MATERIALS': return 'palette';
      case 'MIXER': return 'tune';
      default: return 'help';
    }
  }

  getStateChangeIconClass(originator: string): string {
    switch (originator) {
      case 'DRAFT': return 'fa-th';
      case 'OP': return 'fa-cogs';
      case 'CONNECTION': return 'fa-link';
      case 'NOTE': return 'fa-sticky-note';
      case 'MATERIALS': return 'fa-palette';
      case 'MIXER': return 'fa-sliders-h';
      default: return 'fa-question-circle';
    }
  }

  getStateChangeColor(originator: string): string {
    switch (originator) {
      case 'DRAFT': return 'primary';
      case 'OP': return 'accent';
      case 'CONNECTION': return 'warn';
      case 'NOTE': return 'primary';
      case 'MATERIALS': return 'accent';
      case 'MIXER': return 'warn';
      default: return 'primary';
    }
  }


  formatDraftChange(change: DraftStateEvent): string {

    let name = "draft";
    if (change.type == 'CREATED' || change.type == 'REMOVED') {
      const node: DraftNode = (<DraftExistenceChange>change).node as DraftNode;
      name = (node) ? this.tree.getDraftName(node.id) : "draft";
    }

    if (change.type == 'NAME_CHANGE') {
      if (this.tree.getNode((<DraftStateNameChange>change).id) !== null) {
        name = this.tree.getDraftName((<DraftStateNameChange>change).id);
      }
    }

    switch (change.type) {

      case 'MOVE': return 'Moved ' + (<DraftStateMove>change).before + ' to ' + (<DraftStateMove>change).after;
      case 'VALUE_CHANGE': return 'Edited a seed draft or loom associated with ' + name;
      case 'NAME_CHANGE': return 'Changed a Draft Name from ' + (<DraftStateNameChange>change).before + ' to ' + (<DraftStateNameChange>change).after;
      case 'CREATED': return 'Created a Seed Draft';
      case 'REMOVED': return 'Deleted a Seed Draft';
    }
  }

  formatOpChange(change: OpStateEvent): string {
    let name = "operation";
    if (change.type == 'CREATED' || change.type == 'REMOVED') {
      const node: OpNode = (<OpExistenceChanged>change).node as OpNode;
      name = (node) ? node.name : "operation";
    }

    if (change.type == 'PARAM_CHANGE') {
      if (this.tree.getNode((<OpStateParamChange>change).opid) !== null) {
        name = this.tree.getOpNode((<OpStateParamChange>change).opid).name;
      }
    }

    switch (change.type) {
      case 'MOVE': return 'Moved an Operation';
      case 'PARAM_CHANGE': return 'Changed an Operation Parameter for ' + name;
      case 'CREATED': return 'Created a ' + name + ' Operation';
      case 'REMOVED': return 'Deleted an Operation';
    }
  }

  formatConnectionChange(change: ConnectionStateEvent): string {
    switch (change.type) {
      case 'CREATED': return 'Created a Connection';
      case 'REMOVED': return 'Deleted a Connection';
    }
  }

  formatNoteChange(change: NoteStateChange): string {
    switch (change.type) {
      case 'CREATED': return 'Created a Note';
      case 'REMOVED': return 'Deleted a Note';
    }
    return "Edited a Note";
  }

  formatMaterialsChange(change: MaterialsStateChange): string {
    switch (change.type) {
      case 'UPDATED': return 'Updated the Materials';
    }
  }

  formatMixerChange(change: MixerStateChangeEvent): string {
    switch (change.type) {
      case 'PASTE': return 'Pasted a Bunch of Things';
      case 'DELETE': return 'Deleted a Bunch of Things ';
      case 'MOVE': return 'Moved a Bunch of Things';
    }
  }

  formatFileMetaChange(change: FileMetaStateChange): string {
    console.log("FORMATTING FILE META CHANGE", change);
    switch (change.type) {
      case 'META_CHANGE': return 'changed the workspace name or description';
    }
  }

  formatStateChange(change: StateChangeEvent): string {
    const originator = change.originator;
    switch (originator) {
      case 'DRAFT': return this.formatDraftChange(<DraftStateChange>change);
      case 'OP': return this.formatOpChange(<OpStateEvent>change);
      case 'CONNECTION': return this.formatConnectionChange(<ConnectionStateEvent>change);
      case 'NOTE': return this.formatNoteChange(<NoteStateChange>change);
      case 'MATERIALS': return this.formatMaterialsChange(<MaterialsStateChange>change);
      case 'MIXER': return this.formatMixerChange(<MixerStateChangeEvent>change);
      case 'FILEMETA': return this.formatFileMetaChange(<FileMetaStateChange>change);
    }



    return originator;
  }

  undo(): void {
    this.stateService.undo();
  }

  redo(): void {
    // Note: The state service doesn't have a public redo method
    // This would need to be implemented in the state service
  }

  clearHistory(): void {
    this.stateService.clearTimeline();
  }

  closeDialog(): void {
    this.dialogRef.close();
  }
}
