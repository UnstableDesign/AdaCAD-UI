import { Component, EventEmitter, Output, inject } from '@angular/core';
import { WelcomeComponent } from '../welcome/welcome.component';
import { MatDialogRef, MatDialogTitle, MatDialogContent } from '@angular/material/dialog';
import { WorkspaceService } from '../../provider/workspace.service';
import { density_units, loom_types, origin_option_list } from '../../model/defaults';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';
import { MatRadioGroup, MatRadioButton } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatSlideToggle } from '@angular/material/slide-toggle';

@Component({
    selector: 'app-workspace',
    templateUrl: './workspace.component.html',
    styleUrl: './workspace.component.scss',
    imports: [MatDialogTitle, CdkScrollable, MatDialogContent, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatRadioGroup, FormsModule, MatRadioButton, MatButton, MatSlideToggle]
})



export class WorkspaceComponent {
  ws = inject(WorkspaceService);
  dialogRef = inject<MatDialogRef<WelcomeComponent>>(MatDialogRef);


  @Output() onLoomTypeOverride = new EventEmitter <any>(); 
  @Output() onDensityUnitOverride = new EventEmitter <any>(); 
  @Output() onOptimizeWorkspace = new EventEmitter <any>(); 
  @Output() onAdvanceOpsChange = new EventEmitter <any>(); 
  @Output() onDraftVisibilityChange = new EventEmitter<any>();
  @Output() onOperationSettingsChange = new EventEmitter<any>();

  unitOptions: any;
  originOptions: any;
  loomOptions: any;

 constructor() { 
    
    this.unitOptions = density_units;
    this.loomOptions = loom_types;
    this.originOptions = origin_option_list;
 }

 optimizeWorkspace(){   
    this.onOptimizeWorkspace.emit();
}

setAdvancedOperations(val: boolean){
  this.ws.show_advanced_operations = val;
  this.onAdvanceOpsChange.emit();
}

setDraftsViewable(){
  //redraw the mixer
  this.onDraftVisibilityChange.emit();
}

overrideLoomType(){
  this.onLoomTypeOverride.emit();
}

forceJacquard(){
  this.ws.type =  'jacquard';
  this.overrideLoomType();
}

overrideDensityUnits(){
  this.onDensityUnitOverride.emit();
}

operationSettingsChange(){
  this.onOperationSettingsChange.emit();
}

hideDrafts(){
  this.ws.hide_mixer_drafts = true;
  this.setDraftsViewable();
}

setJacquardThreshold(value: number){
  console.log("VALUE", value);
  this.ws.force_jacquard_threshold = value;
}

 

}
