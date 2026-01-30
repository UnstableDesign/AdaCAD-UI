import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { density_units, loom_types, origin_option_list } from '../../model/defaults';
import { WorkspaceService } from '../../provider/workspace.service';
import { WelcomeComponent } from '../welcome/welcome.component';

@Component({
  selector: 'app-workspace',
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss',
  imports: [MatDialogTitle, ReactiveFormsModule, MatLabel, CdkScrollable, MatFormField, MatHint, MatInput, MatDialogContent, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatRadioGroup, MatRadioButton, MatButton, MatSlideToggle]
})



export class WorkspaceComponent implements OnInit {
  ws = inject(WorkspaceService);
  dialogRef = inject<MatDialogRef<WelcomeComponent>>(MatDialogRef);


  @Output() onLoomTypeOverride = new EventEmitter<any>();
  @Output() onDensityUnitOverride = new EventEmitter<any>();
  @Output() onOptimizeWorkspace = new EventEmitter<any>();
  @Output() onAdvanceOpsChange = new EventEmitter<any>();
  @Output() onDraftVisibilityChange = new EventEmitter<any>();
  @Output() onOperationSettingsChange = new EventEmitter<any>();
  @Output() onOversizeRenderingChange = new EventEmitter<any>();
  @Output() onMaxAreaChange = new EventEmitter<any>();
  @Output() onOriginChange = new EventEmitter<any>();

  unitOptions: any;
  originOptions: any;
  loomOptions: any;

  oversizeDimForm: FormControl;
  maxAreaForm: FormControl;
  originOptionForm: FormControl;
  loomTypeForm: FormControl;
  unitsForm: FormControl;
  hideMixerDraftsForm: FormControl;
  showAdvancedOperationsForm: FormControl;

  constructor() {

    this.unitOptions = density_units;
    this.loomOptions = loom_types;
    this.originOptions = origin_option_list;
  }

  ngOnInit() {

    this.oversizeDimForm = new FormControl(this.ws.oversize_dim_threshold, [Validators.required]);
    this.maxAreaForm = new FormControl(this.ws.max_draft_input_area, [Validators.required]);
    this.originOptionForm = new FormControl(this.ws.selected_origin_option);
    this.loomTypeForm = new FormControl(this.ws.type);
    this.unitsForm = new FormControl(this.ws.units);
    this.hideMixerDraftsForm = new FormControl(this.ws.hide_mixer_drafts);
    this.showAdvancedOperationsForm = new FormControl(this.ws.show_advanced_operations);

    // Subscribe to form changes
    this.originOptionForm.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.ws.selected_origin_option = value;
        this.onOriginChange.emit();
      }
    });

    this.loomTypeForm.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.ws.type = value;
        this.onLoomTypeOverride.emit(value);
      }
    });

    this.unitsForm.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.ws.units = value;
        this.overrideDensityUnits();
      }
    });

    this.hideMixerDraftsForm.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.ws.hide_mixer_drafts = value;
        this.setDraftsViewable();
      }
    });

    this.showAdvancedOperationsForm.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.ws.show_advanced_operations = value;
        this.operationSettingsChange();
      }
    });

  }


  updateOversizeDim(value) {
    this.ws.setOversizeRendering(value);
    this.onOversizeRenderingChange.emit();
    this.oversizeDimForm.markAsPristine();
    this.oversizeDimForm.markAsUntouched();

  }

  updateMaxArea(value) {
    this.ws.setCurrentDraftSizeLimit(value);
    this.onMaxAreaChange.emit();
    this.maxAreaForm.markAsPristine();
    this.maxAreaForm.markAsUntouched();
  }

  optimizeWorkspace() {
    this.onOptimizeWorkspace.emit();
  }

  setAdvancedOperations(val: boolean) {
    this.showAdvancedOperationsForm.setValue(val, { emitEvent: false });
    this.ws.show_advanced_operations = val;
    this.onAdvanceOpsChange.emit();
  }

  setDraftsViewable() {
    //redraw the mixer
    this.onDraftVisibilityChange.emit();
  }

  overrideLoomType() {
    this.onLoomTypeOverride.emit();
  }

  forceJacquard() {
    this.loomTypeForm.setValue('jacquard', { emitEvent: false });
    this.ws.type = 'jacquard';
    this.overrideLoomType();
  }

  overrideDensityUnits() {
    this.onDensityUnitOverride.emit();
  }

  operationSettingsChange() {
    this.onOperationSettingsChange.emit();
  }

  hideDrafts() {
    this.hideMixerDraftsForm.setValue(true, { emitEvent: false });
    this.ws.hide_mixer_drafts = true;
    this.setDraftsViewable();
  }

  setJacquardThreshold(value: number) {
    this.ws.force_jacquard_threshold = value;
  }



}
