import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { Draft, initDraftWithParams, LoomSettings } from 'adacad-drafting-lib';
import { getLoomUtilByType } from 'adacad-drafting-lib/loom';
import { WorkspaceService } from '../../provider/workspace.service';

@Component({
  selector: 'app-blankdraft',
  templateUrl: './blankdraft.modal.html',
  styleUrls: ['./blankdraft.modal.scss'],
  imports: [MatDialogTitle, CdkScrollable, MatDialogContent, FormsModule, MatFormField, MatLabel, MatInput, MatDialogActions, MatButton, MatDialogClose]
})
export class BlankdraftModal implements OnInit {
  private ws = inject(WorkspaceService);
  private dialogRef = inject<MatDialogRef<BlankdraftModal>>(MatDialogRef);
  private data = inject(MAT_DIALOG_DATA);



  valid: boolean = false;
  wefts: number;
  warps: number;


  @Output() onNewDraftCreated = new EventEmitter<any>();

  ngOnInit() {
  }

  close(): void {

    this.createDraftAndClose();
  }


  onNoClick(): void {
    this.createDraftAndClose();

  }

  createDraftAndClose() {
    const draft: Draft = initDraftWithParams({ wefts: this.wefts, warps: this.warps });

    const loom_settings: LoomSettings = {
      treadles: this.ws.min_treadles,
      frames: this.ws.min_frames,
      type: this.ws.type,
      epi: this.ws.epi,
      units: <"in" | "cm">this.ws.units
    };


    const loom_utils = getLoomUtilByType(this.ws.type);
    loom_utils.computeLoomFromDrawdown(draft.drawdown, loom_settings)
      .then((loom) => {
        this.dialogRef.close({ draft, loom, loom_settings });

      })





  }

  /**
 * called when the init form is complete 
 *  */

  save(f) {

    console.log("SAVE CALLED")
    //if the INIT form parent is listening, it gets the entire form
    this.onNewDraftCreated.emit(f);

    //Otherwise, the dialog ref will just return the new draft to add to the palette
    this.createDraftAndClose();


  }




}
