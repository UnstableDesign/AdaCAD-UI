import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { Draft } from 'adacad-drafting-lib/draft';
import { DraftNodeBroadcastFlags, DraftStateNameOrNotesChange } from '../../model/datatypes';
import { StateService } from '../../provider/state.service';
import { TreeService } from '../../provider/tree.service';

@Component({
  selector: 'app-rename',
  templateUrl: './rename.component.html',
  styleUrl: './rename.component.scss',
  imports: [MatDialogTitle, ReactiveFormsModule, CdkScrollable, MatDialogContent, MatFormField, MatLabel, MatInput, MatDialogActions, MatButton, MatDialogClose]
})
export class RenameComponent {
  private tree = inject(TreeService);
  private dialogRef = inject<MatDialogRef<RenameComponent>>(MatDialogRef);
  private data = inject(MAT_DIALOG_DATA);
  private state = inject(StateService);

  id: number;
  ud_name: string;
  gen_name: string;
  draft: Draft = null
  notes: string;
  nameForm = new FormControl('');
  notesForm = new FormControl('');
  constructor() {
    const data = this.data;


    this.id = data.id;
    this.draft = this.tree.getDraft(this.id);
    this.ud_name = this.draft.ud_name;
    this.gen_name = this.draft.gen_name;
    this.notes = this.draft.notes || '';



  }

  ngOnInit() {
    this.nameForm.setValue(this.ud_name, { emitEvent: false });
    this.notesForm.setValue(this.notes, { emitEvent: false });

    this.nameForm.valueChanges.subscribe(value => {
      this.nameForm.markAsDirty();
    });

    this.notesForm.valueChanges.subscribe(value => {
      this.notesForm.markAsDirty();
    });



  }

  save() {

    let beforeName = this.tree.getDraftName(this.id);
    let beforeNotes = this.tree.getDraftNotes(this.id);

    this.tree.getDraft(this.id).ud_name = this.nameForm.value;
    this.tree.getDraft(this.id).notes = this.notesForm.value;



    this.state.addStateChange(<DraftStateNameOrNotesChange>{
      originator: 'DRAFT',
      type: 'NAME_OR_NOTES_CHANGE',
      id: this.id,
      before: { name: beforeName, notes: beforeNotes },
      after: { name: this.nameForm.value, notes: this.notesForm.value }
    });



    this.draft.ud_name = this.nameForm.value;
    this.draft.notes = this.notesForm.value;
    const flags: DraftNodeBroadcastFlags = {
      meta: true,
      draft: false,
      loom: false,
      loom_settings: false,
      materials: false
    };
    this.tree.setDraft(this.id, this.draft, flags, true, true);

    this.dialogRef.close();
    this.nameForm.markAsPristine();
    this.notesForm.markAsPristine();
  }

}
