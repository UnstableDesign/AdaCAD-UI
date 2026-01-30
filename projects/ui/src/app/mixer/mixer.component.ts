import { Component, enableProdMode, EventEmitter, inject, Input, Output, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipDefaultOptions } from '@angular/material/tooltip';
import { Draft, initDraftWithParams, initLoom, Loom, LoomSettings } from 'adacad-drafting-lib';
import { DraftExistenceChange, DraftNode, DraftNodeProxy, NodeComponentProxy, NoteValueChange, OpExistenceChanged, OpNode, Point } from '../core/model/datatypes';
import { defaults } from '../core/model/defaults';
import { FileService } from '../core/provider/file.service';
import { NotesService } from '../core/provider/notes.service';
import { OperationService } from '../core/provider/operation.service';
import { StateService } from '../core/provider/state.service';
import { TreeService } from '../core/provider/tree.service';
import { ViewerService } from '../core/provider/viewer.service';
import { WorkspaceService } from '../core/provider/workspace.service';
import { ZoomService } from '../core/provider/zoom.service';
import { BlankdraftModal } from '../core/ui/blankdraft/blankdraft.modal';
import { MixerSidebarComponent } from './mixer-sidebar/mixer-sidebar.component';
import { NoteComponent } from './palette/note/note.component';
import { OperationComponent } from './palette/operation/operation.component';
import { PaletteComponent } from './palette/palette.component';
import { SubdraftComponent } from './palette/subdraft/subdraft.component';
import { MultiselectService } from './provider/multiselect.service';
import { ViewportService } from './provider/viewport.service';

//disables some angular checking mechanisms
enableProdMode();




/** Custom options the configure the tooltip's default show/hide delays. */
export const myCustomTooltipDefaults: MatTooltipDefaultOptions = {
  showDelay: 1000,
  hideDelay: 1000,
  touchendHideDelay: 1000,
  position: 'right',
  disableTooltipInteractivity: true,

};


@Component({
  selector: 'app-mixer',
  templateUrl: './mixer.component.html',
  styleUrls: ['./mixer.component.scss'],
  providers: [{ provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: myCustomTooltipDefaults }],
  imports: [PaletteComponent, MixerSidebarComponent]
})
export class MixerComponent {
  private tree = inject(TreeService);
  private fs = inject(FileService);
  ws = inject(WorkspaceService);
  vp = inject(ViewportService);
  private notes = inject(NotesService);
  private dialog = inject(MatDialog);
  ops = inject(OperationService);
  private vs = inject(ViewerService);
  private ss = inject(StateService);
  zs = inject(ZoomService);
  private multiselect = inject(MultiselectService);



  @ViewChild(PaletteComponent) palette: PaletteComponent;
  @ViewChild(MixerSidebarComponent) sidebar: MixerSidebarComponent;

  @Input() is_fullscreen: boolean;
  @Output() onOpenInEditor: any = new EventEmitter();
  @Output() onPerformOperationError: any = new EventEmitter();


  origin_options: any = null;
  loading: boolean = false;
  manual_scroll: boolean = false;
  scrollingSubscription: any;
  selected_nodes_copy: any = null;

  /// ANGULAR FUNCTIONS
  /**
   * @constructor
   * ps - pattern service (variable name is initials). Subscribes to the patterns and used
   * to get and update stitches.
   * dialog - Anglar Material dialog module. Used to control the popup modals.
   */
  constructor() {
    this.vp.setAbsolute(defaults.canvas_width, defaults.canvas_height); //max size of canvas, evenly divisible by default cell size
  }

  setScroll(delta: any) {
    this.palette.handleScroll(delta);
    this.manual_scroll = true;
    //this.view_tool.updateViewPort(data);
  }

  refreshOperations() {
    this.sidebar.refreshOperations();
  }



  /**
   * called when an operation is selected manually from the list on the sidebar on on ENTER in the search window
   * @param name 
   */
  addOperation(name: string) {
    let id = this.palette.addOperation(name);
    const outputs = this.tree.getNonCxnOutputs(id);
    if (outputs.length > 0) this.vs.setViewer(outputs[0]);

    const change: OpExistenceChanged = {
      originator: 'OP',
      type: 'CREATED',
      node: this.tree.getNode(id),
      inputs: this.tree.getInwardConnectionProxies(id),
      outputs: this.tree.getOutwardConnectionProxies(id)
    }
    this.ss.addStateChange(change);
  }



  onRefreshViewer() {
    this.vs.updateViewer();
  }





  // addOp(event: any) {
  //   this.palette.addOperation(event)
  // }

  /**
   * called when add new draft is clicked form the sidebar. 
   */
  addDraftClicked() {

    const dialogRef = this.dialog.open(BlankdraftModal);

    dialogRef.componentInstance.onNewDraftCreated.subscribe(obj => {
      if (obj == null || obj == undefined) return;



      const draft = initDraftWithParams({ warps: obj.warps, wefts: obj.wefts });
      const loom_settings = this.ws.getWorkspaceLoomSettings();
      const loom = loom_settings.type === 'jacquard' ? null : initLoom(obj.warps, obj.wefts, this.ws.min_frames, this.ws.min_treadles);

      this.palette.createSubDraft(draft, loom, loom_settings).then(instance => {
        instance.isNew = true;

        const change: DraftExistenceChange = {
          originator: 'DRAFT',
          type: 'CREATED',
          node: this.tree.getNode(instance.id),
          inputs: [],
          outputs: []
        }
        this.ss.addStateChange(change);
      }

      ).catch(console.error)
    });
  }


  /**
 * called when the app needs to make a draft for the draft editor or when an "add draft" button as been clicked from the draft editor
 */
  createNewDraft(draft: Draft, loom: Loom, loom_settings: LoomSettings): Promise<number> {

    console.log("CREATING NEW DRAFT", draft, loom, loom_settings);
    return this.palette.createSubDraft(draft, loom, loom_settings)
      .then(instance => {
        console.log("CREATED NEW DRAFT", instance);
        instance.isNew = true;
        const change: DraftExistenceChange = {
          originator: 'DRAFT',
          type: 'CREATED',
          node: this.tree.getNode(instance.id),
          inputs: [],
          outputs: []
        }
        this.ss.addStateChange(change);
        return Promise.resolve(instance.id);
      }).catch(err => {
        console.error(err);
        return Promise.reject(err);
      });

  }


  /**
   * triggers a series of actions to occur when the view is switched from editor to mixer
   * @param edited_id the id of the draft that was last edited in the other mode. 
   */
  onFocus(edited_draft_id: number) {

    if (edited_draft_id == -1 || edited_draft_id == null) return;

    // const sd: SubdraftComponent = <SubdraftComponent>this.tree.getComponent(edited_draft_id);
    // if (sd !== null && sd !== undefined) sd.redrawExistingDraft();


    // const outlet_ops_connected = this.tree.getNonCxnOutputs(edited_draft_id);
    // let fns = outlet_ops_connected.map(el => this.performAndUpdateDownstream(el));
    // Promise.all(fns);

    //DO TO MAKE SURE USERS CAN TOGGLE ON MIXER DRAFTS
    // Design modes are now managed by the draft-rendering component in the editor




  }

  /**
   * called when toggling away from to mixer
   */
  onClose() {

  }


  bumpDataflow() {
    let offset = 200;
    let ops = this.tree.getOperations().filter(el => el !== null);
    let drafts = this.tree.getDrafts().filter(el => el !== null);
    let notes = this.notes.getComponents().filter(el => el !== null);;

    ops.forEach(op => {
      const topleft = (<OperationComponent>op).getPosition();
      topleft.x += offset;
      topleft.y += offset;
      (<OperationComponent>op).setPosition(topleft)
    });

    drafts.forEach(draft => {
      const topleft = draft.getPosition();
      topleft.x += offset;
      topleft.y += offset;
      draft.setPosition(topleft)
    });


    notes.forEach(note => {
      note.topleft.x += offset;
      note.topleft.y += offset;
      note.setPosition(note.topleft);
    });

    this.palette.redrawConnections();



  }



  zoomChange(zoom_index: any) {
    this.zs.setZoomIndexOnMixer(zoom_index)
    this.palette.rescale();

  }


  changeDesignMode(mode) {
    // this.palette.changeDesignMode(mode);
  }


  /**
   * TODO, this likely doesn't work
   * Called from import bitmaps to drafts features. The drafts have already been imported and sent to this function, 
   * which now needs to draw them to the workspace
   * @param drafts 
   */
  loadDrafts(drafts: any) {

    // const loom:Loom = {
    //   threading:[],
    //   tieup:[],
    //   treadling: []
    // };

    // const loom_settings:LoomSettings = {
    //   type:this.ws.type,
    //   epi: this.ws.epi,
    //   units: this.ws.units,
    //   frames: this.ws.min_frames,
    //   treadles: this.ws.min_treadles

    // }

    // let topleft = this.vp.getTopLeft();

    // let max_h = 0;
    // let cur_h = topleft.y + 20; //start offset from top
    // let cur_w = topleft.x + 50;
    // let zoom_factor = defaults.mixer_cell_size / this.zs.getMixerZoom();
    // let x_margin = 20 / zoom_factor;
    // let y_margin = 40 / zoom_factor;

    // let view_width = this.vp.getWidth() * zoom_factor;

    // drafts.forEach(draft => {


    //   const id = this.tree.createNode("draft", null, null);
    //   this.tree.loadDraftData({prev_id: null, cur_id: id,}, draft, loom, loom_settings, true);
    //   this.palette.loadSubDraft(id, draft, null, null, this.zs.getMixerZoom());

    //   //position the drafts so that they don't all overlap. 
    //    max_h = (wefts(draft.drawdown)*defaults.mixer_cell_size > max_h) ? wefts(draft.drawdown)*defaults.mixer_cell_size : max_h;

    //    let approx_w = warps(draft.drawdown);

    //    //300 because each draft is defined as having min-width of 300pm
    //    let w = (approx_w*defaults.mixer_cell_size > 300) ? approx_w *defaults.mixer_cell_size : 300 / zoom_factor;

    //    let dn = this.tree.getNode(id);
    //    dn.component.topleft = {x: cur_w, y: cur_h};

    //    cur_w += (w + x_margin);
    //    if(cur_w > view_width){
    //     cur_w = topleft.x + 50;
    //     cur_h += (max_h+y_margin);
    //     max_h = 0;
    //    }


    // });

    // this.palette.addTimelineState();


  }



  clearView(): void {

    if (this.palette !== undefined) this.palette.clearComponents();
    this.notes.clear();
    this.vp.clear();

  }

  ngOnDestroy(): void {
    // this.unsubscribe$.next(0);
    // this.unsubscribe$.complete();
  }


  onCopySelections() {
    const selections = this.multiselect.copySelections();
    this.selected_nodes_copy = selections;
  }


  togglePanMode() {
    if (this.palette.isSelectedMixerEditingMode('pan')) {
      this.palette.setMixerEditingMode('move');
    } else {
      this.palette.setMixerEditingMode('pan');
    }
    this.palette.designModeChanged();

  }

  toggleSelectMode() {
    if (this.palette.isSelectedMixerEditingMode('marquee')) {
      this.palette.setMixerEditingMode('move');

    } else {
      this.palette.setMixerEditingMode('marquee');

    }
    this.palette.designModeChanged();
  }




  operationAdded(name: string) {
    this.palette.addOperation(name);
  }


  // printMixer(){
  //   console.log("PRINT MIXER", "get bounding box of the elements and print")
  //   var node = document.getElementById('scrollable-container');
  //     htmlToImage.toPng(node, {width: 16380/2, height: 16380/2})
  //     .then(function (dataUrl) {

  //       // var win = window.open('about:blank', "_new");
  //       // win.document.open();
  //       // win.document.write([
  //       //     '<html>',
  //       //     '   <head>',
  //       //     '   </head>',
  //       //     '   <body onload="window.print()" onafterprint="window.close()">',
  //       //     '       <img src="' + dataUrl + '"/>',
  //       //     '   </body>',
  //       //     '</html>'
  //       // ].join(''));
  //       // win.document.close();

  //       const link = document.createElement('a')
  //       link.href= dataUrl;
  //       link.download = "mixer.jpg"
  //       link.click();




  //     })
  //     .catch(function (error) {
  //       console.error('oops, something went wrong!', error);
  //     });

  // }

  public downloadVisibleDraftsAsBmp() {
    this.palette.downloadVisibleDraftsAsBmp();
  }
  public downloadVisibleDraftsAsWif() {
    this.palette.downloadVisibleDraftsAsWif();
  }



  /**
   * Updates the canvas based on the weave view.
   * @param old_zoom - optional previous zoom level for center-based zooming
   */
  public renderChange(old_zoom?: number) {
    this.palette.rescale(old_zoom);
  }


  /**
   * Updates the canvas based on the weave view.
   */
  public zoomChangeExternal(event: any) {
    this.palette.rescale();
  }


  public postOperationErrorMessage($event: any) {
    this.onPerformOperationError.emit($event);
  }

  public notesChanged(e: any) {
  }



  /**
   * Called internally when loading files
   * @param note 
   */
  public createNote(note) {
    this.palette.createNote(note);
  }

  /**
   * Called when create New Note is Clicked
   */
  public createNewNote() {
    const nc: NoteComponent = this.palette.createNote(null);

    const change: NoteValueChange = {
      originator: 'NOTE',
      type: 'CREATED',
      id: nc.id,
      before: null,
      after: this.notes.get(nc.id)
    }
    this.ss.addStateChange(change);
  }


  public loadSubDraft(id: number, d: Draft, nodep: NodeComponentProxy, draftp: DraftNodeProxy) {
    this.palette.loadSubDraft(id, d, nodep, draftp);
  }

  loadOperation(id: number, name: string, params: Array<any>, inlets: Array<any>, topleft: Point) {
    this.palette.loadOperation(id, name, params, inlets, topleft)
  }

  loadConnection(id: number) {
    this.palette.loadConnection(id);
  }

  centerView() {
    this.palette.centerView();
  }

  /**
   * Sets the zoom to a provided value and optionally centers on a specific point.
   * Uses existing scrollbar listeners to update the view.
   * @param zoom - The zoom value to set (e.g., 0.5 for 50% zoom)
   * @param centerPoint - Optional point to center on in world coordinates. If not provided, maintains current scroll position.
   */
  setZoomAndCenter(id: number) {


    let node: OpNode | DraftNode;
    if (this.tree.hasParent(id)) {
      const parent = this.tree.getSubdraftParent(id);
      node = <OpNode>this.tree.getOpNode(parent);
    } else {
      node = <DraftNode>this.tree.getNode(id);
    }

    if (node.component === undefined) console.error("NODE COMPONENT UNDEFINED", node);
    const comp = <SubdraftComponent | OperationComponent>node.component;
    const centerPoint = comp.getPosition();


    const view_window: HTMLElement = document.getElementById('scrollable-container');
    if (view_window === null || view_window === undefined) return;

    // Set the new zoom value
    this.zs.setZoomIndexOnMixer(15);
    const new_zoom = this.zs.getMixerZoom();

    // Apply the zoom change using existing rescale method
    if (centerPoint !== undefined) {
      // Calculate the scroll position needed to center on the provided point
      // Formula: scrollLeft = worldPoint.x * zoom - viewportWidth / 2
      const viewportWidth = view_window.clientWidth;
      const viewportHeight = view_window.clientHeight;

      const scrollLeft = centerPoint.x * new_zoom - viewportWidth / 2;
      const scrollTop = centerPoint.y * new_zoom - viewportHeight / 2;

      // First apply the zoom transform (without old_zoom to avoid center-based zoom)
      this.palette.rescale();

      // Then set the scroll position to center on the point using existing scroll handler
      // Use requestAnimationFrame to ensure rescale has completed and DOM is updated
      requestAnimationFrame(() => {
        this.setScroll({ x: scrollLeft, y: scrollTop });
      });
    } else {
      // No center point provided, maintain current scroll percentage
      this.palette.rescale();
    }
  }






  /**
   * something in the materials library changed, check to see if
   * there is a modal showing materials open and update it if there is
   */
  public materialChange() {

    // this.palette.redrawAllSubdrafts();


  }



  /**
   * the drafts stored in adacad are ALWAYs oriented with 0,0 as the top left corner
   * any origin change is merely the rendering flipping the orientation. 
   * when the global settings change, the data itself does NOT need to change, only the rendering
   * @param e 
   */
  originChange(value: number) {

    //this.palette.redrawAllSubdrafts(); //force a redraw so that the weft/warp system info is up to date

  }


  /**
   * communicates an id of a subdraft upstream to open it within the editor 
   * @param id 
   */
  openDraftInEditor(id: number) {
    this.onOpenInEditor.emit(id);
  }

  explode() {
    this.palette.explode();
  }

}