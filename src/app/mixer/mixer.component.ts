import { Component, enableProdMode, EventEmitter, HostListener, Input, Optional, Output, SimpleChanges, ViewChild } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { FormControl, NgForm, UntypedFormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipDefaultOptions, MAT_TOOLTIP_DEFAULT_OPTIONS } from '@angular/material/tooltip';
import { BlankdraftModal } from '../core/modal/blankdraft/blankdraft.modal';
import { DesignMode, Draft, DraftNode, DraftNodeProxy, Loom, LoomSettings, NodeComponentProxy, Operation, Point } from '../core/model/datatypes';
import { defaults, loom_types } from '../core/model/defaults';
import { getDraftName, warps, wefts } from '../core/model/drafts';
import { DesignmodesService } from '../core/provider/designmodes.service';
import { FileService } from '../core/provider/file.service';
import { FilesystemService } from '../core/provider/filesystem.service';
import { NotesService } from '../core/provider/notes.service';
import { OperationDescriptionsService } from '../core/provider/operation-descriptions.service';
import { TreeService } from '../core/provider/tree.service';
import { WorkspaceService } from '../core/provider/workspace.service';
import { PaletteComponent } from './palette/palette.component';
import { MultiselectService } from './provider/multiselect.service';
import { ViewportService } from './provider/viewport.service';
import { ZoomService } from '../core/provider/zoom.service';
import { map, startWith } from 'rxjs/operators';
import { OperationService } from '../core/provider/operation.service';
import { SubdraftComponent } from './palette/subdraft/subdraft.component';
import { Observable } from 'rxjs';
import { ViewerService } from '../core/provider/viewer.service';

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
  providers: [{provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: myCustomTooltipDefaults}]

})
export class MixerComponent  {


  @ViewChild(PaletteComponent) palette;

  @Input() is_fullscreen: boolean;
  @Output() onOpenInEditor: any = new EventEmitter();


  origin_options: any = null; 
  loading: boolean = false;
  manual_scroll: boolean = false;
  scrollingSubscription: any;
  selected_nodes_copy: any = null;


  /** variables for operation search */

  classifications: any = [];
  op_tree: any = [];
  filteredOptions: Observable<any>;
  myControl: FormControl;
  search_error: any; 

  /// ANGULAR FUNCTIONS
  /**
   * @constructor
   * ps - pattern service (variable name is initials). Subscribes to the patterns and used
   * to get and update stitches.
   * dialog - Anglar Material dialog module. Used to control the popup modals.
   */
  constructor(
    
    public dm: DesignmodesService, 
    private tree: TreeService,
    private fs: FileService,
    public ws: WorkspaceService,
    public vp: ViewportService,
    private notes: NotesService,
    private dialog: MatDialog,
    public ops: OperationService, 
    private op_desc: OperationDescriptionsService,
    private vs: ViewerService,
    public zs: ZoomService,
    private multiselect: MultiselectService,
    @Optional() private fbauth: Auth
    ) {

      this.myControl = new FormControl();
   
      this.classifications = this.op_desc.getOpClassifications();

      this.vp.setAbsolute(defaults.mixer_canvas_width, defaults.mixer_canvas_height); //max size of canvas, evenly divisible by default cell size

      this.op_tree = this.makeOperationsList();
  }


  ngOnInit(){

    this.filteredOptions = this.myControl.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value))
    );
  }

  operationLevelToggleChange(event: any){
    this.ws.show_advanced_operations = event.checked;
    this.refreshOperations();

  }

  refreshOperations(){

    this.op_tree = this.makeOperationsList();
    this.filteredOptions = this.myControl.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value))
    );
  }

  makeOperationsList(){

    function alphabetical(a, b) {
      if (a.display_name < b.display_name) {
        return -1;
      }
      if (a.display_name > b.display_name) {
        return 1;
      }
      return 0;
    }


    const op_list =  this.classifications.map(classification => {
      return {
        class_name: classification.category_name, 
        ops: classification.op_names
          .filter(op => this.op_desc.hasDisplayName(op))
          .map(op => {return {name: op, display_name:this.op_desc.getDisplayName(op), advanced: this.op_desc.hasOpTag(op, "advanced")}})
          .filter(op => {
            if(this.ws.show_advanced_operations){
              return true;
            }else{
              return op.advanced === false;
            }
          })
      }
    });

    op_list.forEach(el => {
      el.ops.sort(alphabetical);
    })

    return op_list;



  }


  /**
   * adds the first of the filtered list of operations to the workspace
   */
  public enter(){


    const value = this.myControl.value.toLowerCase();

    //run the filter function again without the classification titles
    let tree = this.op_tree.reduce((acc, classification) => {
        return acc.concat(classification.ops
          .filter(option => option.display_name.toLowerCase().includes(value)));
    }, []);

    console.log("THIS TREE ", tree)
    if(tree.length > 0) this.addOp(tree[0].name);

    this.myControl.setValue('');


  }


  private _filter(value: string): any[] {

    const filterValue = value.toLowerCase();

    let tree =  this.op_tree.map(classification => {
      return {
        class_name: classification.class_name,
        ops: classification.ops
        .filter(option => option.display_name.toLowerCase().includes(filterValue))
      }
    });

    tree = tree.filter(classification => classification.ops.length > 0 );

    if(tree.length == 0){
      this.search_error = "no operations match this search"
    }else{  
      this.search_error = '';
    }

    return tree;



  }

 setScroll(delta: any) {
    this.palette.handleScroll(delta);
    this.manual_scroll = true;
   //this.view_tool.updateViewPort(data);
  }

inCat(op_name: string, cat_name: string) {;
  let parent = this.op_desc.getOpCategory(op_name);
  return parent == cat_name;

}


addOperation(name: string){

  let id = this.palette.addOperation(name);
  this.myControl.setValue('');
  const outputs = this.tree.getNonCxnOutputs(id);
  if(outputs.length > 0) this.vs.setViewer(outputs[0])
}



onRefreshViewer(){
  this.vs.updateViewer();
}


performAndUpdateDownstream(obj_id: number){
  this.palette.performAndUpdateDownstream(obj_id);
}


addOp(event: any){
  this.palette.addOperation(event)
}

createNewDraft(){

  const dialogRef = this.dialog.open(BlankdraftModal, {
  });

  dialogRef.afterClosed().subscribe(obj => {
    if(obj !== undefined && obj !== null) this.newDraftCreated(obj.draft, obj.loom, obj.loom_settings);
 });
}

/**
 * called when toggled to mixer
 *
 */

/**
 * triggers a series of actions to occur when the view is switched from editor to mixer
 * @param edited_id the id of the draft that was last edited in the other mode. 
 */
onFocus(edited_draft_id: number){

  if(edited_draft_id == -1 || edited_draft_id == null) return;

  const sd: SubdraftComponent = <SubdraftComponent> this.tree.getComponent(edited_draft_id); 
  if(sd !== null && sd!== undefined) sd.redrawExistingDraft();


  const outlet_ops_connected = this.tree.getNonCxnOutputs(edited_draft_id);
  let fns = outlet_ops_connected.map(el => this.performAndUpdateDownstream(el));
  Promise.all(fns);

  //DO TO MAKE SURE USERS CAN TOGGLE ON MIXER DRAFTS
  this.dm.selectDraftEditingMode('draw');
  this.dm.selectPencil('toggle');

}

/**
 * called when toggling away from to mixer
 */
onClose(){

}

 

zoomChange(zoom_index:any){
  this.zs.setZoomIndexOnMixer(zoom_index)
  this.palette.rescale();

}


  changeDesignMode(mode){
    this.palette.changeDesignMode(mode);
  }


  /**
   * TODO, this likely doesn't work
   * Called from import bitmaps to drafts features. The drafts have already been imported and sent to this function, 
   * which now needs to draw them to the workspace
   * @param drafts 
   */
  loadDrafts(drafts: any){

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



  clearView() : void {

    if(this.palette !== undefined) this.palette.clearComponents();
    this.notes.clear();
    this.vp.clear();

  }
  
  ngOnDestroy(): void {
    // this.unsubscribe$.next(0);
    // this.unsubscribe$.complete();
  }


  onCopySelections(){
    const selections = this.multiselect.copySelections();
    this.selected_nodes_copy = selections;
  }


  togglePanMode(){
    if(this.dm.isSelectedMixerEditingMode('pan')){
      this.dm.selectMixerEditingMode('move');
    }else{
      this.dm.selectMixerEditingMode('pan');
    }
    this.palette.designModeChanged();

  }

  toggleSelectMode(){
    if(this.dm.isSelectedMixerEditingMode('marquee')){
      this.dm.selectMixerEditingMode('move');

    }else{
      this.dm.selectMixerEditingMode('marquee');

    }
    this.palette.designModeChanged();
  }

  


    operationAdded(name:string){
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

  

  /**
   * Updates the canvas based on the weave view.
   */
  public renderChange() {
    this.palette.rescale();
  }


  /**
   * Updates the canvas based on the weave view.
   */
   public zoomChangeExternal(event: any) {
    this.palette.rescale();
  }




  public notesChanged(e:any) {
    console.log(e);
  }



  public createNote(note){
    this.palette.createNote(note);
  }

  public createNewNote(){
    this.palette.createNote(null);
  }
  /**
   * called when the user adds a new draft from the sidebar OR when a new draft is created from the editor
   * @param obj 
   */
  public newDraftCreated(draft: Draft, loom: Loom, loom_settings: LoomSettings): number{
    const id = this.tree.createNode("draft", null, null);
    const tr: Point = this.palette.calculateInitialLocation();
    let nodep: NodeComponentProxy = {
      node_id: id,
      type: 'draft', 
      topleft:  {x: tr.x, y: tr.y}
    }

    let dnproxy: DraftNodeProxy = {
      node_id: id,
      draft_id: id,
      draft_name: getDraftName(draft),
      draft: draft,
      compressed_draft: null,
      draft_visible: !defaults.hide_mixer_drafts,
      loom: loom,
      loom_settings: loom_settings,
      render_colors: true,
      scale: 1
    }

    this.tree.loadDraftData({prev_id: null, cur_id: id,}, draft, loom, loom_settings, true, 1, !this.ws.hide_mixer_drafts);
    this.palette.loadSubDraft(id, draft, nodep, dnproxy);
    return id;
  }

  public loadSubDraft(id: number, d: Draft, nodep: NodeComponentProxy, draftp: DraftNodeProxy){
    this.palette.loadSubDraft(id, d, nodep, draftp);
  }

  loadOperation(id: number, name: string, params: Array<any>, inlets: Array<any>, topleft:Point){
    this.palette.loadOperation(id, name, params, inlets, topleft)
  }

  loadConnection(id: number){
    this.palette.loadConnection(id);
  }

  centerView(){
    this.palette.centerView();
  }






  /**
   * something in the materials library changed, check to see if
   * there is a modal showing materials open and update it if there is
   */
  public materialChange() {
    
    this.palette.redrawAllSubdrafts();


 }

 public redrawAllSubdrafts(){
  this.palette.redrawAllSubdrafts();
 }



/**
 * the drafts stored in adacad are ALWAYs oriented with 0,0 as the top left corner
 * any origin change is merely the rendering flipping the orientation. 
 * when the global settings change, the data itself does NOT need to change, only the rendering
 * @param e 
 */
originChange(value: number){

  this.palette.redrawAllSubdrafts(); //force a redraw so that the weft/warp system info is up to date

}


/**
 * communicates an id of a subdraft upstream to open it within the editor 
 * @param id 
 */
openDraftInEditor(id: number){
  this.onOpenInEditor.emit(id);
}

explode(){
  this.palette.explode();
}

}