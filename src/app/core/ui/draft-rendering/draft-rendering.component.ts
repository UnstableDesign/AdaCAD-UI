import { Component, EventEmitter, HostListener, Input, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { Subject, Subscription, fromEvent } from 'rxjs';
import { CanvasList, Cell, Draft, Interlacement, Loom, LoomSettings, RenderingFlags } from '../../model/datatypes';
import { defaults } from '../../model/defaults';
import { deleteDrawdownCol, deleteDrawdownRow, deleteMappingCol, deleteMappingRow, generateMappingFromPattern, hasCell, insertDrawdownCol, insertDrawdownRow, insertMappingCol, insertMappingRow, isUp, setHeddle, warps, wefts } from '../../model/drafts';
import { getLoomUtilByType, isFrame, isInUserThreadingRange, isInUserTieupRange, isInUserTreadlingRange, numFrames, numTreadles } from '../../model/looms';
import { DesignmodesService } from '../../provider/designmodes.service';
import { FileService } from '../../provider/file.service';
import { MaterialsService } from '../../provider/materials.service';
import { OperationService } from '../../provider/operation.service';
import { RenderService } from '../../provider/render.service';
import { StateService } from '../../provider/state.service';
import { SystemsService } from '../../provider/systems.service';
import { TreeService } from '../../provider/tree.service';
import { WorkspaceService } from '../../provider/workspace.service';
import { ZoomService } from '../../provider/zoom.service';
import { SelectionComponent } from './selection/selection.component';
import { ViewerService } from '../../provider/viewer.service';

@Component({
  selector: 'app-draft-rendering',
  templateUrl: './draft-rendering.component.html',
  styleUrl: './draft-rendering.component.scss'
})


export class DraftRenderingComponent implements OnInit {
  
  @ViewChild('bitmapImage') bitmap;
  @ViewChild('selection', {read: SelectionComponent, static: true}) selection: SelectionComponent;
  @Input('id') id: number = -1;
  @Input('source') source: string;
  @Input('current_view') current_view: string;
  @Input('view_only') view_only: boolean;
  @Input('scale') scale: number;

  @Output() onNewSelection = new EventEmitter();
  @Output() onDrawdownUpdated = new EventEmitter();
  @Output() onViewerExpanded = new EventEmitter();
  @Output() onDesignModeChange = new EventEmitter();
  @Output() onMaterialChange = new EventEmitter();
  @Output() onLoomSettingsUpdated = new EventEmitter();
  
  
  hold_copy_for_paste: boolean = false;
  
  //store this here as you need it to draw the view
  colShuttleMapping: Array<number> = [];
  rowShuttleMapping: Array<number>= [];
  colSystemMapping: Array<number>= [];
  rowSystemMapping: Array<number>= [];
  
  
  mouse_pressed: boolean = false; 
  
  
  /**
  * Subscribes to move event after a touch event is started.
  * @property {Subscription}
  */
  moveSubscription: Subscription;
  
  
  /**
  * The HTML div element used to show the weft-systems text.
  * @property {HTMLElement}
  */
  divWesy: HTMLElement;
  
  /**
  * The HTML div element used to show the warp-systems text.
  * @property {HTMLElement}
  */
  divWasy: HTMLElement;
  
  
  
  /**
  * The HTML SVG element used to show the row
  * @property {HTMLElement}
  */
  svgSelectRow: HTMLElement;
  
  
  /**
  * The HTML SVG element used to show the row
  * @property {HTMLElement}
  */
  svgSelectCol: HTMLElement;
  
  
  
  canvases: CanvasList = null;
  
  
  //  weftMaterialsCanvas: HTMLCanvasElement;
  //  warpMaterialsCanvas: HTMLCanvasElement;
  
  private tempPattern: Array<Array<Cell>>;
  private unsubscribe$ = new Subject();
  
  
  private lastPos: Interlacement;
  
  
  isFrame: boolean;
  treadles: number;
  frames: number;
  warps: number; 
  wefts: number;
  width: number;
  epi: number;
  
  selected_loom_type;
  
  selected_units: 'cm' | 'in';
  
  /** VIEW OPTIONS */
  
  expanded: boolean = false;
  
  system_codes: Array<string> = [];
      
  selected_material_id: number = 0;
      /**
  * flag defining if there needs to be a recomputation of the draft on Mouse Up
  */
  flag_recompute: boolean;

  flag_history: boolean;

  //use this to set the current width of the warp text. This will change with the warp canvas changes
  warp_text_div_width: string = '1000px';
  
  //use this to set the current width of the warp text. This will change with the warp canvas changes
  weft_text_div_height: string = '1000px';
  

  /// ANGULAR FUNCTIONS
  /**
  * Creates the element reference.
  * @constructor
  */
  
  constructor(
    private fs: FileService,
    public dm: DesignmodesService,
    private ms: MaterialsService,
    private ss: SystemsService,
    public ws: WorkspaceService,
    public timeline: StateService,
    private tree:TreeService,
    private ops: OperationService,
    public render: RenderService,
    public vs: ViewerService,
    private zs: ZoomService
  ) { 
    
    this.flag_recompute = false;
    this.flag_history = false;
    this.system_codes = defaults.weft_system_codes;
    
  }
  
  ngOnInit() {
    
  }
  
  ngAfterViewInit(){
    
    // define the elements and context of the weave draft, threading, treadling, and tieups.
    const canvasEl = <HTMLCanvasElement> document.getElementById('drawdown-'+this.source+'-'+this.id);
    const threadingCanvas = <HTMLCanvasElement> document.getElementById('threading-'+this.source+'-'+this.id);
    const tieupsCanvas = <HTMLCanvasElement> document.getElementById('tieups-'+this.source+'-'+this.id);
    const treadlingCanvas = <HTMLCanvasElement> document.getElementById('treadling-'+this.source+'-'+this.id);
    const warp_systems_canvas =  
    <HTMLCanvasElement> document.getElementById('warp-systems-'+this.source+'-'+this.id);
    const warp_mats_canvas =  <HTMLCanvasElement> document.getElementById('warp-materials-'+this.source+'-'+this.id);
    const weft_systems_canvas =  <HTMLCanvasElement> document.getElementById('weft-systems-'+this.source+'-'+this.id);
    const weft_mats_canvas =  <HTMLCanvasElement> document.getElementById('weft-materials-'+this.source+'-'+this.id);

    
    this.canvases = {
      id: -1, 
      drawdown: canvasEl, 
      threading: threadingCanvas, 
      tieup: tieupsCanvas, 
      treadling: treadlingCanvas,
      warp_systems: warp_systems_canvas, 
      warp_mats: warp_mats_canvas, 
      weft_systems: weft_systems_canvas,
      weft_mats: weft_mats_canvas
    }
    
    this.divWesy =  document.getElementById('weft-systems-text-'+this.source+'-'+this.id);
    this.divWasy =  document.getElementById('warp-systems-text-'+this.source+'-'+this.id);
    this.refreshWarpAndWeftSystemNumbering();
        
  }

  //THIS DETECTS AND REDRAWS WHEN IT DOESN"T NEED TO 
  //ngOnChanges(changes:SimpleChanges){
    // console.log("CHANGES ", changes)
    // if (changes['scale']) {
    //  if(!changes['scale'].isFirstChange() && this.tree.getDraftVisible(this.id)) this.redrawAll();
    // }

  //}
  

  
  expand(){
    this.expanded = !this.expanded;
    this.onViewerExpanded.emit();
  }
  
  
  
  /**
  * called when a new draft is loaded. updates the zoom such that the draft content fills the window. 
  * @param draft 
  * @param loom 
  * @param loom_settings 
  */
  computeAndSetScale(draft: Draft, loom: Loom, loom_settings: LoomSettings) {
    
    // let adj = 1;
    // let margin = 160;
    
    // let div_draftviewer = document.getElementById('draft_viewer');
    // let rect_draftviewer = div_draftviewer.getBoundingClientRect();
    // let cell_size = this.render.calculateCellSize(draft);
    
    // let weft_num = wefts(draft.drawdown);
    // let warp_num = warps(draft.drawdown);
    // let treadles = (isFrame(loom_settings)) ? numTreadles(loom) : 0;
    // let frames = (isFrame(loom_settings)) ? numTreadles(loom) : 0;
    // let draft_width = (isFrame(loom_settings)) ? (warp_num + treadles) * cell_size : (warp_num)  * cell_size; 
    // let draft_height = (isFrame(loom_settings)) ? (weft_num + frames)* cell_size : (weft_num)  * cell_size; 
    
    // //add 100 to make space for the warp and weft selectors
    // draft_width += margin;
    // draft_height += margin;
    
    
    // //get the ration of the view to the item
    // let width_adj = rect_draftviewer.width / draft_width;
    // let height_adj = rect_draftviewer.height /draft_height;
    
    // //make the zoom the smaller of the width or height
    // adj = Math.min(width_adj, height_adj);
    
    // if(adj !== 0) this.zs.setEditorIndexFromZoomValue(adj);
    
    
  }
  
  
  
  
  //this is called anytime a new draft object is loaded. 
  onNewDraftLoaded(id: number) {  
    this.id = id;  
    
    if(id == -1) return;

    let draft = this.tree.getDraft(id);
   
    if(draft == null){
      console.error("COUNT NOT LOCATE DRAFT in Draft Rending", id, draft, this.tree.getNode(id));

      return;
    }
    
    let loom_settings = this.tree.getLoomSettings(id);
    if(loom_settings == null){
      loom_settings = defaults.loom_settings;
    }


    const loom = this.tree.getLoom(id);
    if(loom == null){
      this.frames = defaults.loom_settings.frames;
      this.treadles = defaults.loom_settings.treadles;
    }else{
      this.frames = Math.max(numFrames(loom), loom_settings.frames);
      this.treadles = Math.max(numTreadles(loom), loom_settings.treadles);
    }
  



    this.isFrame = isFrame(loom_settings);
    this.epi = loom_settings.epi;



    this.selected_loom_type = loom_settings.type;
    if(this.selected_loom_type == 'jacquard') this.dm.selectDraftEditSource('drawdown')
      

    
    this.warps = warps(draft.drawdown);
    this.wefts = wefts(draft.drawdown);
    this.width = warps(draft.drawdown) / loom_settings.epi;
    if(loom_settings.units == 'cm') this.width *= 10;
    this.selected_units = loom_settings.units;
    
    
    this.colShuttleMapping = draft.colShuttleMapping.slice();
    this.colSystemMapping = draft.colSystemMapping.slice();
    this.rowShuttleMapping = draft.rowShuttleMapping.slice();
    this.rowSystemMapping = draft.rowSystemMapping.slice();
  }
  
  clearSelection(){
    this.selection.unsetParameters();
    // d3.select(this.svgSelectCol).style('display', 'none');
    // d3.select(this.svgSelectRow).style('display', 'none');
  }
  
  ngOnDestroy() {
    this.removeSubscription();
  }
  
  
  /**
  *  takes an event from mouse event and determines how to handle it 
  * @param target the dom target of the mouse click
  * @param shift whether or not the shift key is being held
  * @param currentPos the position of the click within the target
  */
  setPosAndDraw(target:HTMLElement, shift: boolean, currentPos:Interlacement){
    
    if(this.view_only) return;
    
    const draft = this.tree.getDraft(this.id);
    const loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);
    
    
    const editing_style = this.dm.cur_draft_edit_source
    
    if(target && target.id =='warp-materials-'+this.source+'-'+this.id){
      if(this.dm.cur_pencil == 'material') this.drawOnWarpMaterials(draft, currentPos);
      else this.incrementWarpMaterial(currentPos.j);

    }else if(target && target.id =='warp-systems-'+this.source+'-'+this.id){
      this.incrementWarpSystem(currentPos.j);

    }else if(target && target.id =='weft-materials-'+this.source+'-'+this.id){
      if(this.dm.cur_pencil == 'material') this.drawOnWeftMaterials(draft, currentPos)
      else this.incrementWeftMaterial(currentPos.i)
      
    } else if(target && target.id =='weft-systems-'+this.source+'-'+this.id){
      this.incrementWeftSystem(currentPos.i);

    } else if (target && target.id =='treadling-'+this.source+'-'+this.id) {
      if(editing_style == "loom") this.drawOnTreadling(loom, loom_settings, currentPos);

    } else if (target && target.id === 'tieups-'+this.source+'-'+this.id) {
      if(loom_settings.type === "direct") return;
      if(editing_style == "loom") this.drawOnTieups(loom, loom_settings, currentPos);

    } else if (target && target.id === ('threading-'+this.source+'-'+this.id)) {
      if(editing_style == "loom")  this.drawOnThreading(loom, loom_settings, currentPos);
    } else{
      if(editing_style == "drawdown" || (this.source == 'mixer' && !this.tree.hasParent(this.id)))  this.drawOnDrawdown(draft, loom_settings, currentPos, shift);
    }
    
    this.flag_history = true;
  }
  
  
  
  /**
  * Touch start event. Subscribes to the move event.
  * @extends WeaveDirective
  * @param {Event} event - The mousedown event.
  * @returns {void}
  */
  @HostListener('mousedown', ['$event'])
  private onStart(event) {

    //show this in the viewer
    this.vs.setViewer(this.id);
    
    if(this.id == -1 || this.view_only) return;
    
    this.mouse_pressed = true;
    
    
    const draft = this.tree.getDraft(this.id);
    let cell_size = this.render.calculateCellSize(draft);
    
    var screen_row = Math.floor(event.offsetY / (cell_size*this.scale));
    var screen_col = Math.floor(event.offsetX / (cell_size*this.scale));
    
    const currentPos: Interlacement = {
      si: screen_row,
      i: screen_row, //row
      j: screen_col, //col
    };
    
    
    
    if (event.target.localName === 'canvas') {
      
      this.removeSubscription();    
      
      this.moveSubscription = 
      fromEvent(event.target, 'mousemove').subscribe(e => this.onMove(e));   
          
      
      
      if(!event.target) return;
      // console.log("__________________________________ ")
      // console.log("EVENT TARGET ID ", event.target.id)
      // console.log("POS: ", event.offsetY, currentPos)
  
      
      
      // Save temp pattern
      this.tempPattern = draft.drawdown.slice();
      
      
      switch (this.dm.cur_draft_edit_mode) {
        
        case 'draw':
        
        switch(this.dm.cur_pencil){
          
          case 'toggle':
          this.setPosAndDraw(event.target, event.shiftKey, currentPos);
          break;
          
          case 'up':
          case 'down':
          case 'unset':
          case 'material':
          this.setPosAndDraw(event.target, event.shiftKey, currentPos);
          this.flag_recompute = true;
          
          break;
        }
        
        
        
        break;
        case 'select':
        case 'copy':
        
        if(event.shiftKey){
          this.selection.onSelectDrag(currentPos);
          this.selection.onSelectStop();
        }   
        else this.selection.onSelectStart(event.target, currentPos);
        
        break;
        default:
        break;
      }
      
      this.lastPos = {
        si: currentPos.si,
        i: currentPos.i, //row
        j: currentPos.j //col
      };
      
    }
  }
  
  private isSame(p1: Interlacement, p2:Interlacement){
    if(p1 === undefined || p2 === undefined ) return false
    return (p1.i == p2.i && p1.j === p2.j);
    
  }
  
  
  
  /**
  * Event called when mouse down and moved within the canvas.
  * @extends WeaveDirective
  * @param {Event} event - The mousemove event.
  * @returns {void}
  */
  private onMove(event) {
    
    const draft = this.tree.getDraft(this.id);
    let cell_size = this.render.calculateCellSize(draft);
    
    
    // set up the point based on touched square.
    // this takes the transform into account so offset is always correct to the data 
    var screen_row = Math.floor(event.offsetY / (cell_size * this.scale));
    var screen_col = Math.floor(event.offsetX / (cell_size * this.scale));
    
    
    const currentPos: Interlacement = {
      si: screen_row,
      i:  screen_row,
      j:  screen_col
    };
    
    
    
    
    //don't call unless you've moved to a new spot
    if(this.isSame(currentPos, this.lastPos)) return;
    
    // determine action based on brush type. invert inactive on move.
    switch (this.dm.cur_draft_edit_mode) {
      case 'draw':
      switch(this.dm.cur_pencil){
        case 'up':
        case 'down':
        case 'unset':
        case 'material':
        case 'toggle':
        
        this.setPosAndDraw(event.target, event.shiftKey, currentPos);
        this.flag_recompute = true;
        
        
        
        break;
      }
      
      break;
      
      
      
      case 'select':
      case 'copy':
      
      this.selection.onSelectDrag(currentPos);
      
      break;
      case 'invert':
      default:
      break;
    }
    
    this.lastPos = {
      si: currentPos.si,
      i: currentPos.i, //row
      j: currentPos.j //col
    };
  }
  
  /**
  * Event removes subscription when touch has ended.
  * @extends WeaveDirective
  * @param {Event} event - The mouseleave or mouseup event.
  * @returns {void}
  */
  @HostListener('mouseleave', ['$event'])
  @HostListener('mouseup', ['$event'])
  private onEnd(event) {
    this.mouse_pressed = false;
    if(this.id == -1 || this.view_only) return;

    
    this.lastPos = {
      si: -1,
      i: -1,
      j: -1
    }
    
    if(this.flag_history && event.type == 'mouseup'){
      // this.onDrawdownUpdated.emit(draft);
      this.flag_history = false;
    } 
    
    
    if(this.flag_recompute && event.type == 'mouseup'){
      this.flag_recompute = false;
    }
    
    
    
    // remove subscription unless it is leave event with select.
    if (!(event.type === 'mouseleave' && (this.dm.isSelectedDraftEditingMode('select')))){
      this.removeSubscription();
      this.selection.onSelectStop();
    }
    
  }
  
  /**
  * This is emitted from the selection
  */
  onSelectionEnd(){
    
    if(!this.selection.hasSelection()) return;
    
    //if(!this.hold_copy_for_paste) this.copyArea();
    
    this.onNewSelection.emit(
      { 
        id: this.id, 
        start: {i: this.selection.getStartingRowScreenIndex(), j: this.selection.getStartingColIndex()}, 
        end: {i: this.selection.getEndingRowScreenIndex(), j: this.selection.getEndingColIndex()}})
      }
      
      /**
      * Remove the subscription from the move event.
      * @extends WeaveDirective
      * @returns {void}
      */
      private removeSubscription() {    
        if (this.moveSubscription) {
          this.moveSubscription.unsubscribe();
        }
      }
      
      private hasSelection() : boolean {
        return this.selection.hasSelection();
      }
      
      

      
 
      
      public incrementWeftSystem(i: number){
        const draft = this.tree.getDraft(this.id);
        var newSystem = this.ss.getNextWeftSystem(i, draft);
        draft.rowSystemMapping[i] = newSystem;
        this.rowSystemMapping = draft.rowSystemMapping.slice();
        this.tree.setDraftOnly(this.id, draft);
        this.onDrawdownUpdated.emit(this.id);
        this.redrawAll();
        
        
        
      }
      
      
      
      incrementWeftMaterial(si: number){        
        const draft = this.tree.getDraft(this.id);
        if(this.dm.isSelectedPencil('material')){
          draft.rowShuttleMapping[si] = this.selected_material_id;
        }else{
          const len = this.ms.getShuttles().length;
          var shuttle_id = draft.rowShuttleMapping[si];
          var newShuttle = (shuttle_id + 1) % len;
          draft.rowShuttleMapping[si] = newShuttle;
        }
        
        this.tree.setDraftOnly(this.id, draft);
        this.rowShuttleMapping = draft.rowShuttleMapping;
        this.redrawAll();
        this.onMaterialChange.emit(draft);
        
      }
      
      
      
      public incrementWarpSystem(j: number){        
        
        const draft = this.tree.getDraft(this.id);
        var newSystem = this.ss.getNextWarpSystem(j,draft);
        draft.colSystemMapping[j] = newSystem;
        this.colSystemMapping = draft.colSystemMapping.slice();
        
        this.tree.setDraftOnly(this.id, draft);
        this.redrawAll();
        this.onDrawdownUpdated.emit(this.id);

        
        // this.cdRef.detectChanges();
        
      }
      
      incrementWarpMaterial(col: number){
        const warp = col;
        
        const draft = this.tree.getDraft(this.id);
        if(this.dm.isSelectedPencil('material')){
          draft.colShuttleMapping[warp] = this.selected_material_id;
        }else{
          const len = this.ms.getShuttles().length;
          var shuttle_id = draft.colShuttleMapping[warp];
          var newShuttle = (shuttle_id + 1) % len;
          draft.colShuttleMapping[warp] = newShuttle;
        }
        
        this.tree.setDraftOnly(this.id, draft);
        this.colShuttleMapping = draft.colShuttleMapping;
        this.redrawAll();
        
        this.onMaterialChange.emit(draft);
        
        
        
      }
      
      
      
      
      
      
      /**
      * Called when a single point "draw" event is called on the
      * @param {Point} currentPos - the current position of the mouse within draft.
      * @param shift - boolean for if the shift key was being held when this operation was called
      * @returns {void}
      */
      
      private drawOnDrawdown(draft:Draft, loom_settings: LoomSettings,  currentPos: Interlacement, shift: boolean) {
        
        var val  = false;
        
        if (this.canvases.drawdown == null || !currentPos) { return; }
        
        
        
        if(hasCell(draft.drawdown, currentPos.i, currentPos.j)){
          
          // Set the heddles based on the brush.
          switch (this.dm.cur_pencil) {
            case 'up':
            val = true;
            draft.drawdown = setHeddle(draft.drawdown, currentPos.i,currentPos.j,val);
            break;
            case 'down':
            val = false;
            draft.drawdown = setHeddle(draft.drawdown, currentPos.i,currentPos.j,val);
            break;
            case 'toggle':
            if(shift){
              val = null;
            } 
            else val = !isUp(draft.drawdown, currentPos.i,currentPos.j);
            draft.drawdown = setHeddle(draft.drawdown, currentPos.i,currentPos.j,val);
            break;
            case 'unset':
            draft.drawdown = setHeddle(draft.drawdown, currentPos.i,currentPos.j,null);
            break;
            case 'material':
            this.drawOnWeftMaterials(draft, currentPos);
            this.drawOnWarpMaterials(draft, currentPos)
            break;        
            default:
            break;
          }
          
          
          this.tree.setDraftAndRecomputeLoom(this.id, draft, this.tree.getLoomSettings(this.id))
          .then(loom => {
            this.redraw(draft, loom, loom_settings, {drawdown:true, loom:true});
            // console.log("on drawdown updated called from draw on drawdown")
            this.onDrawdownUpdated.emit(draft);
          })
          .catch(console.error);
          
        }
        
      }
      
      /**
      * Draws or erases a single rectangle on the canvas. Updates the tieups.
      * @extends WeaveDirective
      * @param {Point} currentPos - the current position of the mouse within draft.
      * @returns {void}
      */
      private drawOnTieups(loom: Loom, loom_settings:LoomSettings, currentPos: Interlacement ) {
        var val = false;
        
        if (this.canvases.tieup === null || !currentPos) { return; }
        
        
        if (isInUserTieupRange(loom, loom_settings,  currentPos)){
          
          
          
          switch (this.dm.cur_pencil) {
            case 'up':
            val = true;
            break;
            case 'down':
            val = false;
            break;
            case 'toggle':
            if(currentPos.i > loom.tieup.length || currentPos.j > loom.tieup[0].length) val = true;
            else val = !loom.tieup[currentPos.i][currentPos.j];
            break;
            default:
            break;
          }
          
          const utils = getLoomUtilByType(loom_settings.type);
          loom = utils.updateTieup(loom, {i:currentPos.i,j: currentPos.j, val:val});
          this.tree.setLoomAndRecomputeDrawdown(this.id, loom,loom_settings)
          .then(draft => {
            this.redraw(draft, loom, loom_settings, {drawdown:true, loom:true});
            this.tree.setDraftOnly(this.id, draft);
            this.onDrawdownUpdated.emit(draft);
          })
          
        }
      }
      
      /**
      * Draws or erases a single rectangle on the canvas. Updates the threading.
      * @extends WeaveDirective
      * @param {Point} currentPos - the current position of the mouse within draft.
      * @returns {void}
      */
      private drawOnThreading(loom:Loom, loom_settings: LoomSettings, currentPos: Interlacement ) {
        
        
        if (this.canvases.threading == null || !currentPos) { return; }
        
        
        
        if (isInUserThreadingRange(loom, loom_settings, currentPos)){
          var val;
          const draft = this.tree.getDraft(this.id)
          
          
          switch (this.dm.cur_pencil) {
            case 'up':
            val = true;
            break;
            case 'down':
            val = false;
            break;
            case 'toggle':
            val = !(loom.threading[currentPos.j] == currentPos.i);
            break;
            case 'material':
            val = (loom.threading[currentPos.j] == currentPos.i);
            this.drawOnWarpMaterials(draft, currentPos)
            break;
            default:
            break;
          }
          
          
          const utils = getLoomUtilByType(loom_settings.type);
          if(this.dm.cur_pencil !== 'material') loom = utils.updateThreading(loom, {i:currentPos.i, j:currentPos.j, val:val});
          this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
          .then(draft => {
            this.redraw(draft, loom, loom_settings, {drawdown:true, loom:true});
            this.tree.setDraftOnly(this.id, draft);
            this.onDrawdownUpdated.emit(draft);
          });
        }
      }
      
      
      /**
      * Draws or erases a single rectangle on the canvas. Updates the treadling.
      * @extends WeaveDirective
      * @param {Point} currentPos - the current position of the mouse within draft.
      * @returns {void}
      */
      private drawOnTreadling(loom: Loom, loom_settings: LoomSettings, currentPos: Interlacement ) {
        
        if (this.canvases.treadling == null || !currentPos) { return; }
        const draft = this.tree.getDraft(this.id)
        var val = false;
        
        if(isInUserTreadlingRange(loom, loom_settings, currentPos)){
          switch (this.dm.cur_pencil) {
            case 'up':
            val = true;
            break;
            case 'down':
            val = false;
            break;
            case 'toggle':
            val = !(loom.treadling[currentPos.i].find(el => el === currentPos.j) !== undefined);
            break;
            case 'material':
            this.drawOnWeftMaterials(draft, currentPos)
            break;
            default:
            break;
          }
          
          
          
          //this updates the value in the treadling
          const utils = getLoomUtilByType(loom_settings.type);
          if(this.dm.cur_pencil !== 'material') loom = utils.updateTreadling(loom, {i:currentPos.i, j:currentPos.j, val:val});
          this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
          .then(draft => {
            this.redraw(draft, loom, loom_settings, {drawdown:true, loom:true});
            this.tree.setDraftOnly(this.id, draft);
            this.onDrawdownUpdated.emit(draft);
          })
        }
      }
      
      
      
      
      
      
      
      
      
      /**
      * called on scroll
      * @param scroll_top 
      * @param scroll_left 
      */
      public reposition(scroll_top: number, scroll_left: number){
        
      }
      
      //flips the view from front to back
      // public flip(){
      //   const container: HTMLElement = document.getElementById('draft-scale-container');
      //   container.style.transformOrigin = '50% 50%';
      //   if(this.render.view_front) container.style.transform = "matrix(1, 0, 0, 1, 0, 0) scale(" + this.zs.getEditorZoom() + ')';
      //   else container.style.transform = "matrix(-1, 0, 0, 1, 0, 0) scale(" + this.zs.getEditorZoom() + ')';
        
      // }
      
      /**
      * this rescales the canvas and updates the view from scroll events
      * receives offset of the scroll from the CDKScrollable created when the scroll was initiated
      */
      //this does not draw on canvas but just rescales the canvas
      public rescale(scale: number){
        
        if(this.id == -1) return;

          const draft = this.tree.getDraft(this.id);
          const loom = this.tree.getLoom(this.id);
          const loom_settings = this.tree.getLoomSettings(this.id);
          this.render.rescale(draft, loom, loom_settings, scale, this.canvases);

           
      }
      
      
      
      // public getTextInterval(){
      //   let ls = this.tree.getLoomSettings(this.id);
      //   return (ls === null) ? defaults.epi :  ls.epi;
      // }
      
      /**
      * callled when frames become visible or drawdown without frame info is loaded
      */
      public recomputeLoom(draft: Draft, loom_settings:LoomSettings){
        this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings);
      }
      
      
      public unsetSelection(){
        this.selection.unsetParameters();
      }
      
      
      
      public clearAll(){
        this.colSystemMapping = [];
        this.rowSystemMapping = [];
        this.render.clear(this.canvases); 
       
      }
      
      public redrawAll(){
        if(this.id == -1) return;
        const draft = this.tree.getDraft(this.id)
        const loom = this.tree.getLoom(this.id)
        const loom_settings = this.tree.getLoomSettings(this.id);

        let flags = {
          drawdown: true, 
          loom:true, 
          warp_systems: true, 
          warp_materials: true, 
          weft_systems: true, 
          weft_materials:true, 
          use_floats: (this.current_view == 'color'),
          use_colors: (this.current_view != 'draft')
        }

        this.redraw(draft, loom, loom_settings, flags);   
      }

      
      //takes inputs about what to redraw
      public redraw(draft:Draft, loom: Loom, loom_settings:LoomSettings, flags:any) : Promise<boolean>{
       
        if(draft == null) return;

        this.colSystemMapping = draft.colSystemMapping;
        this.rowSystemMapping = draft.rowSystemMapping;


        let rf: RenderingFlags = {
          u_drawdown: (flags.drawdown !== undefined && flags.drawdown == true), 
          u_threading: (flags.loom !== undefined  && flags.loom == true),
          u_tieups: (flags.loom !== undefined  && flags.loom == true),
          u_treadling: (flags.loom !== undefined &&  flags.loom == true),
          u_warp_mats: (flags.warp_materials  !== undefined &&  flags.warp_materials == true),
          u_weft_mats: (flags.weft_materials  !== undefined &&  flags.weft_materials == true),
          u_warp_sys: (flags.warp_systems  !== undefined &&  flags.warp_systems == true),
          u_weft_sys: (flags.weft_systems  !== undefined &&  flags.weft_systems == true),
          use_colors: (flags.use_colors  !== undefined && flags.use_colors == true),
          use_floats: (flags.use_floats  !== undefined && flags.use_floats == true), 
          show_loom: (flags.show_loom  !== undefined && flags.show_loom == true)
        }

        return this.render.drawDraft(draft, loom, loom_settings, this.canvases, rf).then(res => {
          this.render.rescale(draft, loom, loom_settings, this.scale, this.canvases)
          this.refreshWarpAndWeftSystemNumbering();
          this.selection.redraw();     

          return Promise.resolve(res);
        })
        
        
        
        
        
      }

      refreshWarpAndWeftSystemNumbering(){
        // let warpdatadiv = document.getElementById('warp-systems-text-'+this.source+'-'+this.id);
        // let weftdatadiv = document.getElementById('weft-systems-text-'+this.source+'-'+this.id);
        // console.log("REFRESH NUMBERING ", this.source, warpdatadiv, weftdatadiv)
        // if(warpdatadiv !== null) warpdatadiv.style.width = this.canvases.warp_mats.style.width;
        // if(weftdatadiv !== null) weftdatadiv.style.height = this.canvases.weft_mats.style.height;
        this.weft_text_div_height = this.canvases.weft_mats.style.height;
        this.warp_text_div_width = this.canvases.warp_mats.style.width;

      }

       //takes inputs about what to redraw
       public clear() : Promise<boolean>{

        this.colSystemMapping = [];
        this.rowSystemMapping = [];

        
   
        return this.render.clear(this.canvases).then(res => {
          return Promise.resolve(res);
        })
        
        
        
        
        
      }
      
      
      
      
      /**
      * Prints the pattern to the console.
      * @extends WeaveDirective
      * @param {Array<Array<boolean>>} pattern - 2D pattern array.
      * @returns {void}
      */
      public printPattern(pattern) {
        for (var i = 0; i < pattern.length; i++) {
          var s = "";
          for (var j = 0; j < pattern[0].length; j++) {
            if (pattern[i][j]) {
              s += 'x';
            } else {
              s += 'o'
            }
          }
          console.log(s);
        }
      }
      
      
      //  /**
      //  * Saves the draft as a bitmap file
      //  * @extends WeaveDirective
      //  * @param {string} fileName - name to save file as
      //  * @returns {void}
      //  */
      // public getPrintableCanvas(obj) : HTMLCanvasElement {
      
      //   const frames = numFrames(this.loom);
      //   const treadles = numTreadles(this.loom);
      
      //   let dims = this.render.getCellDims("base");
      
      //   let b = obj.bitmap.nativeElement;
      //   let context = b.getContext('2d');
      
      //   b.width = (warps(this.weave.drawdown) + treadles + 6) * dims.w;
      //   b.height = (wefts(this.weave.drawdown) + frames + 6) * dims.h;
      
      //   context.fillStyle = "white";
      //   context.fillRect(0,0,b.width,b.height);
      
      //   //use this to solve 0 width errors on drawIMage
      //   if(this.loom_settings.type !== 'jacquard'){
      
      //     context.drawImage(this.threadingCanvas, 0, dims.h*3);
      //     context.drawImage(this.tieupsCanvas, (warps(this.weave.drawdown) +1)* dims.w, 3*dims.h);
      //     context.drawImage(this.treadlingCanvas, (warps(this.weave.drawdown) +1)* dims.w, (frames + 4)*dims.h);
      
      //   }
      
      //   //systems
      //   context.drawImage(this.warpSystemsCanvas, 0, 0);
      //   context.drawImage(this.warpMaterialsCanvas, 0, dims.h);
      
      //   context.drawImage(this.canvasEl, -dims.w, (frames+3)*dims.h);
      
      //   context.drawImage(this.weftMaterialsCanvas,(warps(this.weave.drawdown)+ treadles +1)* dims.w, (frames + 4)*dims.h);
      //   context.drawImage(this.weftSystemsCanvas,(warps(this.weave.drawdown)+ treadles +2)* dims.w, (frames + 4)*dims.h);
      //   return b;
      // }
      
      /**
      * Saves the draft as a bitmap file
      * @extends WeaveDirective
      * @param {string} fileName - name to save file as
      * @returns {void}
      */
      // public getBMPCanvas(obj) : HTMLCanvasElement {
      //   let b = obj.bitmap.nativeElement;
      //   let context = b.getContext('2d');
      //   let draft = this.weave.drawdown;
      //   var i,j;
      
      //   b.width = warps(this.weave.drawdown);
      //   b.height = wefts(this.weave.drawdown);
      //   context.fillStyle = "white";
      //   context.fillRect(0,0,b.width,b.height);
      
      //   context.fillStyle = "black";
      
      //   for( i = 0; i < b.height; i++) {
      //     for( j=0; j < b.width; j++) {
      //       let up = draft[i][j].isUp();
      //       if(up) {
      //         context.fillRect(j,i,1,1)
      //       }
      //     }
      //   }
      //   return b;
      // }
      
      /**
      *
      *
      */
      // public onSave(e: any) {
      
      //   e.bitmap = this.bitmap;
      
      //   if (e.type === "bmp"){
      //     let link = e.downloadLink.nativeElement;
      //     link.href = this.fs.saver.bmp(this.getBMPCanvas(e));
      //     link.download = e.name + ".jpg"; //Canvas2Bitmap  seems to be broken now
      //   } 
      //   else if (e.type === "ada"){
      //     let link = e.downloadLink.nativeElement;
      //     link.href = this.fs.saver.ada('draft', [this.weave], [this.loom],  false, 5);
      //     link.download = e.name + ".ada";
      //   } 
      //   else if (e.type === "wif"){
      //     let link = e.downloadLink.nativeElement;
      //     link.href= this.fs.saver.wif(this.weave, this.loom);
      //     link.download = e.filename +".wif";
      
      //   } 
      //   else if (e.type === "jpg"){
      //     let link = e.downloadLink.nativeElement;
      //     link.href = this.fs.saver.jpg(this.getPrintableCanvas(e));
      //     link.download = e.name + ".jpg";
      //   } 
      
      // }
      
      
      // public print(e){
      //   let draft = this.tree.getDraft(this.id);
      //   let loom = this.tree.getLoom(this.id);
      //   let width = (Math.max(500, warps(draft.drawdown)+ numTreadles(loom))*this.cell_size + 200);
      //   let height = Math.max(500, (wefts(draft.drawdown)+ numFrames(loom))*this.cell_size + 200);
      //   var node = document.getElementById('draft-container');
      //   htmlToImage.toPng(node, {  backgroundColor: 'white', width, height})
      //   .then(function (dataUrl) {
      
      //     var win = window.open('about:blank', "_new");
      //     win.document.open();
      //     win.document.write([
      //         '<html>',
      //         '   <head>',
      //         '   </head>',
      //         '   <body onload="window.print()" onafterprint="window.close()">',
      //         '       <img src="' + dataUrl + '"/>',
      //         '   </body>',
      //         '</html>'
      //     ].join(''));
      //     win.document.close();
      
      //     // const link = document.createElement('a')
      //     // link.href= dataUrl;
      //     // link.download = getDraftName(draft)+"_detailview.jpg";
      //     // link.click();
      
      
      
      
      //   })
      //   .catch(function (error) {
      //     console.error('oops, something went wrong!', error);
      //   });
      // }
      
      
      
      /**
      * inserts an empty row just below the clicked row
      * @param si the screen index of the row we'll insert
      * @param i the absolute (not screen) index of the row we'll insert
      */
      public insertRow(i:number) {
        
        if(this.view_only) return;
        
        const draft = this.tree.getDraft(this.id);
        let loom = this.tree.getLoom(this.id);
        const loom_settings = this.tree.getLoomSettings(this.id);
        
        draft.drawdown = insertDrawdownRow(draft.drawdown, i, null);
        draft.rowShuttleMapping = insertMappingRow(draft.rowShuttleMapping, i, 1);
        draft.rowSystemMapping = insertMappingRow(draft.rowSystemMapping, i, 0);
        const utils = getLoomUtilByType(loom_settings.type);
        loom = utils.insertIntoTreadling(loom, i, []);
        
        if(this.dm.isSelectedDraftEditSource('drawdown')){
          this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
          .then(loom => {
            this.redraw(draft, loom, loom_settings, {drawdown: true, loom:true, weft_systems: true, weft_materials:true});
            this.rowShuttleMapping = draft.rowShuttleMapping;
            this.onDrawdownUpdated.emit(draft);
          })
        }else{
          this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
          .then(draft => {
            this.redraw(draft, loom, loom_settings, {drawdown: true, loom:true, weft_systems: true, weft_materials:true});
            this.rowShuttleMapping = draft.rowShuttleMapping;
            this.onDrawdownUpdated.emit(draft);
            
          })
        }
        
        
        
      }

      public afterSelectAction(){
        const draft = this.tree.getDraft(this.id);
        this.onDrawdownUpdated.emit(draft);
      }
      
      public cloneRow(i: number) {
        
        if(this.view_only) return;
        
        const draft = this.tree.getDraft(this.id);
        const loom_settings = this.tree.getLoomSettings(this.id);
        let loom = this.tree.getLoom(this.id);
        
        
        draft.drawdown = insertDrawdownRow(draft.drawdown, i, draft.drawdown[i].slice());
        draft.rowShuttleMapping = insertMappingRow(draft.rowShuttleMapping, i,draft.rowShuttleMapping[i]);
        draft.rowSystemMapping = insertMappingRow(draft.rowSystemMapping, i,draft.rowSystemMapping[i]);
        const utils = getLoomUtilByType(loom_settings.type);
        
        
        if(this.dm.isSelectedDraftEditSource('drawdown')){
          this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
          .then(loom => {
            this.redraw(draft, loom, loom_settings, {drawdown: true, loom:true, weft_systems: true, weft_materials:true});
            this.rowShuttleMapping = draft.rowShuttleMapping;
            this.onDrawdownUpdated.emit(draft);
            
          })
        }else{
          loom = utils.insertIntoTreadling(loom, i, loom.treadling[i].slice());
          
          this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
          .then(draft => {
            this.redraw(draft, loom, loom_settings, {drawdown: true, loom:true, weft_systems: true, weft_materials:true});
            this.rowShuttleMapping = draft.rowShuttleMapping;
            this.onDrawdownUpdated.emit(draft);
            
          })
        }
        
      }
      
      public deleteRow(i:number) {
        if(this.view_only) return;
                
        const draft = this.tree.getDraft(this.id);
        const loom_settings = this.tree.getLoomSettings(this.id);
        let loom = this.tree.getLoom(this.id);
        
        draft.drawdown = deleteDrawdownRow(draft.drawdown, i);
        draft.rowShuttleMapping = deleteMappingRow(draft.rowShuttleMapping, i)
        
        draft.rowSystemMapping = deleteMappingRow(draft.rowSystemMapping, i)
        const utils = getLoomUtilByType(loom_settings.type);
        loom = utils.deleteFromTreadling(loom, i);
        
        
        if(this.dm.isSelectedDraftEditSource('drawdown')){
          this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
          .then(loom => {
            this.redraw(draft, loom, loom_settings, {drawdown: true, loom:true, weft_systems: true, weft_materials:true});
            this.rowShuttleMapping = draft.rowShuttleMapping;
            this.onDrawdownUpdated.emit(draft);
            
          })
        }else{
          this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
          .then(draft => {
            this.redraw(draft, loom, loom_settings, {drawdown: true, loom:true, weft_systems: true, weft_materials:true});
            this.rowShuttleMapping = draft.rowShuttleMapping;
            this.onDrawdownUpdated.emit(draft);
            
          })
        }
      }
      
      /**
      * In
      * @extends WeaveComponent
      * @returns {void}
      */
      public insertCol(j: number) {
        if(this.view_only) return;
        
        const draft = this.tree.getDraft(this.id);
        let loom = this.tree.getLoom(this.id);
        const loom_settings = this.tree.getLoomSettings(this.id);
        
        draft.drawdown = insertDrawdownCol(draft.drawdown, j, null);
        draft.colShuttleMapping = insertMappingCol(draft.colShuttleMapping, j, 0);
        draft.colSystemMapping = insertMappingCol(draft.colSystemMapping, j, 0);
        const utils = getLoomUtilByType(loom_settings.type);
        loom = utils.insertIntoThreading(loom, j, -1);
        
        if(this.dm.isSelectedDraftEditSource('drawdown')){
          this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
          .then(loom => {
            this.redraw(draft, loom, loom_settings, {drawdown: true, loom:true, warp_systems: true, warp_materials:true});
            this.colShuttleMapping = draft.colShuttleMapping;
            this.onDrawdownUpdated.emit(draft);
            
          })
          
        }else{
          
          this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
          .then(draft => {
            this.redraw(draft, loom, loom_settings, {drawdown: true, loom:true, warp_systems: true, warp_materials:true});
            this.colShuttleMapping = draft.colShuttleMapping;
            this.onDrawdownUpdated.emit(draft);
            
          })
          
        }
        
      }
      
      public cloneCol(j: number) {
        if(this.view_only) return;
        
        const draft = this.tree.getDraft(this.id);
        const loom_settings = this.tree.getLoomSettings(this.id);
        let loom = this.tree.getLoom(this.id);
        
        const col:Array<Cell> =draft.drawdown.reduce((acc, el) => {
          acc.push(el[j]);
          return acc;
        }, []); 
        
        draft.drawdown = insertDrawdownCol(draft.drawdown, j, col);
        draft.colShuttleMapping = insertMappingCol(draft.colShuttleMapping, j, draft.colShuttleMapping[j]);
        draft.colSystemMapping = insertMappingCol(draft.colSystemMapping, j, draft.colSystemMapping[j]);
        const utils = getLoomUtilByType(loom_settings.type);
        
        
        if(this.dm.isSelectedDraftEditSource('drawdown')){
          this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
          .then(loom => {
            this.redraw(draft, loom, loom_settings, {drawdown: true, loom:true, warp_systems: true, warp_materials:true});
            this.colShuttleMapping = draft.colShuttleMapping;
            this.onDrawdownUpdated.emit(draft);
            
          })
          
        }else{
          loom = utils.insertIntoThreading(loom, j, loom.threading[j]);
          
          this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
          .then(draft => {
            this.redraw(draft, loom, loom_settings, {drawdown: true, loom:true, warp_systems: true, warp_materials:true});
            this.colShuttleMapping = draft.colShuttleMapping;
            this.onDrawdownUpdated.emit(draft);
            
          })
          
        }
        
      }
      
      
      public deleteCol(j: number) {
        if(this.view_only) return;
        
        const draft = this.tree.getDraft(this.id);
        const loom_settings = this.tree.getLoomSettings(this.id);
        let loom = this.tree.getLoom(this.id);
        
        draft.drawdown = deleteDrawdownCol(draft.drawdown, j);
        draft.colShuttleMapping = deleteMappingCol(draft.colShuttleMapping, j);
        draft.colSystemMapping = deleteMappingCol(draft.colSystemMapping, j);
        const utils = getLoomUtilByType(loom_settings.type);
        loom = utils.deleteFromThreading(loom, j);
        
        
        if(this.dm.isSelectedDraftEditSource('drawdown')){
          this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
          .then(loom => {
            this.redraw(draft, loom, loom_settings, {drawdown: true, loom:true, warp_systems: true, warp_materials:true});
            this.colShuttleMapping = draft.colShuttleMapping;            
            this.onDrawdownUpdated.emit(draft);
            
          })
          
        }else{
          this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
          .then(draft => {
            this.redraw(draft, loom, loom_settings, {drawdown: true, loom:true, warp_systems: true, warp_materials:true});
            this.colShuttleMapping = draft.colShuttleMapping;            
            this.onDrawdownUpdated.emit(draft);
            
          })
          
        }
      }
      

      
      
      
      
      swapEditingStyle(){
        const loom_settings = this.tree.getLoomSettings(this.id);
        if(loom_settings.type !== 'jacquard'){
          this.selection.onSelectCancel();
        }
        
      }
      
      
      
      
      
      
      
      
      
      
      
      
      public checkForPaint(source: string, index: number, event: any){
        const draft = this.tree.getDraft(this.id);
        if(this.dm.isSelectedPencil('material') && this.mouse_pressed){
          if(source == 'weft') draft.rowShuttleMapping[index] = this.selected_material_id;
          if(source == 'warp') draft.colShuttleMapping[index] = this.selected_material_id;
          this.onMaterialChange.emit();
        } 
      }
      
      public drawOnWarpMaterials(draft: Draft, currentPos: Interlacement){
        const loom = this.tree.getLoom(this.id);
        const loom_settings = this.tree.getLoomSettings(this.id);
        draft.colShuttleMapping[currentPos.j] = this.selected_material_id;
        this.tree.setDraftOnly(this.id, draft);
        this.redraw(draft, loom, loom_settings, {drawdown: true, warp_systems: true});
        this.onMaterialChange.emit();
      }
      
      public drawOnWeftMaterials(draft: Draft, currentPos: Interlacement){
        const loom = this.tree.getLoom(this.id);
        const loom_settings = this.tree.getLoomSettings(this.id);
        draft.rowShuttleMapping[currentPos.i] = this.selected_material_id;
        this.tree.setDraftOnly(this.id, draft);
        this.redraw(draft, loom, loom_settings, {drawdown: true, weft_systems: true});
        this.onMaterialChange.emit();
      }
      
      
      
      public updateWarpSystems(pattern: Array<number>) {
        const draft = this.tree.getDraft(this.id);
        const loom = this.tree.getLoom(this.id);
        const loom_settings = this.tree.getLoomSettings(this.id);
        draft.colSystemMapping = generateMappingFromPattern(draft.drawdown, pattern, 'col');
        this.tree.setDraftOnly(this.id, draft);
        this.redraw(draft, loom, loom_settings, {drawdown: true, warp_systems: true});
        
      }
      
      public updateWeftSystems(pattern: Array<number>) {
        const draft = this.tree.getDraft(this.id);
        const loom = this.tree.getLoom(this.id);
        const loom_settings = this.tree.getLoomSettings(this.id);
        draft.rowSystemMapping =  generateMappingFromPattern(draft.drawdown, pattern, 'row');
        this.rowSystemMapping = draft.rowSystemMapping.slice();
        this.tree.setDraftOnly(this.id, draft);
        this.redraw(draft, loom, loom_settings, {drawdown: true, weft_systems: true});
        
      }
      
      public updateWarpShuttles(pattern: Array<number>) {
        const draft = this.tree.getDraft(this.id);
        const loom = this.tree.getLoom(this.id);
        const loom_settings = this.tree.getLoomSettings(this.id);
        
        draft.colShuttleMapping = generateMappingFromPattern(draft.drawdown, pattern, 'col');
        this.tree.setDraftOnly(this.id, draft);
        this.colShuttleMapping = draft.colShuttleMapping.slice();
        
        this.redraw(draft, loom, loom_settings,{drawdown: true, warp_materials: true});
        this.onMaterialChange.emit();
        
      }
      
      public updateWeftShuttles(pattern: Array<number>) {
        const draft = this.tree.getDraft(this.id);
        const loom = this.tree.getLoom(this.id);
        const loom_settings = this.tree.getLoomSettings(this.id);
        draft.rowShuttleMapping = generateMappingFromPattern(draft.drawdown, pattern, 'row');
        this.tree.setDraftOnly(this.id, draft);
        this.rowShuttleMapping = draft.rowShuttleMapping.slice();
        this.redraw(draft, loom, loom_settings,{drawdown: true, weft_materials: true});
        
        this.onMaterialChange.emit();
        
      }
      
      
      // /**
      // * Updates the canvas based on the weave view.
      // * @extends WeaveComponent
      // * @param {Event} e - view change event from design component.
      // * @returns {void}
      // */
      // public viewChange(value: any) {
        
      //   const draft = this.tree.getDraft(this.id);
      //   const loom = this.tree.getLoom(this.id);
      //   const loom_settings = this.tree.getLoomSettings(this.id);
        
      //   this.redraw(draft, loom, loom_settings,  {
      //     drawdown: true
      //   });
      // }
      
      // public renderChange(){
        
        
        
      // }
      
      
      // public redrawLoomAndDraft(){
      
      //   const draft = this.tree.getDraft(this.id)
      //   const loom = this.tree.getLoom(this.id)
      //   const loom_settings = this.tree.getLoomSettings(this.id);
      //   this.render.updateVisible(draft);
      
      //   const is_frame = isFrame(loom_settings);
      //   if(is_frame){
      //     this.isFrame = true;
      //   }else{
      //     this.isFrame = false;
      //   }
      //   this.colShuttleMapping = draft.colShuttleMapping.slice();
      //   this.rowShuttleMapping = draft.rowShuttleMapping.slice();
      //   this.redraw(draft, loom, loom_settings,{drawdown: true, loom:true, warp_systems: true, warp_materials: true, weft_systems: true, weft_materials:true});
      
      // }
      
      
    
      // public createWarpSystem(e: any) {
      //   this.draft.addWarpSystem(e.system);
      // }
      
      // public createWeftSystem(e: any) {
      //   this.draft.addWarpSystem(e.system);
      // }
      
      // public hideWarpSystem(e:any) {
      
      //   //this.weaveRef.redraw({drawdown: true, loom:true, warp_systems: true, warp_materials:true});
      // }
      
      // public showWarpSystem(e:any) {
      
      //  // this.weaveRef.redraw({drawdown: true, loom:true, warp_systems: true, warp_materials:true});
      // }  
      
      // public hideWeftSystem(e:any) {
      //   const draft = this.tree.getDraft(this.id);
      //   const loom = this.tree.getLoom(this.id);
      //   const loom_settings = this.tree.getLoomSettings(this.id);
      
      //   this.render.updateVisible(draft);
      
      //   // this.weaveRef.redraw(draft, loom, loom_settings, {drawdown: true, loom:true, weft_systems: true, weft_materials:true});
      // }
      
      // public showWeftSystem(e:any) {
      //   const draft = this.tree.getDraft(this.id);
      //   const loom = this.tree.getLoom(this.id);
      //   const loom_settings = this.tree.getLoomSettings(this.id);
      
      //   this.render.updateVisible(draft);
      
      //   // this.weaveRef.redraw(draft, loom, loom_settings,{drawdown: true, loom:true, weft_systems: true, weft_materials:true});
      // }
      
      
      
      
      
      
      
    }
    