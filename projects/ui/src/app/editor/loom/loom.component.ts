import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatOption } from '@angular/material/autocomplete';
import { MatDivider } from '@angular/material/divider';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { LoomSettings } from 'adacad-drafting-lib';
import { deleteDrawdownCol, deleteDrawdownRow, deleteMappingCol, deleteMappingRow, Draft, insertDrawdownCol, insertDrawdownRow, insertMappingCol, insertMappingRow, warps, wefts } from 'adacad-drafting-lib/draft';
import { calcLength, calcWidth, convertLoom, copyLoomSettings, generateDirectTieup, getLoomUtilByType, Loom, numFrames, numTreadles } from 'adacad-drafting-lib/loom';
import { Subscription } from 'rxjs';
import { DraftNode, DraftNodeBroadcastFlags, DraftNodeState, DraftStateChange } from '../../core/model/datatypes';
import { defaults, density_units, loom_types } from '../../core/model/defaults';
import { StateService } from '../../core/provider/state.service';
import { TreeService } from '../../core/provider/tree.service';
import { WorkspaceService } from '../../core/provider/workspace.service';
import { DraftRenderingComponent } from '../../core/ui/draft-rendering/draft-rendering.component';

@Component({
  selector: 'app-loom',
  templateUrl: './loom.component.html',
  styleUrls: ['./loom.component.scss'],
  imports: [ReactiveFormsModule, MatFormField, MatLabel, MatSelect, MatOption, MatInput, MatSuffix, MatDivider]
})
export class LoomComponent implements OnInit, OnDestroy {
  private tree = inject(TreeService);
  private fb = inject(FormBuilder);
  ws = inject(WorkspaceService);
  ss = inject(StateService);

  @Input('id') id;
  @Input('draftRendering') draftRendering: DraftRenderingComponent;

  @Output() unsetSelection: any = new EventEmitter();
  // @Output() drawdownUpdated: any = new EventEmitter();

  loomForm: FormGroup;
  density_units;
  loomtypes;
  enabled: boolean = false;
  before: DraftNodeState;
  required_frames: number = defaults.loom_settings.frames;
  required_treadles: number = defaults.loom_settings.treadles;

  draftValueChangeSubscription: Subscription;
  view_only: boolean = false;



  constructor() {
    this.density_units = density_units;
    this.loomtypes = loom_types;
    this.initializeForm();
  }

  ngOnInit() {
    // Form initialization is handled in constructor
  }

  ngOnDestroy() {
    // Cleanup if needed
    if (this.draftValueChangeSubscription) this.draftValueChangeSubscription.unsubscribe();
  }

  private initializeForm() {
    this.loomForm = this.fb.group({
      loomtype: [defaults.loom_settings.type, Validators.required],
      warps: [defaults.warps, [Validators.required, Validators.min(1), Validators.max(100000)]],
      wefts: [defaults.wefts, [Validators.required, Validators.min(1), Validators.max(100000)]],
      units: [defaults.loom_settings.units, Validators.required],
      epi: [defaults.loom_settings.epi, [Validators.required, Validators.min(0)]],
      width: [0, [Validators.min(0), Validators.max(2000)]],
      ppi: [defaults.loom_settings.ppi, [Validators.required, Validators.min(0)]],
      length: [0, [Validators.min(0), Validators.max(2000)]],
      frames: [defaults.loom_settings.frames, [Validators.required, Validators.min(2), Validators.max(1000)]],
      treadles: [defaults.loom_settings.treadles, [Validators.required, Validators.min(2), Validators.max(1000)]]
    });

    // Subscribe to form changes
    this.loomForm.get('loomtype')?.valueChanges.subscribe(value => this.onLoomTypeChange(value));
    this.loomForm.get('warps')?.valueChanges.subscribe(value => this.onWarpsChange(value));
    this.loomForm.get('wefts')?.valueChanges.subscribe(value => this.onWeftsChange(value));
    this.loomForm.get('units')?.valueChanges.subscribe(value => this.onUnitsChange(value));
    this.loomForm.get('epi')?.valueChanges.subscribe(value => this.onEpiChange(value));
    this.loomForm.get('width')?.valueChanges.subscribe(value => this.onWidthChange(value));
    this.loomForm.get('ppi')?.valueChanges.subscribe(value => this.onPpiChange(value));
    this.loomForm.get('length')?.valueChanges.subscribe(value => this.onLengthChange(value));
    this.loomForm.get('frames')?.valueChanges.subscribe(value => this.onFramesChange(value));
    this.loomForm.get('treadles')?.valueChanges.subscribe(value => this.onTreadlesChange(value));

  }

  loadLoom(id: number, view_only: boolean) {
    this.id = id;
    this.view_only = view_only;
    let draftNode = this.tree.getNode(this.id) as DraftNode;
    this.before = this.tree.getDraftNodeState(this.id);

    if (this.draftValueChangeSubscription) this.draftValueChangeSubscription.unsubscribe();
    this.draftValueChangeSubscription = draftNode.onValueChange.subscribe(el => {
      this.updateFormValues(el.draft, el.loom, el.loom_settings);
    });

    this.updateFormValues();
  }



  addStateChange() {
    if (this.id == -1) return;
    const change: DraftStateChange = {
      originator: 'DRAFT',
      type: 'VALUE_CHANGE',
      id: this.id,
      before: this.before,
      after: this.tree.getDraftNodeState(this.id)
    }
    this.ss.addStateChange(change);
  }


  /**
   * called when a change occured that would affect the form values, patches the form values in emitting no events. 
   * @param draft 
   * @param loom 
   * @param loom_settings 
   */
  private updateFormValues(draft?: Draft, loom?: Loom, loom_settings?: LoomSettings) {

    if (!draft) draft = this.tree.getDraft(this.id);
    if (!loom) loom = this.tree.getLoom(this.id);
    if (!loom_settings) loom_settings = this.tree.getLoomSettings(this.id);

    if (this.loomForm) {
      const widthValue = (draft !== null && loom_settings) ? calcWidth(draft.drawdown, loom_settings) : 0;
      const lengthValue = (draft !== null && loom_settings) ? calcLength(draft.drawdown, loom_settings) : 0;

      this.loomForm.patchValue({
        loomtype: (loom_settings !== null) ? loom_settings.type : defaults.loom_settings.type,
        warps: (draft !== null) ? warps(draft.drawdown) : 0,
        wefts: (draft !== null) ? wefts(draft.drawdown) : 0,
        units: (loom_settings !== null) ? loom_settings.units : defaults.loom_settings.units,
        epi: (loom_settings !== null) ? loom_settings.epi : defaults.loom_settings.epi,
        width: parseFloat(widthValue.toFixed(3)),
        ppi: (loom_settings !== null) ? loom_settings.ppi : defaults.loom_settings.ppi,
        length: parseFloat(lengthValue.toFixed(3)),
        frames: loom_settings.frames,
        treadles: loom_settings.treadles
      }, { emitEvent: false })


      if (loom_settings.type !== 'jacquard' && loom !== null) {
        this.required_frames = numFrames(loom);
        this.required_treadles = numTreadles(loom);
      } else {
        this.required_frames = 0;
        this.required_treadles = 0;
      }

      if (loom == null || loom_settings.type == 'jacquard') {
        this.loomForm.get('frames')?.disable({ emitEvent: false });
        this.loomForm.get('treadles')?.disable({ emitEvent: false });
      } else {
        this.loomForm.get('frames')?.enable({ emitEvent: false });
        this.loomForm.get('treadles')?.enable({ emitEvent: false });
      }

      if (this.view_only) {
        this.loomForm.get('warps')?.disable({ emitEvent: false });
        this.loomForm.get('wefts')?.disable({ emitEvent: false });
        this.loomForm.get('width')?.disable({ emitEvent: false });
        this.loomForm.get('length')?.disable({ emitEvent: false });
      }
      else {
        this.loomForm.get('warps')?.enable({ emitEvent: false });
        this.loomForm.get('wefts')?.enable({ emitEvent: false });
        this.loomForm.get('width')?.enable({ emitEvent: false });
        this.loomForm.get('length')?.enable({ emitEvent: false });
      }


    }


  }




  private warpNumChange(num: number): Promise<boolean> {


    const draft = this.tree.getDraft(this.id);
    let loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);


    if (num > warps(draft.drawdown)) {
      var diff = num - warps(draft.drawdown);
      for (var i = 0; i < diff; i++) {

        let ndx = warps(draft.drawdown);
        const utils = getLoomUtilByType(loom_settings.type);
        loom = (utils.insertIntoThreading != null) ? utils.insertIntoThreading(loom, ndx, -1) : loom;

        draft.drawdown = insertDrawdownCol(draft.drawdown, ndx, null);
        draft.colShuttleMapping = insertMappingCol(draft.colShuttleMapping, ndx, 0);
        draft.colSystemMapping = insertMappingCol(draft.colSystemMapping, ndx, 0);

      }
    } else {

      var diff = warps(draft.drawdown) - num;
      for (var i = 0; i < diff; i++) {
        let ndx = warps(draft.drawdown) - 1;

        const utils = getLoomUtilByType(loom_settings.type);
        loom = (utils.deleteFromThreading != null) ? utils.deleteFromThreading(loom, ndx) : loom;
        draft.drawdown = deleteDrawdownCol(draft.drawdown, ndx);
        draft.colShuttleMapping = deleteMappingCol(draft.colShuttleMapping, ndx);
        draft.colSystemMapping = deleteMappingCol(draft.colSystemMapping, ndx);

      }

    }

    if (this.draftRendering && this.draftRendering.isSelectedDraftEditSource('drawdown')) {
      return this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
        .then(loom => {
          return Promise.resolve(true);
        })

    } else {
      return this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
        .then(draft => {

          return Promise.resolve(true);
        })

    }


  }


  private onWarpsChange(value: number) {
    if (this.tree.hasParent(this.id)) return;

    if (!value || value < 1) {
      value = 2;
      this.loomForm?.get('warps')?.setValue(value, { emitEvent: false });
    }

    this.warpNumChange(value).then(completed => {
      const draft = this.tree.getDraft(this.id);
      const loom_settings = this.tree.getLoomSettings(this.id);
      const w = calcWidth(draft.drawdown, loom_settings);
      this.loomForm?.get('width')?.setValue(w, { emitEvent: false });
      this.addStateChange();
    });


  }

  public getValue(field: string) {
    return this.loomForm?.get(field)?.value;
  }

  private onWeftsChange(value: number) {
    if (this.tree.hasParent(this.id)) return;

    if (!value || value < 1) {
      value = 1;
      this.loomForm?.get('wefts')?.setValue(value, { emitEvent: false });
    }

    this.weftNumChange(value).then(out => {
      const draft = this.tree.getDraft(this.id);
      const loom_settings = this.tree.getLoomSettings(this.id);
      const length = calcLength(draft.drawdown, loom_settings);
      this.loomForm?.get('length')?.setValue(length, { emitEvent: false });
      this.addStateChange();
    })

  }

  public weftNumChange(num: number): Promise<boolean> {

    const draft = this.tree.getDraft(this.id);
    let loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);

    //console.log("Draft", draft.drawdown.slice(), e.wefts)

    if (num > wefts(draft.drawdown)) {
      var diff = num - wefts(draft.drawdown);

      for (var i = 0; i < diff; i++) {
        let ndx = wefts(draft.drawdown);

        draft.drawdown = insertDrawdownRow(draft.drawdown, ndx, null);
        draft.rowShuttleMapping = insertMappingRow(draft.rowShuttleMapping, ndx, 1)
        draft.rowSystemMapping = insertMappingRow(draft.rowSystemMapping, ndx, 0);
        const utils = getLoomUtilByType(loom_settings.type);
        loom = (utils.insertIntoTreadling != null) ? utils.insertIntoTreadling(loom, ndx, []) : loom;
      }
    } else {

      var diff = wefts(draft.drawdown) - num;
      for (var i = 0; i < diff; i++) {
        let ndx = wefts(draft.drawdown) - 1;
        draft.drawdown = deleteDrawdownRow(draft.drawdown, ndx);
        draft.rowShuttleMapping = deleteMappingRow(draft.rowShuttleMapping, ndx)
        draft.rowSystemMapping = deleteMappingRow(draft.rowSystemMapping, ndx)
        const utils = getLoomUtilByType(loom_settings.type);
        loom = (utils.deleteFromTreadling != null) ? utils.deleteFromTreadling(loom, ndx) : loom;

      }

    }

    if (this.draftRendering && this.draftRendering.isSelectedDraftEditSource('drawdown')) {

      return this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
        .then(loom => {
          return Promise.resolve(true);
        })
    } else {

      return this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
        .then(draft => {
          const flags: DraftNodeBroadcastFlags = {
            meta: false,
            draft: true,
            loom: true,
            loom_settings: false,
            materials: false
          };
          this.tree.setDraft(this.id, draft, flags, true, true);
          return Promise.resolve(true);
        })
    }
  }




  private onLoomTypeChange(type: string) {

    if (this.id == -1) return;

    const draft = this.tree.getDraft(this.id);
    const loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);

    const new_settings: LoomSettings = copyLoomSettings(loom_settings);
    new_settings.type = type;


    convertLoom(draft.drawdown, loom, loom_settings, new_settings).then(loom => {

      this.tree.setLoom(this.id, loom, false);
      this.tree.setLoomSettings(this.id, new_settings, true);
      this.addStateChange();

    }).catch(err => {
      //if there is an error here, it just overwrites the type to jacquard. 
      console.error(err);
      this.tree.setLoom(this.id, null);
      this.tree.setLoomSettings(this.id, {
        type: 'jacquard',
        units: this.ws.units,
        frames: this.ws.min_frames,
        treadles: this.ws.min_treadles,
        epi: defaults.loom_settings.epi,
        ppi: defaults.loom_settings.ppi
      });
      this.addStateChange();


    })
  }

  private onTreadlesChange(value: number) {
    //validate the input
    const loom_settings = this.tree.getLoomSettings(this.id);
    const loom = this.tree.getLoom(this.id);

    if (!value || value < 2) {
      value = 2;
      this.loomForm?.get('treadles')?.setValue(value, { emitEvent: false });
    }

    value = Math.ceil(value);
    loom_settings.treadles = value;

    if (loom_settings.type == 'direct') {

      loom_settings.frames = Math.max(value, this.loomForm?.get('frames')?.value || 2);
      loom_settings.treadles = Math.max(value, this.loomForm?.get('frames')?.value || 2);

      loom.tieup = generateDirectTieup(loom_settings.treadles);
      this.tree.setLoom(this.id, loom);
      this.tree.setLoomSettings(this.id, loom_settings);
      // Update frames in form
      this.loomForm?.get('frames')?.setValue(loom_settings.frames, { emitEvent: false });
      this.loomForm?.get('treadles')?.setValue(loom_settings.treadles, { emitEvent: false });
    } else {
      loom_settings.treadles = value;
      this.tree.setLoomSettings(this.id, loom_settings);
    }

    this.addStateChange();

  }

  private onFramesChange(value: number) {
    const loom_settings = this.tree.getLoomSettings(this.id);
    const loom = this.tree.getLoom(this.id);
    const draft = this.tree.getDraft(this.id);

    if (!value || value < 2) {
      value = 2;
      this.loomForm?.get('frames')?.setValue(value, { emitEvent: false });
    }

    value = Math.ceil(value);
    loom_settings.frames = value;

    if (loom_settings.type == 'direct') {
      loom_settings.frames = Math.max(value, this.loomForm?.get('frames')?.value || 2);
      loom_settings.treadles = Math.max(value, this.loomForm?.get('frames')?.value || 2);

      loom.tieup = generateDirectTieup(loom_settings.treadles);
      this.tree.setLoom(this.id, loom);
      this.tree.setLoomSettings(this.id, loom_settings);
      // Update frames in form
      this.loomForm?.get('frames')?.setValue(loom_settings.frames, { emitEvent: false });
      this.loomForm?.get('treadles')?.setValue(loom_settings.treadles, { emitEvent: false });
    } else {
      loom_settings.frames = value;
      this.tree.setLoomSettings(this.id, loom_settings);

    }

    this.addStateChange();

  }


  private onUnitsChange(value: string) {
    const loom_settings = this.tree.getLoomSettings(this.id);
    loom_settings.units = value as "in" | "cm";
    this.tree.setLoomSettings(this.id, loom_settings);

    const draft = this.tree.getDraft(this.id);
    this.loomForm?.get('width')?.setValue(calcWidth(draft.drawdown, loom_settings), { emitEvent: false });
    this.loomForm?.get('length')?.setValue(calcLength(draft.drawdown, loom_settings), { emitEvent: false });

    this.addStateChange();

  }

  /**
* recomputes warps and epi if the width of the loom is changed
*/
  private onWidthChange(value: number) {
    const loom_settings = this.tree.getLoomSettings(this.id);

    if (!value || value < 0.25) {
      value = 1;
      this.loomForm?.get('width')?.setValue(value, { emitEvent: false });
    }

    const epi = this.loomForm?.get('epi')?.value || defaults.loom_settings.epi;
    const currentWarps = this.loomForm?.get('warps')?.value || defaults.warps;

    var new_warps = (loom_settings.units === "in")
      ? Math.ceil(value * epi) :
      Math.ceil((10 * currentWarps / value));

    this.warpNumChange(new_warps).then(out => {
      this.loomForm?.get('warps')?.setValue(new_warps, { emitEvent: false });
    });

    this.addStateChange();

  }


  /**
* recomputes warps and epi if the width of the loom is changed
*/
  private onLengthChange(value: number) {
    const loom_settings = this.tree.getLoomSettings(this.id);

    if (!value || value < 0.25) {
      value = 1;
      this.loomForm?.get('length')?.setValue(value, { emitEvent: false });
    }

    const ppi = this.loomForm?.get('ppi')?.value || defaults.loom_settings.ppi;
    const currentWefts = this.loomForm?.get('wefts')?.value || defaults.wefts;

    var new_wefts = (loom_settings.units === "in")
      ? Math.ceil(value * ppi) :
      Math.ceil((10 * currentWefts / value));

    this.weftNumChange(new_wefts).then(out => {
      this.loomForm?.get('wefts')?.setValue(new_wefts, { emitEvent: false });
    });

    // Update warps in form

    this.addStateChange();

  }


  private onPpiChange(value: number) {
    if (this.id == -1) return;

    const loom_settings = this.tree.getLoomSettings(this.id);
    const draft = this.tree.getDraft(this.id);

    if (!value || value < 0) {
      value = 1;
      this.loomForm?.get('ppi')?.setValue(value, { emitEvent: false });
    }

    loom_settings.ppi = value;
    this.loomForm?.get('length')?.setValue(calcLength(draft.drawdown, loom_settings), { emitEvent: false });
    this.addStateChange();

  }

  private onEpiChange(value: number) {
    if (this.id == -1) return;

    const loom_settings = this.tree.getLoomSettings(this.id);

    if (!value || value < 0) {
      value = 1;
      this.loomForm?.get('epi')?.setValue(value, { emitEvent: false });
    }

    loom_settings.epi = value;
    const draft = this.tree.getDraft(this.id);
    this.loomForm?.get('width')?.setValue(calcWidth(draft.drawdown, loom_settings), { emitEvent: false });
    this.addStateChange();

  }



}






