import { Component, EventEmitter, inject, Input, Output, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatInput } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltip } from '@angular/material/tooltip';
import { getDraftName, defaults as libDefaults, warps, wefts } from 'adacad-drafting-lib';
import { Subscription } from 'rxjs';
import { DraftNode, DraftStateNameOrNotesChange } from '../../core/model/datatypes';
import { defaults as appDefaults } from '../../core/model/defaults';
import { OperationService } from '../../core/provider/operation.service';
import { StateService } from '../../core/provider/state.service';
import { TreeService } from '../../core/provider/tree.service';
import { ViewerService } from '../../core/provider/viewer.service';
import { DownloadComponent } from '../../core/ui/download/download.component';
import { DraftRenderingComponent } from '../../core/ui/draft-rendering/draft-rendering.component';
import { RenameComponent } from '../../core/ui/rename/rename.component';
@Component({
  selector: 'app-draftinfocard',
  imports: [ReactiveFormsModule, DownloadComponent, MatSliderModule, MatButtonModule, MatFormField, MatInput, MatIconButton, MatTooltip, DraftRenderingComponent],
  templateUrl: './draftinfocard.component.html',
  styleUrl: './draftinfocard.component.scss'
})
export class DraftinfocardComponent {


  @ViewChild('draftRendering') draftRendering: DraftRenderingComponent;

  private tree = inject(TreeService);
  private ss = inject(StateService);
  private ops = inject(OperationService);
  private dialog = inject(MatDialog);
  private state = inject(StateService);
  private vs = inject(ViewerService);

  nameForm = new FormControl('');
  notesForm = new FormControl('');
  epiForm = new FormControl<number>(0);
  ppiForm = new FormControl<number>(0);
  selectBoxForm = new FormControl<boolean>(false);
  localZoomForm;

  selectedInViewer: boolean = false;

  loomUnits = null;
  loomType = null;
  warpnum = 0;
  weftnum = 0;
  oversize = false;
  inputList: Array<{ uid: string, op_name: string, inlet_name: string, type: string, value: string, category_color: string }> = [];
  parent: { uid: string, op_name: string, type: string, category_color: string }
  densityUnits: string;


  @Input() id: number;
  @Output() onDraftSelectionChange = new EventEmitter<number>();
  @Output() onDraftRename = new EventEmitter<number>();
  @Output() onOpenInEditor = new EventEmitter<number>();
  @Output() onOpenInMixer = new EventEmitter<number>();


  viewerSubscription: Subscription;

  ngOnInit() {


    console.log("DRAFT INFO CARD INIT", this.id);


    this.localZoomForm = new FormControl(this.tree.getDraftScale(this.id));
    this.localZoomForm.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.localZoomChange(value);
      }
    });

    this.selectedInViewer = this.vs.getViewerId() === this.id;
    this.viewerSubscription = this.vs.showing_id_change$.subscribe(data => {
      this.selectedInViewer = data === this.id;
    });

    this.refreshData();




  }

  ngAfterViewInit() {
    this.draftRendering.onNewDraftLoaded(this.id);
  }

  ngOnDestroy() {
    this.viewerSubscription.unsubscribe();
  }




  refreshData() {
    const draft = this.tree.getDraft(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);
    this.nameForm.setValue(getDraftName(draft), { emitEvent: false });
    this.notesForm.setValue(draft.notes || '', { emitEvent: false });
    this.epiForm.setValue(loom_settings.epi || libDefaults.loom_settings.epi, { emitEvent: false });
    this.ppiForm.setValue(loom_settings.ppi || libDefaults.loom_settings.ppi, { emitEvent: false });
    this.localZoomForm.setValue(this.tree.getDraftScale(this.id), { emitEvent: false });
    this.selectBoxForm.setValue(false, { emitEvent: false });
    this.loomUnits = loom_settings.units || libDefaults.loom_settings.units;
    this.densityUnits = this.loomUnits === 'in' ? 'ends / inch' : 'ends / 10cm';
    this.loomType = loom_settings.type || libDefaults.loom_settings.type;
    this.warpnum = warps(draft.drawdown) || -1;
    this.weftnum = wefts(draft.drawdown) || -1;
    this.oversize = (this.warpnum > appDefaults.oversize_dim_threshold || this.weftnum > appDefaults.oversize_dim_threshold) ? true : false;
    this.inputList = this.getInputListForDraft(this.id);
    this.parent = this.getParentForDraft(this.id);
    this.selectedInViewer = this.vs.getViewerId() === this.id;


  }

  localZoomChange(event: any) {
    const dn = <DraftNode>this.tree.getNode(this.id);
    dn.scale = event;
    this.draftRendering.rescale(dn.scale, 'canvas');

    // Update the form control to reflect the new value
    if (this.localZoomForm) {
      this.localZoomForm.setValue(dn.scale, { emitEvent: false });
    }
  }


  toggleDraftSelection() {
    this.onDraftSelectionChange.emit(this.id);
  }


  openDraftInEditor() {
    this.onOpenInEditor.emit(this.id);
  }

  openDraftInMixer() {
    this.onOpenInMixer.emit(this.id);
  }



  /**
   * generate a list of all the different inlets to which this draft is connected. 
   * @param id 
   * @returns 
   */
  getInputListForDraft(id: number): Array<{ uid: string, op_name: string, inlet_name: string, type: string, value: string, category_color: string }> {


    this.inputList = [];
    const draft = this.tree.getDraft(id);
    let out_cxns = this.tree.getOutputsWithNdx(id);
    let out_ops = out_cxns.map(o => this.tree.getConnectionOutputWithIndex(o.tn.node.id));

    out_ops.forEach(o => {
      let op_node = this.tree.getOpNode(o.id);
      let op_obj = this.ops.getOp(op_node.name);

      this.inputList.push(
        {
          uid: Math.random().toString(36).substring(2, 15),
          op_name: op_obj.meta.displayname || op_node.name,
          inlet_name: op_obj.inlets[o.inlet]?.name || 'n/a',
          type: op_obj.inlets[o.inlet]?.type || 'n/a',
          value: op_node.inlets[o.inlet].toString(),
          category_color: this.ops.getCatColor(op_obj.meta.categories[0].name) || '#000'
        });
    });

    return this.inputList;

  }


  getParentForDraft(id: number): { uid: string, op_name: string, type: string, category_color: string } {
    const parent = this.tree.getSubdraftParent(id);
    if (parent === -1) {
      return {
        uid: Math.random().toString(36).substring(2, 15),
        op_name: 'n/a',
        type: 'seed',
        category_color: '#000000'
      };
    } else {
      let op_node = this.tree.getOpNode(parent);
      let op_obj = this.ops.getOp(op_node.name);
      let categories = op_obj.meta.categories;
      const color = (categories == undefined || categories.length == 0) ? '#000000' : this.ops.getCatColor(categories[0].name);

      return {
        uid: Math.random().toString(36).substring(2, 15),
        op_name: op_obj.meta.displayname || op_node.name,
        type: 'operation',
        category_color: this.ops.getCatColor(this.ops.getOp(op_node.name).meta.categories[0].name) || '#000000'
      };
    }
  }

  updateNotes() {
    const dialogRef = this.dialog.open(RenameComponent, {
      data: { id: this.id }
    });


    dialogRef.afterClosed().subscribe(obj => {
      this.refreshData();
      this.notesForm.setValue(this.tree.getDraftNotes(this.id), { emitEvent: false });
      this.onDraftRename.emit(this.id);
    });

  }

  focusDraft() {
    this.vs.setViewer(this.id);
  }



  saveName() {
    const before_name = this.tree.getDraftName(this.id);
    const before_notes = this.tree.getDraftNotes(this.id);


    this.ss.addStateChange(<DraftStateNameOrNotesChange>{
      originator: 'DRAFT',
      type: 'NAME_OR_NOTES_CHANGE',
      id: this.id,
      before: { name: before_name, notes: before_notes },
      after: { name: this.nameForm.value, notes: before_notes }
    });

    this.tree.getDraft(this.id).ud_name = this.nameForm.value;
    this.onDraftRename.emit(this.id);
    this.nameForm.markAsPristine();

  }





}
