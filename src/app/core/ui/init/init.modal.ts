import { Component, OnInit, Input, ViewChild, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent } from "@angular/material/dialog";
import { DesignmodesService } from '../../provider/designmodes.service';
import { HttpClient } from '@angular/common/http';
import {AuthService} from '../../provider/auth.service'
import {FileService} from '../../provider/file.service'
import { getAnalytics, logEvent } from "@angular/fire/analytics";
import { BlankdraftModal } from '../blankdraft/blankdraft.modal';
import { MatIconButton } from '@angular/material/button';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { FormsModule } from '@angular/forms';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/autocomplete';
import { LoadfileComponent } from '../loadfile/loadfile.component';
import { ExamplesComponent } from '../examples/examples.component';

interface StartOptions {
  value: string;
  viewValue: string;
  mixeronly: boolean;
}


@Component({
    selector: 'app-init',
    templateUrl: './init.modal.html',
    styleUrls: ['./init.modal.scss'],
    imports: [MatIconButton, MatDialogTitle, CdkScrollable, MatDialogContent, FormsModule, MatFormField, MatLabel, MatSelect, MatOption, BlankdraftModal, LoadfileComponent, ExamplesComponent]
})




export class InitModal implements OnInit {
  private fls = inject(FileService);
  private auth = inject(AuthService);
  private dm = inject(DesignmodesService);
  private http = inject(HttpClient);
  private dialogRef = inject<MatDialogRef<InitModal>>(MatDialogRef);
  private data = inject(MAT_DIALOG_DATA);



  @ViewChild(BlankdraftModal, {static: true}) blankdraft;


  opts: StartOptions[] = [
      {value: 'example', viewValue: 'Browse Examples', mixeronly: true},
      {value: 'ada', viewValue: 'Open an AdaCAD (.ada) File from you Computer', mixeronly: true},
     // {value: 'bmp', viewValue: 'Two Color Image (.bmp, .jpg, .png) File', mixeronly: false},
      // {value: 'wif', viewValue: 'WIF (.wif) File', mixeronly: false},   
      {value: 'blank', viewValue: 'Open an Empty Workspace', mixeronly: false},
      {value: 'new', viewValue: 'Create a Blank Draft', mixeronly: false}
    ];

  import_opts: StartOptions[] = [];

  //form: any = {};
  selected:string = null;
  valid:boolean = false; 
  mixer_envt: any; 
  source: string; 
  // result: LoadResponse;

  new_draft: boolean = false;


  constructor() {
      const data = this.data;

      this.source = data.source;
      this.import_opts = this.opts.filter(el => !el.mixeronly)

  }

  ngOnInit() {
    if(this.data.source === "newdraft") this.new_draft = true;
  }


  selectionMade(selection: any){
    if(selection === 'blank') this.dialogRef.close({
      data: null,
      status: -1
    });
  }



 

  close(): void {
    this.dialogRef.close(null);
  }

 
  onNoClick(): void {
    this.dialogRef.close(null);
  }

  // newDraftCreated(f) {

  //   console.log("SAVE CALLED", f)

  //   return this.fls.loader.form(f)
  //       .then(
  //         res => this.dialogRef.close(res)
  //       );
  // }




}
