import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog";

import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { ElementRef, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormControl } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteSelectedEvent, MatAutocompleteTrigger, MatOption } from '@angular/material/autocomplete';
import { MatIconButton, MatMiniFabButton } from '@angular/material/button';
import { MatChipGrid, MatChipInput, MatChipInputEvent, MatChipRemove, MatChipRow } from '@angular/material/chips';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { System } from 'adacad-drafting-lib';
import { defaults } from '../../core/model/defaults';
import { MaterialsService } from '../../core/provider/materials.service';
import { SystemsService } from '../../core/provider/systems.service';

@Component({
  selector: 'app-repeats',
  templateUrl: './repeats.component.html',
  styleUrls: ['./repeats.component.scss'],
  imports: [MatIconButton, MatDialogTitle, CdkDrag, CdkDragHandle, CdkScrollable, MatDialogContent, MatMiniFabButton, MatTooltip, MatIcon, MatFormField, MatLabel, MatChipGrid, MatChipRow, MatChipRemove, FormsModule, MatAutocompleteTrigger, MatChipInput, ReactiveFormsModule, MatAutocomplete, MatOption]
})



export class RepeatsComponent implements OnInit {
  ms = inject(MaterialsService);
  ss = inject(SystemsService);
  private dialogRef = inject<MatDialogRef<RepeatsComponent>>(MatDialogRef);
  data = inject(MAT_DIALOG_DATA);


  id: number;

  rowSystemMapping: Array<number>;
  colSystemMapping: Array<number>;
  rowShuttleMapping: Array<number>;
  colShuttleMapping: Array<number>;

  //chip params
  visible = true;
  selectable = true;
  removable = true;
  separatorKeysCodes: number[] = [ENTER, COMMA];

  system_codes = defaults.weft_system_codes;


  warpSystemCtrl = new UntypedFormControl();
  // warp_systems_pattern_strings: string[] = [];
  // allWarpSystems: string[] = [];


  weftSystemCtrl = new UntypedFormControl();
  // weft_systems_pattern_strings: string[] = [];
  // allWeftSystems: string[] = [];

  warpShuttleCtrl = new UntypedFormControl();
  // warp_shuttles_pattern_strings: any[] = [];
  // allWarpShuttles: any[] = [];

  weftShuttleCtrl = new UntypedFormControl();
  // weft_shuttles_pattern_strings: any[] = [];
  // allWeftShuttles: any[] = [];

  // fruits: string[] = ['Lemon'];
  // allFruits: string[] = ['Apple', 'Lemon', 'Lime', 'Orange', 'Strawberry'];

  @ViewChild('warpSystemInput') warpSystemInput: ElementRef<HTMLInputElement>;
  @ViewChild('weftSystemInput') weftSystemInput: ElementRef<HTMLInputElement>;
  @ViewChild('warpShuttleInput') warpShuttleInput: ElementRef<HTMLInputElement>;
  @ViewChild('weftShuttleInput') weftShuttleInput: ElementRef<HTMLInputElement>;

  @ViewChild('auto_wasy') matAutocompleteWasy: MatAutocomplete;
  @ViewChild('auto_wesy') matAutocompleteWesy: MatAutocomplete;
  @ViewChild('auto_wash') matAutocompleteWash: MatAutocomplete;
  @ViewChild('auto_wesh') matAutocompleteWesh: MatAutocomplete;


  @Output() onUpdateWarpSystems: any = new EventEmitter();
  @Output() onUpdateWeftSystems: any = new EventEmitter();
  @Output() onUpdateWarpShuttles: any = new EventEmitter();
  @Output() onUpdateWeftShuttles: any = new EventEmitter();


  constructor() {
    const data = this.data;


    this.id = data.id;


  }

  ngOnInit() {


    this.colShuttleMapping = this.ms.getShuttles().map(el => el.id);
    this.rowShuttleMapping = this.ms.getShuttles().map(el => el.id);

    this.rowSystemMapping = this.ss.weft_systems
      .filter(el => el.in_use)
      .map(el => el.id);

    this.colSystemMapping = this.ss.warp_systems
      .filter(el => el.in_use)
      .map(el => el.id);


  }

  getWarpSystems(): Array<System> {
    return this.ss.warp_systems;
  }

  idFromString(s: string) {
    console.log(s);
    return s.charCodeAt(0) - 97;
  }

  shuttleIdFromName(s: string): number {


    for (var i = 0; i < this.ms.getShuttles().length; i++) {
      let s_name = this.ms.getShuttle(i).name.toLowerCase();
      if (s_name.localeCompare(s.toLowerCase()) === 0) return i;
    }
    return -1;
  }

  add(event: MatChipInputEvent): void {


    const input = event.input;
    const value = event.value;
    const name = input.name;

    console.log("adding to ", name);
    let shuttle_id = this.shuttleIdFromName((value || '').trim());


    switch (name) {
      case 'wasy':

        let warp_sys_id = parseInt(value) - 1;
        console.log("value is ", warp_sys_id);
        if (warp_sys_id >= 0 && warp_sys_id < this.ss.warp_systems.length) {
          console.log("adding ", warp_sys_id, "to", this.colSystemMapping)
          this.colSystemMapping.push(warp_sys_id);
          console.log("now ", this.colSystemMapping)

        }
        this.warpSystemCtrl.setValue(null);

        break;

      case 'wash':
        console.log("value is ", this.shuttleIdFromName(value.trim()));

        if ((value || '').trim() && shuttle_id != -1) {
          // let all = {
          //   id: shuttle_id,
          //   color: this.shuttles[shuttle_id].getColor(),
          //   name: this.shuttles[shuttle_id].getName()
          // }
          this.colShuttleMapping.push(shuttle_id);
        }
        this.warpShuttleCtrl.setValue(null);

        break;

      case 'wesy':

        let weft_sys_id = this.idFromString((value || '').trim());
        if (weft_sys_id >= 0 && weft_sys_id < this.ss.warp_systems.length) {
          this.rowSystemMapping.push(weft_sys_id);
        }
        this.weftSystemCtrl.setValue(null);
        break;

      case 'wesh':
        console.log("value is ", this.shuttleIdFromName(value.trim()));

        if ((value || '').trim() && shuttle_id != -1) {
          // let all = {
          //   id: shuttle_id,
          //   color: this.shuttles[shuttle_id].getColor(),
          //   name: this.shuttles[shuttle_id].getName()
          // }
          this.rowShuttleMapping.push(shuttle_id);
        }
        this.weftShuttleCtrl.setValue(null);


        break;
    }



    // Reset the input value
    if (input) {
      input.value = '';
    }


    //this.onUpdateWarpSystems.emit(this.warp_systems_pattern_strings);

  }

  remove(caller: string, index: number): void {

    switch (caller) {
      case 'wasy':

        if (index >= 0 && this.colSystemMapping.length > 1) {
          this.colSystemMapping.splice(index, 1);
        }


        break;

      case 'wash':

        if (index >= 0 && this.colShuttleMapping.length > 1) {
          this.colShuttleMapping.splice(index, 1);
        }


        break;

      case 'wesy':


        if (index >= 0 && this.rowSystemMapping.length > 1) {
          this.rowSystemMapping.splice(index, 1);
        }

        break;

      case 'wesh':

        if (index >= 0 && this.rowShuttleMapping.length > 1) {
          this.rowShuttleMapping.splice(index, 1);
        }
        break;
    }

  }

  sendUpdates(source: string) {
    console.log("send updates", source);
    switch (source) {
      case 'wasy':
        this.onUpdateWarpSystems.emit(this.colSystemMapping);
        break;

      case 'wash':
        this.onUpdateWarpShuttles.emit(this.colShuttleMapping);
        break;

      case 'wesy':
        this.onUpdateWeftSystems.emit(this.rowSystemMapping);
        break;

      case 'wesh':
        this.onUpdateWeftShuttles.emit(this.rowShuttleMapping);
        break;
    }

  }

  selected(source: string, event: MatAutocompleteSelectedEvent): void {
    console.log("selected", source);
    switch (source) {
      case 'wasy':
        let warp_sys_id = parseInt(event.option.viewValue) - 1;

        this.colSystemMapping.push(warp_sys_id);
        this.warpSystemCtrl.setValue(null);
        break;

      case 'wash':

        let warp_id = this.shuttleIdFromName(event.option.viewValue);

        // let warp_obj = {
        //   id: warp_id, 
        //   name: this.shuttles[warp_id].getName(), 
        //   color: this.shuttles[warp_id].getColor()
        // };

        this.colShuttleMapping.push(warp_id);
        this.warpShuttleCtrl.setValue(null);

        break;

      case 'wesy':
        let weft_sys_id = this.idFromString(event.option.viewValue);
        this.rowSystemMapping.push(weft_sys_id);
        this.weftSystemCtrl.setValue(null);
        break;

      case 'wesh':


        let weft_id = this.shuttleIdFromName(event.option.viewValue);

        // let weft_obj = {
        //   id: weft_id, 
        //   name: this.shuttles[weft_id].getName(), 
        //   color: this.shuttles[weft_id].getColor()
        // };

        this.rowShuttleMapping.push(weft_id);
        this.weftShuttleCtrl.setValue(null);
        break;
    }




  }

  close() {
    this.dialogRef.close(null);
  }





}
