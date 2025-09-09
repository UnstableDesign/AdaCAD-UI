import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { Draft } from 'adacad-drafting-lib/draft';
import { TreeService } from '../../provider/tree.service';

@Component({
  selector: 'app-rename',
  templateUrl: './rename.component.html',
  styleUrl: './rename.component.scss',
  imports: [MatDialogTitle, CdkScrollable, MatDialogContent, MatFormField, MatLabel, MatInput, FormsModule, MatHint, MatDialogActions, MatButton, MatDialogClose]
})
export class RenameComponent {
  private tree = inject(TreeService);
  private dialogRef = inject<MatDialogRef<RenameComponent>>(MatDialogRef);
  private data = inject(MAT_DIALOG_DATA);


  id: number;
  ud_name: string;
  gen_name: string;
  draft: Draft = null
  constructor() {
    const data = this.data;


    this.id = data.id;
    this.draft = this.tree.getDraft(this.id);
    this.ud_name = this.draft.ud_name;
    this.gen_name = this.draft.gen_name;




  }

  change(event: SimpleChanges) {
    this.draft.ud_name = this.ud_name;
    this.tree.setDraftOnly(this.id, this.draft);
  }

}
