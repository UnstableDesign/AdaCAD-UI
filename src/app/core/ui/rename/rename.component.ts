import { Component, SimpleChanges, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatHint } from '@angular/material/form-field';
import { TreeService } from '../../provider/tree.service';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { Draft } from 'adacad-drafting-lib/objects/datatypes.ts';

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
  draft:Draft = null
 constructor() {
      const data = this.data;

      
      this.id = data.id;
      this.draft = this.tree.getDraft(this.id);
      this.ud_name = this.draft.ud_name;
      this.gen_name = this.draft.gen_name; 

      
    
    
    }

    change(event: SimpleChanges){
      this.draft.ud_name = this.ud_name;
      this.tree.setDraftOnly(this.id, this.draft);
    }

}
