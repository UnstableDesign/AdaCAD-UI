import { Component, EventEmitter, inject, Input, OnInit, Output, ViewChild } from '@angular/core';

import { ScrollDispatcher } from '@angular/cdk/overlay';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';
import { MatLabel } from '@angular/material/form-field';
import { MatTooltip } from '@angular/material/tooltip';
import { createCell, Drawdown, getDraftName, LoomSettings } from 'adacad-drafting-lib';
import { getLoomUtilByType, isFrame } from 'adacad-drafting-lib/loom';
import { OpNode } from '../core/model/datatypes';
import { defaults, draft_pencil } from '../core/model/defaults';
import { DesignmodesService } from '../core/provider/designmodes.service';
import { FileService } from '../core/provider/file.service';
import { MaterialsService } from '../core/provider/materials.service';
import { RenderService } from '../core/provider/render.service';
import { StateService } from '../core/provider/state.service';
import { SystemsService } from '../core/provider/systems.service';
import { TreeService } from '../core/provider/tree.service';
import { ViewerService } from '../core/provider/viewer.service';
import { WorkspaceService } from '../core/provider/workspace.service';
import { ZoomService } from '../core/provider/zoom.service';
import { DraftRenderingComponent } from '../core/ui/draft-rendering/draft-rendering.component';
import { MaterialModal } from '../core/ui/material/material.modal';
import { LoomComponent } from './loom/loom.component';
import { RepeatsComponent } from './repeats/repeats.component';



@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
  imports: [MatAccordion, MatButton, MatTooltip, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatLabel, MatButtonToggleGroup, MatButtonToggle, FormsModule, LoomComponent, DraftRenderingComponent]
})
export class EditorComponent implements OnInit {
  private dialog = inject(MatDialog);
  private fs = inject(FileService);
  dm = inject(DesignmodesService);
  scroll = inject(ScrollDispatcher);
  ms = inject(MaterialsService);
  private ss = inject(SystemsService);
  private state = inject(StateService);
  private ws = inject(WorkspaceService);
  private tree = inject(TreeService);
  render = inject(RenderService);
  vs = inject(ViewerService);
  private zs = inject(ZoomService);



  @ViewChild(DraftRenderingComponent, { static: true }) weaveRef;
  @ViewChild(LoomComponent) loom;

  @Input() hasFocus: boolean;
  @Output() closeDrawer: any = new EventEmitter();
  @Output() saveChanges: any = new EventEmitter();
  @Output() updateMixer: any = new EventEmitter();
  @Output() cloneDraft: any = new EventEmitter();
  @Output() createDraft: any = new EventEmitter();
  @Output() onFocusView: any = new EventEmitter();
  @Output() onCollapseView: any = new EventEmitter();

  id: number = -1;

  parentOp: string = '';

  actions_modal: MatDialogRef<RepeatsComponent, any>;

  copy: Drawdown;

  selected;

  collapsed: boolean = false;

  dims: any;

  draftelement: any;

  draftname: string = "";

  scrollingSubscription: any;

  warp_locked: boolean = false;

  viewer_expanded: boolean = false;

  draw_modes: any = [];

  selected_material_id: any = -1;

  current_view = 'draft';

  scale: number = 0;

  pencil: string;

  dressing_info: Array<{ label: string, value: string }> = [];



  constructor() {



    this.copy = [[createCell(false)]];
    this.draw_modes = draft_pencil;

  }


  ngOnInit() {

    this.pencil = "toggle";
  }

  ngAfterViewInit() {
    this.scale = this.zs.getEditorZoom();
  }


  updateWeavingInfo() {


    const loom = this.tree.getLoom(this.id);
    const draft = this.tree.getDraft(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);

    if (loom == null || draft == null || loom_settings == null) return;

    console.log("Update Vewing Info", loom, draft, loom_settings)

    let utils = getLoomUtilByType(loom_settings.type);
    this.dressing_info = utils.getDressingInfo(draft.drawdown, loom, loom_settings);


  }







  clearAll() {
    // console.log("Clearing Detail Viewer ");
    this.id == -1;
    this.weaveRef.id == -1;
    this.weaveRef.clearAll();
  }


  expandViewer() {
    this.viewer_expanded = !this.viewer_expanded;
  }

  enableEdits() {
    this.createDraftCopy(this.id);
  }

  /**
   * called from "Add Draft" button
   */
  createNewDraft() {
    //copy over the loom settings
    const obj = {
      type: this.loom.type,
      epi: this.loom.epi,
      units: this.loom.units,
      frames: this.loom.frames,
      treadles: this.loom.treadles,
      warps: defaults.warps,
      wefts: defaults.wefts,
      origin: 'newdraft'
    }

    this.createDraft.emit(obj);
  }

  /**
   * copies an uneditable draft into a new node that is able to be edited. 
   * @param id 
   */
  createDraftCopy(id: number) {

    //copy over the loom settings
    const old_loom_settings: LoomSettings = this.tree.getLoomSettings(id);
    const loom_settings = {
      type: old_loom_settings.type,
      epi: old_loom_settings.epi,
      units: old_loom_settings.units,
      frames: old_loom_settings.frames,
      treadles: old_loom_settings.treadles
    }

    let loom = this.tree.getLoom(id);
    let draft = this.tree.getDraft(id);
    this.cloneDraft.emit({ draft, loom, loom_settings });
  }


  /**
  * placholder for any code we need to run when we focus on this view
  */
  onFocus() {
    console.log("ON FOCUS ", this.id)
    if (this.id != -1) {
      this.loadDraft(this.id);
    }
    this.renderChange();

  }

  onClose() {
    // this.id = -1;
    // this.weaveRef.id == -1;
  }


  //when the drawdown is updated see if it has a parent and if a new draft needs to be created. 
  /**
  * 
  * @param id 
  * @returns 
  */

  detailDraftEdited(id: number) {
    this.saveChanges.emit();

  }


  centerView() {
    if (this.id !== -1) {

      const loom_settings = this.tree.getLoomSettings(this.id);
      const draft = this.tree.getDraft(this.id);
      const loom = this.tree.getLoom(this.id);
      this.weaveRef.computeAndSetScale(draft, loom, loom_settings);

    }
  }

  clearDraft() {
    this.id = -1;
  }

  getParentOp(id: number) {
    const hasParent = this.tree.hasParent(id);
    console.log("HAS PARENT ", hasParent)
    if (!hasParent) this.parentOp = '';
    else {
      let pid = this.tree.getSubdraftParent(id);
      let opNode: OpNode = this.tree.getOpNode(pid);
      this.parentOp = opNode.name;
    }

  }





  /**
  * given an id, it proceeds to load the draft and loom associated with that id. 
  * @param id 
  * @returns 
  */
  loadDraft(id: number): Promise<any> {
    this.id = id;

    if (id == -1) return Promise.resolve();

    const draft = this.tree.getDraft(id);
    this.getParentOp(id);

    if (this.parentOp !== '') this.weaveRef.view_only = true;
    else this.weaveRef.view_only = false;


    if (this.loom.type == 'jacquard' && this.dm.cur_draft_edit_source == 'loom') {
      this.dm.selectDraftEditSource('drawdown');
    }

    this.draftname = getDraftName(draft);
    this.weaveRef.onNewDraftLoaded(id);
    this.redraw();
    this.updateWeavingInfo();
    return Promise.resolve(null);


  }

  ngOnDestroy(): void {


  }



  public onCloseDrawer() {
    this.weaveRef.unsetSelection();
  }


  public designModeChange(e: any) {
    this.weaveRef.unsetSelection();

  }

  public materialChange() {
    this.drawdownUpdated();
  }



  public drawdownUpdated() {
    this.vs.updateViewer();
    this.loom.updateLoom();
    this.updateWeavingInfo();
    this.saveChanges.emit();
  }


  // addTimelineState(){

  //   this.fs.saver.ada()
  //   .then(so => {
  //     this.state.addMixerHistoryState(so);
  //   });
  // }


  public redraw() {
    this.weaveRef.redrawAll();
  }

  public loomSettingsUpdated() {


    if (this.id == -1) return;



    const draft = this.tree.getDraft(this.id);
    const loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);

    console.log("LOOM SETTINGS UPDATED", loom_settings.units)


    this.loom.type = loom_settings.type;
    this.loom.units = loom_settings.units;
    this.weaveRef.isFrame = isFrame(loom_settings);
    this.weaveRef.epi = loom_settings.epi;
    this.weaveRef.selected_loom_type = loom_settings.type;
    this.weaveRef.redraw(draft, loom, loom_settings, {
      drawdown: true,
      loom: true,
      warp_systems: true,
      weft_systems: true,
      warp_materials: true,
      weft_materials: true
    });

    if (loom_settings.type === 'jacquard') this.dm.selectDraftEditSource('drawdown');
    else this.dm.selectDraftEditSource('loom');

    this.updateWeavingInfo();
    this.saveChanges.emit();

  }




  unsetSelection() {
    this.weaveRef.unsetSelection();
  }



  // public redrawSimulation(){
  //   this.redrawViewer.emit();

  // }






  public onScroll() {
  }

  /**
  * Weave reference masks pattern over selected area.
  * @extends WeaveComponent
  * @param {Event} e - mask event from design component.
  * @returns {void}
  */
  public onMask(e) {
    // console.log(e);
    // var p = this.draft.patterns[e.id].pattern;
    // this.weaveRef.maskArea(p);
    // this.redraw();
  }







  /// PUBLIC FUNCTIONS
  /**
  * 
  * @extends WeaveComponent
  * @returns {void}
  */
  public print(e) {
    console.log(e);
  }





  // }



  public updateSelection(e: any) {
    if (!this.weaveRef.hasSelection()) return;
    if (e.copy !== undefined) this.copy = e;
    // if(e.id !== undefined) this.simRef.updateSelection(e.start, e.end);
  }






  public toggleCollapsed() {
    this.collapsed = !this.collapsed;
  }


  /**
  *
  * tranfers on save from header to draft viewer
  */
  public onSave(e: any) {
    this.weaveRef.onSave(e);
  }



  // drawModeChange(name: string) {
  //   this.dm.selectDraftEditingMode('draw');
  //   this.dm.selectPencil(name);
  //   this.weaveRef.unsetSelection();
  // }

  openActions() {
    if (this.actions_modal != undefined && this.actions_modal.componentInstance != null) return;

    this.actions_modal = this.dialog.open(RepeatsComponent,
      {
        disableClose: true,
        maxWidth: 350,
        hasBackdrop: false,
        data: { id: this.id }
      });


    this.actions_modal.componentInstance.onUpdateWarpShuttles.subscribe(event => { if (this.id !== -1) this.weaveRef.updateWarpShuttles(event) });
    this.actions_modal.componentInstance.onUpdateWarpSystems.subscribe(event => { if (this.id !== -1) this.weaveRef.updateWarpSystems(event) });
    this.actions_modal.componentInstance.onUpdateWeftShuttles.subscribe(event => { if (this.id !== -1) this.weaveRef.updateWeftShuttles(event) });
    this.actions_modal.componentInstance.onUpdateWeftSystems.subscribe(event => { if (this.id !== -1) this.weaveRef.updateWeftSystems(event) });


  }

  selectPencil() {
    this.weaveRef.unsetSelection();

    switch (this.pencil) {

      case 'select':
        this.dm.selectDraftEditingMode('select');

        break;

      case 'up':
      case 'down':
      case 'toggle':
      case 'unset':
        this.dm.selectDraftEditingMode('draw');
        this.dm.selectPencil(this.pencil);

        break;

      default:
        this.dm.selectDraftEditingMode('draw');
        this.dm.selectPencil('material');
        this.selected_material_id = this.pencil;
        this.weaveRef.selected_material_id = this.pencil;
        break;

    }

  }

  openMaterials() {

    const material_modal = this.dialog.open(MaterialModal, { data: {} });
    material_modal.componentInstance.onMaterialChange.subscribe(event => {

    });
  }




  viewChange(name: any) {
    this.current_view = name;
    this.weaveRef.viewChange(name);

  }

  renderChange() {
    //the renderer is listening for changes to scale and will redraw
    this.scale = this.zs.getEditorZoom();
    this.weaveRef.scale = this.scale
    // this.weaveRef.rescale(this.scale);

    //we have to redraw for now so that UI div buttons line up with scaled view
    this.redraw();
  }





  swapEditingStyleClicked() {
    if (this.id == -1) return;

    if (this.loom.type !== 'jacquard') {
      if (this.dm.isSelectedDraftEditSource('drawdown')) {
        this.dm.selectDraftEditSource('drawdown');
      } else {
        this.dm.selectDraftEditSource('loom')
      }
    } else {
      this.dm.selectDraftEditSource('drawdown');

    }

  }




}
