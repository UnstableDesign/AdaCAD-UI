import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

@Component({
  selector: 'app-loading',
  imports: [MatDialogTitle, MatDialogContent],
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.scss'
})
export class LoadingComponent {

  name: string = '';
  data = inject(MAT_DIALOG_DATA);
  dialogRef = inject<MatDialogRef<LoadingComponent>>(MatDialogRef);


  constructor() {
    this.name = this.data.name;
  }

}
