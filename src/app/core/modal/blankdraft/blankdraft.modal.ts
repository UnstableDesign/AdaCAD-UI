import { Component, EventEmitter, Inject, OnInit, Output } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Draft, Loom, LoomSettings } from '../../model/datatypes';
import { defaults } from '../../model/defaults';
import { initDraftWithParams } from '../../model/drafts';
import { WorkspaceService } from '../../provider/workspace.service';
import { getLoomUtilByType } from '../../model/looms';

@Component({
  selector: 'app-blankdraft',
  templateUrl: './blankdraft.modal.html',
  styleUrls: ['./blankdraft.modal.scss']
})
export class BlankdraftModal implements OnInit {

  
  valid:boolean = false; 
  wefts: number;
  warps: number;

  
  @Output() onNewDraftCreated = new EventEmitter <any>(); 



  constructor(
    private ws: WorkspaceService,
    private dialogRef: MatDialogRef<BlankdraftModal>, 
    @Inject(MAT_DIALOG_DATA) private data: any) {
     

  }

  ngOnInit() {
  }

  close(): void {

     this.createDraftAndClose();
  }

 
  onNoClick(): void {
     this.createDraftAndClose();

  }

  createDraftAndClose(){
    const draft: Draft = initDraftWithParams({wefts: this.wefts, warps: this.warps});
    console.log("DRAFT INIT ", draft)

    const loom_settings: LoomSettings = {
      treadles: this.ws.min_treadles,
      frames: this.ws.min_frames,
      type: this.ws.type,
      epi: this.ws.epi,
      units:<"in"|"cm"> this.ws.units
    };


    const loom_utils = getLoomUtilByType(this.ws.type);
    loom_utils.computeLoomFromDrawdown(draft.drawdown, null, loom_settings)
    .then((loom) => {
      console.log("RETURNED FROM COMPUTE LOOM ", loom)
      this.dialogRef.close({draft, loom, loom_settings});

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
