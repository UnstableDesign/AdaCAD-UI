import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatError, MatInput } from '@angular/material/input';
import { defaults } from '../../model/defaults';
@Component({
  selector: 'app-blankdraft',
  templateUrl: './blankdraft.modal.html',
  styleUrls: ['./blankdraft.modal.scss'],
  imports: [MatDialogTitle, CdkScrollable, MatError, MatDialogContent, FormsModule, MatFormField, MatLabel, MatInput, MatDialogActions, MatButton, MatDialogClose, ReactiveFormsModule]
})
export class BlankdraftModal implements OnInit {
  private dialogRef = inject<MatDialogRef<BlankdraftModal>>(MatDialogRef);
  public warps = new FormControl(defaults.warps, [Validators.required, Validators.min(1)]);
  public wefts = new FormControl(defaults.wefts, [Validators.required, Validators.min(1)]);



  valid: boolean = false;


  @Output() onNewDraftCreated = new EventEmitter<any>();

  ngOnInit() {
  }

  close(): void {

  }


  onNoClick(): void {

  }

  save() {

    console.log("SAVE CALLED")
    //if the INIT form parent is listening, it gets the entire form
    this.onNewDraftCreated.emit({ warps: this.warps.value, wefts: this.wefts.value });
    this.dialogRef.close();
  }




}
