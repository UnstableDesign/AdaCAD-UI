import { Component, OnInit, inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';
import { Bounds } from '../../../core/model/datatypes';


@Component({
    selector: 'app-snackbar',
    templateUrl: './snackbar.component.html',
    styleUrls: ['./snackbar.component.scss']
})
export class SnackbarComponent implements OnInit {
  data = inject(MAT_SNACK_BAR_DATA);


  bounds: Bounds;
  message: string;
  scale: number;

  constructor() {
    const data = this.data;
 
    this.bounds = data.bounds;
    this.message = data.message;
    this.scale = data.scale;
  }

  ngOnInit() {
  }

}
