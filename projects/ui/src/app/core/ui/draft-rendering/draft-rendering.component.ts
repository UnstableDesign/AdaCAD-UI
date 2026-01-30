import { AsyncPipe } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Cell, Draft, Interlacement, Loom, LoomSettings } from 'adacad-drafting-lib';
import { Drawdown, createCell, deleteDrawdownCol, deleteDrawdownRow, deleteMappingCol, deleteMappingRow, generateMappingFromPattern, getCellValue, hasCell, insertDrawdownCol, insertDrawdownRow, insertMappingCol, insertMappingRow, isUp, setHeddle, warps, wefts } from 'adacad-drafting-lib/draft';
import { getLoomUtilByType, isInUserThreadingRange, isInUserTieupRange, isInUserTreadlingRange, numFrames, numTreadles } from 'adacad-drafting-lib/loom';
import { BehaviorSubject, Observable, Subscription, fromEvent, of, skip } from 'rxjs';
import { CanvasList, DraftNode, DraftNodeBroadcastFlags, DraftNodeState, DraftStateChange, RenderingFlags } from '../../model/datatypes';
import { defaults } from '../../model/defaults';
import { FileService } from '../../provider/file.service';
import { MaterialsService } from '../../provider/materials.service';
import { OperationService } from '../../provider/operation.service';
import { RenderService } from '../../provider/render.service';
import { StateService } from '../../provider/state.service';
import { SystemsService } from '../../provider/systems.service';
import { TreeService } from '../../provider/tree.service';
import { ViewerService } from '../../provider/viewer.service';
import { WorkspaceService } from '../../provider/workspace.service';
import { ZoomService } from '../../provider/zoom.service';
import { SelectionComponent } from './selection/selection.component';

@Component({
  selector: 'app-draft-rendering',
  templateUrl: './draft-rendering.component.html',
  styleUrl: './draft-rendering.component.scss',
  imports: [SelectionComponent, AsyncPipe, MatButton, ReactiveFormsModule, MatInputModule, MatFormFieldModule]
})


export class DraftRenderingComponent implements OnInit {

  private fs = inject(FileService);
  private ms = inject(MaterialsService);
  private ss = inject(SystemsService);
  ws = inject(WorkspaceService);
  timeline = inject(StateService);
  private tree = inject(TreeService);
  private ops = inject(OperationService);
  render = inject(RenderService);
  vs = inject(ViewerService);
  private zs = inject(ZoomService);
  private state = inject(StateService);


  @ViewChild('bitmapImage') bitmap;
  @ViewChild('selection', { read: SelectionComponent, static: true }) selection: SelectionComponent;

  @Input('id') id: number = -1;
  @Input('source') source: 'editor' | 'viewer' | 'mixer' | 'library';
  @Input('current_view') current_view: 'draft' | 'structure' | 'visual' | 'sim' = 'visual';
  @Input('view_only') view_only: boolean;
  @Input('scale') scale: number;
  @Input('oversize') oversize: boolean = false;

  @Output() onNewSelection = new EventEmitter();


  hold_copy_for_paste: boolean = false;

  //store this here as you need it to draw the view
  colShuttleMapping: Array<number> = [];
  rowShuttleMapping: Array<number> = [];
  colSystemMapping: Array<number> = [];
  rowSystemMapping: Array<number> = [];



  before: DraftNodeState;

  mouse_pressed: boolean = false;

  moveSubscription: Subscription;


  divWesy: HTMLElement;
  divWasy: HTMLElement;

  svgSelectRow: HTMLElement;
  svgSelectCol: HTMLElement;

  canvases: CanvasList = null;

  private lastPos: Interlacement;

  //for copy paste
  private tempPattern: Drawdown;


  /** VIEW OPTIONS */

  system_codes: Array<string> = [];

  //use this to set the current width of the warp text. This will change with the warp canvas changes
  warp_text_div_width: string = '1000px';

  //use this to set the current width of the warp text. This will change with the warp canvas changes
  weft_text_div_height: string = '1000px';

  pencil = 'toggle'; //toggle, up, down, unset, material
  draft_edit_source = 'drawdown'; //drawdown, loom
  use_sizes: boolean = false;
  selected_material_id: number = 0; //if material is set an pencil

  ignoreOversize: boolean = false;


  isRedrawing: boolean = false;
  overTimeLimit$: Observable<boolean> = of(false);
  redrawComplete = new EventEmitter();

  selected_loom_type: string = 'frame';

  //published from the draft node whenever a new draft is set. 
  draftValueChangeSubscription: Subscription;


  //used to determine if this is the first time the subscription is called (onLoad) vs (onUpdate)
  draftValueChangeCallCount: number = 0;

  materialColorChangeSubscription: Subscription;
  materialDiameterChangeSubscription: Subscription;


  draftRenderingEvent$: BehaviorSubject<string>;

  pencilChange$: BehaviorSubject<string>;

  eventTargetSet$: BehaviorSubject<HTMLElement>;



  constructor() {

    this.system_codes = defaults.weft_system_codes;
    this.pencilChange$ = new BehaviorSubject<string>('toggle');
    this.eventTargetSet$ = new BehaviorSubject<HTMLElement>(null);

  }

  setPencil(pencil: string, material_id?: number) {
    this.pencil = pencil;
    this.pencilChange$.next(pencil);
    if (material_id !== undefined) {
      this.selected_material_id = material_id;
    }
    if (this.pencil !== 'select') {
      this.unsetSelection();
    }
  }

  setDraftEditSource(draft_edit_source: string) {
    this.draft_edit_source = draft_edit_source;
  }



  /**
   * Checks if a specific draft edit source is currently selected
   * @param value - The source to check ('drawdown' or 'loom')
   * @returns true if the source is selected
   */
  isSelectedDraftEditSource(value: string): boolean {
    return this.draft_edit_source === value;
  }

  /**
   * Checks if a specific pencil mode is currently selected
   * @param value - The pencil mode to check
   * @returns true if the pencil mode is selected
   */
  isSelectedPencil(value: string): boolean {
    return this.pencil === value;
  }

  ngOnInit() {

    if (this.source == 'viewer' || this.source == 'editor') this.ignoreOversize = true;

    this.materialColorChangeSubscription = this.ms.materialColorChange.pipe(skip(1)).subscribe(id => {
      this.forceRedraw();
    });

    this.materialDiameterChangeSubscription = this.ms.materialDiameterChange.pipe(skip(1)).subscribe(id => {
      this.forceRedraw();
    });
  }

  ngAfterViewInit() {

    //define the elements and context of the weave draft, threading, treadling, and tieups.
    const canvasEl = <HTMLCanvasElement>document.getElementById('drawdown-' + this.source + '-' + this.id);
    const threadingCanvas = <HTMLCanvasElement>document.getElementById('threading-' + this.source + '-' + this.id);
    const tieupsCanvas = <HTMLCanvasElement>document.getElementById('tieups-' + this.source + '-' + this.id);
    const treadlingCanvas = <HTMLCanvasElement>document.getElementById('treadling-' + this.source + '-' + this.id);
    const warp_systems_canvas =
      <HTMLCanvasElement>document.getElementById('warp-systems-' + this.source + '-' + this.id);
    const warp_mats_canvas = <HTMLCanvasElement>document.getElementById('warp-materials-' + this.source + '-' + this.id);
    const weft_systems_canvas = <HTMLCanvasElement>document.getElementById('weft-systems-' + this.source + '-' + this.id);
    const weft_mats_canvas = <HTMLCanvasElement>document.getElementById('weft-materials-' + this.source + '-' + this.id);


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
    if (this.id == -1) return;



    this.divWesy = document.getElementById('weft-systems-text-' + this.source + '-' + this.id);
    this.divWasy = document.getElementById('warp-systems-text-' + this.source + '-' + this.id);
    this.refreshWarpAndWeftSystemNumbering();
    this.refreshOriginMarker();


  }


  /**
   * if we are editing a draft in mixer view, we need a way to recompute any children of that draft
   * however, these recomputations would slow down the editing and if the mixer isn't in view, 
   * we will call it manually elsewhere
   */
  recomputeChildren() {
    if (this.source == 'mixer') {

      const recomputationPromise = new Promise((resolve, reject) => {
        this.tree.recomputeDraftChildren(this.id).then(res => {
          resolve(res);
        }).catch(err => {
          reject(err);
        });
      });

      return recomputationPromise;
    }
  }



  setDefaultEditingMode(source: 'editor' | 'viewer' | 'library' | 'mixer') {
    switch (source) {
      case 'editor':
        this.view_only = false;
        this.setPencil('toggle');

        if (this.selected_loom_type === 'jacquard') {
          this.setDraftEditSource('drawdown');
        } else {
          this.setDraftEditSource('loom');
        }
        break;
      case 'viewer':
      case 'library':
        this.view_only = true;
        this.setPencil('select');
        this.setDraftEditSource('drawdown');
        break;
      case 'mixer':

        if (this.tree.hasParent(this.id)) {
          this.view_only = true;
          this.setPencil('select');
          this.setDraftEditSource('drawdown');
          break;
        } else {
          this.view_only = false;
          this.setPencil('toggle');
          this.setDraftEditSource('drawdown');
          break;
        }
    }
  }



  //this is called anytime a new draft object is loaded into this rendering window. Generally, this should only happen in the viewer and editor
  onNewDraftLoaded(id: number) {
    this.id = id;

    if (id == -1) return;

    let node = this.tree.getNode(id) as DraftNode;
    this.selected_loom_type = this.tree.getLoomSettings(this.id).type;


    this.setDefaultEditingMode(this.source);




    if (node.type !== 'draft') {
      return;
    }

    if (this.draftValueChangeSubscription) {
      this.draftValueChangeCallCount = 0;
      this.draftValueChangeSubscription.unsubscribe();
    }


    this.draftValueChangeSubscription = node.onValueChange.subscribe(draftNodeBroadcast => {
      console.log("DRAFT VALUE CHANGE SUBSCRIPTION CALLED", draftNodeBroadcast, this.use_sizes);
      const draft = draftNodeBroadcast.draft;
      const loom = draftNodeBroadcast.loom;
      const loom_settings = (draftNodeBroadcast.loom_settings != null) ? draftNodeBroadcast.loom_settings : defaults.loom_settings;
      const flags: RenderingFlags = {
        u_drawdown: draftNodeBroadcast.flags.draft || this.draftValueChangeCallCount === 0,
        u_threading: draftNodeBroadcast.flags.loom || this.draftValueChangeCallCount === 0,
        u_tieups: draftNodeBroadcast.flags.loom || this.draftValueChangeCallCount === 0,
        u_treadling: draftNodeBroadcast.flags.loom || this.draftValueChangeCallCount === 0,
        u_warp_sys: draftNodeBroadcast.flags.draft || this.draftValueChangeCallCount === 0,
        u_warp_mats: draftNodeBroadcast.flags.materials || this.draftValueChangeCallCount === 0,
        u_weft_sys: draftNodeBroadcast.flags.draft || this.draftValueChangeCallCount === 0,
        u_weft_mats: draftNodeBroadcast.flags.materials || this.draftValueChangeCallCount === 0,
        use_floats: (this.current_view !== 'draft'),
        use_colors: (this.current_view == 'visual'),
        show_loom: (this.source === 'editor'),
        use_sizes: this.use_sizes
      };
      this.colShuttleMapping = draft !== null ? draft.colShuttleMapping.slice() : [];
      this.colSystemMapping = draft !== null ? draft.colSystemMapping.slice() : [];
      this.rowShuttleMapping = draft !== null ? draft.rowShuttleMapping.slice() : [];
      this.rowSystemMapping = draft !== null ? draft.rowSystemMapping.slice() : [];
      this.selected_loom_type = (loom_settings != null) ? loom_settings.type : 'jacquard';

      if (draft !== null) {


        this.redraw(draft, loom, loom_settings, flags).then(el => {
          this.draftValueChangeCallCount++;
          this.refreshOriginMarker();
          this.refreshWarpAndWeftSystemNumbering();
          this.redrawComplete.emit(draft); // I need this so that any resulting functions (e.g. recentering, etc, can call after redrawing)
        });
      }
    });

  }

  clearSelection() {
    this.selection.unsetParameters();
    this.selection.removeCopy();
    // d3.select(this.svgSelectCol).style('display', 'none');
    // d3.select(this.svgSelectRow).style('display', 'none');
  }

  ngOnDestroy() {

    if (this.materialColorChangeSubscription) {
      this.materialColorChangeSubscription.unsubscribe();
    }
    if (this.materialDiameterChangeSubscription) {
      this.materialDiameterChangeSubscription.unsubscribe();
    }
    if (this.moveSubscription) {
      this.moveSubscription.unsubscribe();
    }
    if (this.draftValueChangeSubscription) {
      this.draftValueChangeSubscription.unsubscribe();
    }

  }


  highlightRowsAndCols(draft: Draft, event: MouseEvent, currentPos: Interlacement) {


    const highlightRow = document.getElementById('highlight-row-editor');
    const highlightCol = document.getElementById('highlight-col-editor');

    let cell_size = this.render.calculateRawPixelCellSize(draft, 'canvas');
    cell_size = cell_size / this.render.pixel_ratio;
    const parentContainer = highlightRow.parentElement;
    const rect = parentContainer.getBoundingClientRect();
    //event page X is the mouse in absolute terms, rect left is the corner of the parent container
    //so event.client - rect gives us the distance of the mouse within the parent container. 
    //when we set the div, we have to consider the scale so we divide by scale 
    const x = (event.clientX - rect.left) / this.zs.getEditorZoom();
    const y = (event.clientY - rect.top) / this.zs.getEditorZoom();

    highlightRow.style.top = `${y - cell_size / 2}px`;
    highlightCol.style.left = `${x - cell_size / 2}px`;

    highlightRow.style.display = 'block';
    highlightCol.style.display = 'block';
    // highlightRow.style.top = `${currentPos.i * this.render.calculateCellSize(draft) * this.scale}px`;
    // highlightCol.style.left = `${currentPos.j * this.render.calculateCellSize(draft) * this.scale}px`;
  }

  removeHighlighter() {

    const highlightRow = document.getElementById('highlight-row-editor');
    const highlightCol = document.getElementById('highlight-col-editor');
    highlightRow.style.display = 'none';
    highlightCol.style.display = 'none';
  }

  /**
  *  takes an event from mouse event and determines how to handle it 
  * @param target the dom target of the mouse click
  * @param shift whether or not the shift key is being held
  * @param currentPos the position of the click within the target
  */
  setPosAndDraw(target: HTMLElement, shift: boolean, currentPos: Interlacement) {

    if (this.view_only) return;


    const draft = this.tree.getDraft(this.id);
    const loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);


    const editing_style = this.draft_edit_source;

    if (target && target.id == 'warp-materials-' + this.source + '-' + this.id) {
      if (this.pencil == 'material') this.drawOnWarpMaterials(draft, currentPos);
      else this.incrementWarpMaterial(currentPos.j);

    } else if (target && target.id == 'warp-systems-' + this.source + '-' + this.id) {
      this.incrementWarpSystem(currentPos.j);

    } else if (target && target.id == 'weft-materials-' + this.source + '-' + this.id) {
      if (this.pencil == 'material') this.drawOnWeftMaterials(draft, currentPos)
      else this.incrementWeftMaterial(currentPos.i)

    } else if (target && target.id == 'weft-systems-' + this.source + '-' + this.id) {
      this.incrementWeftSystem(currentPos.i);

    } else if (target && target.id == 'treadling-' + this.source + '-' + this.id) {
      if (editing_style == "loom") this.drawOnTreadling(loom, loom_settings, currentPos);

    } else if (target && target.id === 'tieups-' + this.source + '-' + this.id) {
      if (loom_settings.type === "direct") return;
      if (editing_style == "loom") this.drawOnTieups(loom, loom_settings, currentPos);

    } else if (target && target.id === ('threading-' + this.source + '-' + this.id)) {
      if (editing_style == "loom") this.drawOnThreading(loom, loom_settings, currentPos);
    } else {
      if (editing_style == "drawdown" || (this.source == 'mixer' && !this.tree.hasParent(this.id))) this.drawOnDrawdown(draft, loom_settings, currentPos, shift);
    }

  }



  handleStartEvent(event: MouseEvent, currentPos: Interlacement) {

    if (!event.target) return;

    this.eventTargetSet$.next(event.target as HTMLElement);

    //remove any prior move subscriptions. 
    if (this.moveSubscription) {
      this.moveSubscription.unsubscribe();
    }


    //if shift drag happens at any time, move into select (but how to switch out)
    if (this.source == 'editor' && (event.metaKey || event.ctrlKey || event.shiftKey) && this.pencil !== 'select') {
      this.setPencil('select');
    } else if (!(event.metaKey || event.ctrlKey || event.shiftKey) && this.pencil == 'select' && !this.selection.hasCopy()) {
      this.selection.unsetParameters();
      this.setPencil('toggle');
    }

    switch (this.pencil) {
      case 'up':
      case 'down':
      case 'unset':
      case 'material':
      case 'toggle':
        this.setPosAndDraw(<HTMLElement>event.target, event.shiftKey, currentPos);
        if (this.moveSubscription) this.moveSubscription.unsubscribe();
        this.moveSubscription = fromEvent(event.target, 'mousemove').subscribe(e => this.onDrawMove(e));

        break;
    }

    switch (this.pencil) {
      case 'select':
        if (this.moveSubscription) this.moveSubscription.unsubscribe();
        this.moveSubscription = fromEvent(event.target, 'mousemove').subscribe(e => this.onSelectMove(e));
        this.selection.onSelectStart(<HTMLElement>event.target as HTMLElement, currentPos);
        break;
    }
  }

  private onSelectMove(event) {
    const currentPos = this.getEventPosition(event);
    if (this.isSame(currentPos, this.lastPos)) return;

    if (!this.inBounds(currentPos, event.target as HTMLElement) || !this.mouse_pressed) {
      this.handleMouseEvent(event, 'end', currentPos);
      return;
    }

    this.selection.onSelectDrag(currentPos);
    this.lastPos = {
      i: currentPos.i, //row
      j: currentPos.j //col
    };
  }


  private onDrawMove(event) {

    const currentPos = this.getEventPosition(event);
    //don't call unless you've moved to a new spot
    if (this.isSame(currentPos, this.lastPos)) return;
    if (!this.inBounds(currentPos, event.target as HTMLElement) || !this.mouse_pressed) {
      this.handleMouseEvent(event, 'end', currentPos);
      return;
    }



    this.setPosAndDraw(<HTMLElement>event.target, event.shiftKey, currentPos);
    this.lastPos = {
      i: currentPos.i, //row
      j: currentPos.j //col
    };
  }


  handleLeaveEvent(event: MouseEvent) {

    if (this.moveSubscription) this.moveSubscription.unsubscribe();

    switch (this.pencil) {
      case 'select':
        this.selection.onSelectStop(true);
        break;
      case 'up':
      case 'down':
      case 'unset':
      case 'material':
      case 'toggle':
        this.addStateChange(this.before);
        this.updateConnectedDraftComponents(this.tree.getDraft(this.id), this.tree.getLoom(this.id), this.tree.getLoomSettings(this.id));
        break;
    }


  }

  handleEndEvent(event: MouseEvent) {
    if (this.moveSubscription) this.moveSubscription.unsubscribe();

    switch (this.pencil) {
      case 'select':
        this.selection.onSelectStop(false);
        break;
      case 'up':
      case 'down':
      case 'unset':
      case 'material':
      case 'toggle':

        this.addStateChange(this.before);
        this.updateConnectedDraftComponents(this.tree.getDraft(this.id), this.tree.getLoom(this.id), this.tree.getLoomSettings(this.id));
        break;
    }
  }

  isValidTarget(target: HTMLElement): boolean {


    if (target.tagName !== 'CANVAS') return false;

    let loom_type = this.tree.getLoomSettings(this.id)?.type || 'jacquard';

    switch (this.draft_edit_source) {
      case 'drawdown':
        if (target.id.startsWith('drawdown-')) return true;
        if (target.id.startsWith('treadling-')) return false;
        if (target.id.startsWith('tieups-')) return false;
        if (target.id.startsWith('threading-')) return false;
        if (target.id.startsWith('warp-')) return true;
        if (target.id.startsWith('weft-')) return true;
      case 'loom':
        if (target.id.startsWith('drawdown-')) return false;
        if (target.id.startsWith('treadling-')) return true;
        if (target.id.startsWith('tieups-')) return loom_type == 'frame';
        if (target.id.startsWith('threading-')) return true;
        if (target.id.startsWith('warp-')) return true;
        if (target.id.startsWith('weft-')) return true;
      default:
        return false;
    }

  }

  inBounds(pos: Interlacement, target: HTMLElement): boolean {

    const ls = this.tree.getLoomSettings(this.id);
    const loom = this.tree.getLoom(this.id);
    const draft = this.tree.getDraft(this.id);


    const frames = Math.max(numFrames(loom), ls.frames);
    const treadles = Math.max(numTreadles(loom), ls.treadles);
    const warps_count: number = warps(draft.drawdown);
    const wefts_count: number = wefts(draft.drawdown);


    const targetNameArray = target.id.split('-');
    const targetName = (targetNameArray.length > 0) ? targetNameArray[0] : null;

    switch (targetName) {
      case 'drawdown':
        return pos.j >= 0 && pos.j < warps_count && pos.i >= 0 && pos.i < wefts_count;
      case 'treadling':
        return pos.j >= 0 && pos.j < treadles && pos.i >= 0 && pos.i < wefts_count;
      case 'tieups':
        return pos.j >= 0 && pos.j < treadles && pos.i >= 0 && pos.i < frames;
      case 'threading':
        return pos.i >= 0 && pos.i < frames && pos.j >= 0 && pos.j < warps_count;
      case 'warp':
        return pos.i == 0 && pos.j >= 0 && pos.j < warps_count;
      case 'weft':
        return pos.j == 0 && pos.i >= 0 && pos.i < wefts_count;
      default:
        return false;
    }




  }


  handleMouseEvent(event: MouseEvent, stage: 'start' | 'move' | 'leave' | 'end', currentPos: Interlacement) {

    //make sure the mouse is down before calling any of these, 


    switch (stage) {
      case 'start':
        if (!this.isValidTarget(event.target as HTMLElement)) {
          return;
        }

        if (!this.inBounds(currentPos, event.target as HTMLElement)) return;


        this.before = this.tree.getDraftNodeState(this.id);
        this.handleStartEvent(event, currentPos);
        this.lastPos = {
          i: currentPos.i,
          j: currentPos.j
        };

        break;
      case 'move':
        //handeled by onDrawMoveSubscription or onSelectMoveSubscription

        break;
      case 'leave':
        if (!this.mouse_pressed) return;
        this.handleLeaveEvent(event);
        this.lastPos = {
          i: -1,
          j: -1
        }


        break;
      case 'end':
        this.handleEndEvent(event);
        break;
    }


  }





  private getEventPosition(event: MouseEvent): Interlacement {
    const draft = this.tree.getDraft(this.id);
    let cell_size = this.render.calculateRawPixelCellSize(draft, 'canvas');
    cell_size = cell_size / this.render.pixel_ratio;
    var screen_row = Math.floor(event.offsetY / (cell_size * this.scale));
    var screen_col = Math.floor(event.offsetX / (cell_size * this.scale));
    return {
      i: screen_row,
      j: screen_col
    };
  }


  private isSame(p1: Interlacement, p2: Interlacement) {
    if (p1 === undefined || p2 === undefined) return false
    return (p1.i == p2.i && p1.j === p2.j);

  }

  /**
   * update the row/column visualizer
   * @param event 
   * @returns 
   */
  @HostListener('mousemove', ['$event'])
  public movingMouse(event) {

    if (this.view_only) return;
    const draft = this.tree.getDraft(this.id);
    const currentPos = this.getEventPosition(event);
    if (this.source == 'editor') this.highlightRowsAndCols(draft, event, currentPos);
  }


  @HostListener('mousedown', ['$event'])
  public onStart(event) {

    this.mouse_pressed = true;
    this.before = this.tree.getDraftNodeState(this.id);
    //this.vs.setViewer(this.id);



    if (this.id == -1 || this.view_only) return;
    const currentPos = this.getEventPosition(event);
    this.handleMouseEvent(event, 'start', currentPos);
  }


  @HostListener('mouseleave', ['$event'])
  public onLeave(event) {
    if (this.source == 'editor') this.removeHighlighter();

    const currentPos = this.getEventPosition(event);
    this.handleMouseEvent(event, 'leave', currentPos);
  }




  @HostListener('mouseup', ['$event'])
  public onEnd(event) {

    this.mouse_pressed = false;
    if (this.id == -1 || this.view_only) return;
    const currentPos = this.getEventPosition(event);
    this.handleMouseEvent(event, 'end', currentPos);

  }

  /**
  * This is emitted from the selection
  */
  onSelectionEnd() {

    if (!this.selection.hasSelection()) return;

    //if(!this.hold_copy_for_paste) this.copyArea();

    this.onNewSelection.emit(
      {
        id: this.id,
        start: { i: this.selection.getStartingRowIndex(), j: this.selection.getStartingColIndex() },
        end: { i: this.selection.getEndingRowIndex(), j: this.selection.getEndingColIndex() }
      })
  }




  hasSelection(): boolean {
    return this.selection.hasSelection();
  }

  private addStateChange(before: DraftNodeState) {
    const after = this.tree.getDraftNodeState(this.id);
    const change: DraftStateChange = {
      originator: 'DRAFT',
      type: 'VALUE_CHANGE',
      id: this.id,
      before: before,
      after: after
    }
    this.before = after;
    this.state.addStateChange(change);
  }




  /**
   * to enable a streamlined workflow, if someone is drawing, we refrain from computing connected components (e.g. looms if the target is drawdown, or drawdown if the target is loom)
   * instead we do that on mouse up. Since the draft or loom has already been "set" during the edits, we just need to update the 
   * attached components, which only signal that their are changes if, indeed, changes are made
   * @param draft 
   * @param loom 
   * @param loom_settings 
   */
  updateConnectedDraftComponents(draft: Draft, loom: Loom, loom_settings: LoomSettings) {

    if (this.draft_edit_source == 'drawdown') {
      this.tree.recomputeLoom(this.id, draft, loom_settings)
        .then(loom => {
          this.rowShuttleMapping = draft.rowShuttleMapping;
        })
    } else {
      this.tree.recomputeDrawdown(this.id, loom, loom_settings)
        .then(draft => {
          this.rowShuttleMapping = draft.rowShuttleMapping;

        })
    }
  }



  public incrementWeftSystem(i: number) {
    const draft = this.tree.getDraft(this.id);
    var newSystem = this.ss.getNextWeftSystem(i, draft);
    draft.rowSystemMapping[i] = newSystem;
    this.rowSystemMapping = draft.rowSystemMapping.slice();
    const flags: DraftNodeBroadcastFlags = {
      meta: false,
      draft: true,
      loom: false,
      loom_settings: false,
      materials: false
    };
    this.tree.setDraft(this.id, draft, flags);
  }



  incrementWeftMaterial(si: number) {
    const draft = this.tree.getDraft(this.id);


    if (this.pencil == 'material') {
      draft.rowShuttleMapping[si] = this.selected_material_id;
    } else {
      const len = this.ms.getShuttles().length;
      var shuttle_id = draft.rowShuttleMapping[si];
      var newShuttle = (shuttle_id + 1) % len;
      draft.rowShuttleMapping[si] = newShuttle;
    }
    const flags: DraftNodeBroadcastFlags = {
      meta: false,
      draft: true,
      loom: false,
      loom_settings: false,
      materials: true
    };
    this.tree.setDraft(this.id, draft, flags);

  }



  incrementWarpSystem(j: number) {

    const draft = this.tree.getDraft(this.id);
    var newSystem = this.ss.getNextWarpSystem(j, draft);
    draft.colSystemMapping[j] = newSystem;

    const flags: DraftNodeBroadcastFlags = {
      meta: false,
      draft: true,
      loom: false,
      loom_settings: false,
      materials: false
    };
    this.tree.setDraft(this.id, draft, flags);


  }

  incrementWarpMaterial(col: number) {
    const warp = col;

    const draft = this.tree.getDraft(this.id);
    if (this.pencil == 'material') {
      draft.colShuttleMapping[warp] = this.selected_material_id;
    } else {
      const len = this.ms.getShuttles().length;
      var shuttle_id = draft.colShuttleMapping[warp];
      var newShuttle = (shuttle_id + 1) % len;
      draft.colShuttleMapping[warp] = newShuttle;
    }
    const flags: DraftNodeBroadcastFlags = {
      meta: false,
      draft: true,
      loom: false,
      loom_settings: false,
      materials: true
    };
    this.tree.setDraft(this.id, draft, flags);


  }



  private highlightDrawdown(draft: Draft, loom_settings: LoomSettings, currentPos: Interlacement) {
    if (this.canvases.drawdown == null || !currentPos) { return; }
    if (hasCell(draft.drawdown, currentPos.i, currentPos.j)) {
    }
  }


  private drawOnDrawdown(draft: Draft, loom_settings: LoomSettings, currentPos: Interlacement, shift: boolean) {
    var val = false;

    if (this.canvases.drawdown == null || !currentPos) { return; }



    if (hasCell(draft.drawdown, currentPos.i, currentPos.j)) {
      // Set the heddles based on the brush.
      switch (this.pencil) {
        case 'up':
          val = true;
          draft.drawdown = setHeddle(draft.drawdown, currentPos.i, currentPos.j, val);
          break;
        case 'down':
          val = false;
          draft.drawdown = setHeddle(draft.drawdown, currentPos.i, currentPos.j, val);
          break;
        case 'toggle':
          if (shift) {
            val = null;
          }
          else val = !isUp(draft.drawdown, currentPos.i, currentPos.j);
          draft.drawdown = setHeddle(draft.drawdown, currentPos.i, currentPos.j, val);
          break;
        case 'unset':
          draft.drawdown = setHeddle(draft.drawdown, currentPos.i, currentPos.j, null);
          break;
        case 'material':
          this.drawOnWeftMaterials(draft, currentPos);
          this.drawOnWarpMaterials(draft, currentPos)
          break;
        default:
          break;
      }

      const flags: DraftNodeBroadcastFlags = {
        meta: false,
        draft: true,
        loom: false,
        loom_settings: false,
        materials: true
      };
      this.tree.setDraft(this.id, draft, flags);
    }

  }


  private drawOnTieups(loom: Loom, loom_settings: LoomSettings, currentPos: Interlacement) {
    var val = false;

    if (this.canvases.tieup === null || !currentPos) { return; }


    if (isInUserTieupRange(loom, loom_settings, currentPos)) {



      switch (this.pencil) {
        case 'up':
          val = true;
          break;
        case 'down':
          val = false;
          break;
        case 'toggle':
          if (currentPos.i > loom.tieup.length || currentPos.j > loom.tieup[0].length) val = true;
          else val = !loom.tieup[currentPos.i][currentPos.j];
          break;
        default:
          break;
      }

      const utils = getLoomUtilByType(loom_settings.type);
      loom = (utils.updateTieup != null) ? utils.updateTieup(loom, { i: currentPos.i, j: currentPos.j, val: val }) : loom;
      this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings);

    }
  }


  private drawOnThreading(loom: Loom, loom_settings: LoomSettings, currentPos: Interlacement) {


    if (this.canvases.threading == null || !currentPos) { return; }

    if (isInUserThreadingRange(loom, loom_settings, currentPos)) {
      var val;
      const draft = this.tree.getDraft(this.id)


      switch (this.pencil) {
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
      if (this.pencil !== 'material') loom = (utils.updateThreading != null) ? utils.updateThreading(loom, { i: currentPos.i, j: currentPos.j, val: val }) : loom;
      this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings);
    }
  }


  private drawOnTreadling(loom: Loom, loom_settings: LoomSettings, currentPos: Interlacement) {

    if (this.canvases.treadling == null || !currentPos) { return; }
    const draft = this.tree.getDraft(this.id)
    var val = false;

    if (isInUserTreadlingRange(loom, loom_settings, currentPos)) {
      switch (this.pencil) {
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
      if (this.pencil !== 'material') loom = (utils.updateTreadling != null) ? utils.updateTreadling(loom, { i: currentPos.i, j: currentPos.j, val: val }) : loom;
      this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings);
    }
  }









  /**
  * called on scroll
  * @param scroll_top 
  * @param scroll_left 
  */
  public reposition(scroll_top: number, scroll_left: number) {

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
  public rescale(scale: number, out_format: string) {
    this.scale = scale;
    if (this.id == -1) return;

    const draft = this.tree.getDraft(this.id);
    const loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);

    //rescale
    if (!this.oversize || this.ignoreOversize) {
      this.render.addToQueue(draft, loom, loom_settings, this.canvases, null, 'scale', () => {
      }, this.scale);
      this.refreshOriginMarker();
    }

  }


  /**cross references the current flats with teh state to see if the required redraws are visible or required.  */
  public needsRedraw(rf: RenderingFlags): boolean {
    switch (this.source) {
      case 'editor':
        if (rf.u_drawdown == true) return true;
        if (rf.u_threading == true) return true;
        if (rf.u_tieups == true) return true;
        if (rf.u_treadling == true) return true;
        if (rf.u_warp_sys == true) return true;
        if (rf.u_warp_mats == true) return true;
        if (rf.u_weft_sys == true) return true;
        if (rf.u_weft_mats == true) return true;
        return false;
      case 'viewer':
      case 'mixer':
      case 'library':
        if (rf.u_drawdown == true) return true;
        if (rf.u_warp_mats == true) return rf.use_colors;
        if (rf.u_weft_mats == true) return rf.use_colors;
        return false;
    }
  }

  // public getTextInterval(){
  //   let ls = this.tree.getLoomSettings(this.id);
  //   return (ls === null) ? defaults.epi :  ls.epi;
  // }



  public unsetSelection() {

    this.selection.unsetParameters();
  }



  public clearAll() {
    this.colSystemMapping = [];
    this.rowSystemMapping = [];
    this.render.clear(this.canvases);

  }


  public forceRedraw() {
    if (this.id == -1) return;
    const draft = this.tree.getDraft(this.id)
    const loom = this.tree.getLoom(this.id)
    const loom_settings = this.tree.getLoomSettings(this.id);

    let flags: RenderingFlags = {
      u_drawdown: true,
      u_threading: true,
      u_tieups: true,
      u_treadling: true,
      u_warp_sys: true,
      u_warp_mats: true,
      u_weft_sys: true,
      u_weft_mats: true,
      use_floats: (this.current_view !== 'draft'),
      use_colors: (this.current_view === 'visual'),
      show_loom: (this.source === 'editor'),
      use_sizes: this.use_sizes
    }
    this.redraw(draft, loom, loom_settings, flags);
  }



  //takes inputs about what to redraw
  public redraw(draft: Draft, loom: Loom, loom_settings: LoomSettings, rf: RenderingFlags): Promise<boolean> {


    this.isRedrawing = true;

    this.overTimeLimit$ = of(false);
    setTimeout(() => {
      this.overTimeLimit$ = of(true);
    }, 100);


    let area = warps(draft.drawdown) * wefts(draft.drawdown);
    if (area >= this.ws.oversize_dim_threshold) this.oversize = true;
    else this.oversize = false;


    if (this.oversize && !this.ignoreOversize) {
      this.render.clear(this.canvases);
      this.isRedrawing = false;
      return Promise.resolve(true);
    }

    //cancel the forceLoad after one call
    //if (this.oversize && this.ignoreOversize) this.ignoreOversize = false;

    if (draft == null) {
      console.error("DRAFT IS NULL", this.id);
      return;
    }

    if (this.needsRedraw(rf)) {

      const queueItem = this.render.addToQueue(draft, loom, loom_settings, this.canvases, rf, 'render', () => {
        this.isRedrawing = false;
        this.refreshOriginMarker();
        this.refreshWarpAndWeftSystemNumbering();
      })
    } else {
      this.isRedrawing = false;
    }


    this.render.addToQueue(draft, loom, loom_settings, this.canvases, rf, 'scale', () => {
      if (this.selection != undefined) this.selection.redraw();
    }, this.scale);


    return Promise.resolve(true);

  }

  toggleOversize() {
    this.ignoreOversize = !this.ignoreOversize;

    this.forceRedraw();
    if (this.selection != undefined) this.selection.redraw();

  }

  refreshOriginMarker() {
    if (this.oversize && !this.ignoreOversize) {
      return;
    }
    const div = document.getElementById("origin-marker-" + this.source + "-" + this.id);
    if (div !== null) div.style.transform = "scale(" + this.scale + ")";
  }

  refreshWarpAndWeftSystemNumbering() {
    if (this.oversize && !this.ignoreOversize) {
      return;
    }

    let warpdatadiv = document.getElementById('warp-systems-text-' + this.source + '-' + this.id);
    let weftdatadiv = document.getElementById('weft-systems-text-' + this.source + '-' + this.id);
    if (warpdatadiv !== null) warpdatadiv.style.width = this.canvases.warp_mats.style.width;
    if (weftdatadiv !== null) weftdatadiv.style.height = this.canvases.weft_mats.style.height;
    this.weft_text_div_height = this.canvases.weft_mats.style.height;
    this.warp_text_div_width = this.canvases.warp_mats.style.width;

  }

  //takes inputs about what to redraw
  public clear(): Promise<boolean> {

    this.colSystemMapping = [];
    this.rowSystemMapping = [];



    return this.render.clear(this.canvases).then(res => {
      //impose a delay so that the position change can happen before connections are redrawn
      return new Promise<boolean>((resolve) => {
        setTimeout(() => {
          resolve(true);
        }, 200);
      });
    })
  }





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
    }
  }





  /**
  * inserts an empty row just below the clicked row
  * @param si the screen index of the row we'll insert
  * @param i the absolute (not screen) index of the row we'll insert
  */
  public insertRow(i: number) {

    if (this.view_only) return;

    const before = this.tree.getDraftNodeState(this.id);


    const draft = this.tree.getDraft(this.id);
    let loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);

    draft.drawdown = insertDrawdownRow(draft.drawdown, i, null);
    draft.rowShuttleMapping = insertMappingRow(draft.rowShuttleMapping, i, 1);
    draft.rowSystemMapping = insertMappingRow(draft.rowSystemMapping, i, 0);
    const utils = getLoomUtilByType(loom_settings.type);
    loom = (utils.insertIntoTreadling != null) ? utils.insertIntoTreadling(loom, i, []) : loom;

    if (this.draft_edit_source == 'drawdown') {
      this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
        .then(loom => {
          this.addStateChange(before);
        })
    } else {
      this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
        .then(draft => {
          this.addStateChange(before);
        })
    }



  }

  public afterSelectAction(before: any) {
    this.addStateChange(before);
  }

  public cloneRow(i: number) {

    if (this.view_only) return;
    const before = this.tree.getDraftNodeState(this.id);

    const draft = this.tree.getDraft(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);
    let loom = this.tree.getLoom(this.id);


    const row_deep: Array<Cell> = [];
    draft.drawdown[i].forEach(cell => {
      row_deep.push(createCell(getCellValue(cell)));
    });

    const utils = getLoomUtilByType(loom_settings.type);
    loom = (utils.insertIntoTreadling != null) ? utils.insertIntoTreadling(loom, i, loom.treadling[i].slice()) : loom;

    draft.drawdown = insertDrawdownRow(draft.drawdown, i, row_deep);
    draft.rowShuttleMapping = insertMappingRow(draft.rowShuttleMapping, i, draft.rowShuttleMapping[i]);
    draft.rowSystemMapping = insertMappingRow(draft.rowSystemMapping, i, draft.rowSystemMapping[i]);



    if (this.draft_edit_source == 'drawdown') {
      this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
        .then(loom => {
          this.addStateChange(before);
        })
    } else {
      loom = (utils.insertIntoTreadling != null) ? utils.insertIntoTreadling(loom, i, loom.treadling[i].slice()) : loom;

      this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
        .then(draft => {
          this.addStateChange(before);
        })
    }

  }

  public deleteRow(i: number) {
    if (this.view_only) return;

    const before = this.tree.getDraftNodeState(this.id);

    const draft = this.tree.getDraft(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);
    let loom = this.tree.getLoom(this.id);

    draft.drawdown = deleteDrawdownRow(draft.drawdown, i);
    draft.rowShuttleMapping = deleteMappingRow(draft.rowShuttleMapping, i)

    draft.rowSystemMapping = deleteMappingRow(draft.rowSystemMapping, i)
    const utils = getLoomUtilByType(loom_settings.type);
    loom = (utils.deleteFromTreadling != null) ? utils.deleteFromTreadling(loom, i) : loom;


    if (this.draft_edit_source == 'drawdown') {
      this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
        .then(loom => {
          this.addStateChange(before);
        })
    } else {
      this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
        .then(draft => {
          this.addStateChange(before);
        })
    }
  }


  public insertCol(j: number) {
    if (this.view_only) return;
    const before = this.tree.getDraftNodeState(this.id);

    const draft = this.tree.getDraft(this.id);
    let loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);

    draft.drawdown = insertDrawdownCol(draft.drawdown, j, null);
    draft.colShuttleMapping = insertMappingCol(draft.colShuttleMapping, j, 0);
    draft.colSystemMapping = insertMappingCol(draft.colSystemMapping, j, 0);
    const utils = getLoomUtilByType(loom_settings.type);
    loom = (utils.insertIntoThreading != null) ? utils.insertIntoThreading(loom, j, -1) : loom;

    if (this.draft_edit_source == 'drawdown') {
      this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
        .then(loom => {
          this.addStateChange(before);
        })

    } else {

      this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
        .then(draft => {
          this.addStateChange(before);
        })

    }

  }

  public cloneCol(j: number) {
    if (this.view_only) return;
    const before = this.tree.getDraftNodeState(this.id);

    const draft = this.tree.getDraft(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);
    let loom = this.tree.getLoom(this.id);

    const col: Array<Cell> = draft.drawdown.reduce((acc, el) => {
      acc.push(el[j]);
      return acc;
    }, []);

    draft.drawdown = insertDrawdownCol(draft.drawdown, j, col);
    draft.colShuttleMapping = insertMappingCol(draft.colShuttleMapping, j, draft.colShuttleMapping[j]);
    draft.colSystemMapping = insertMappingCol(draft.colSystemMapping, j, draft.colSystemMapping[j]);
    const utils = getLoomUtilByType(loom_settings.type);


    if (this.draft_edit_source == 'drawdown') {
      this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
        .then(loom => {
          this.addStateChange(before);
        })

    } else {
      loom = (utils.insertIntoThreading != null) ? utils.insertIntoThreading(loom, j, loom.threading[j]) : loom;

      this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
        .then(draft => {
          this.addStateChange(before);
        })

    }

  }


  public deleteCol(j: number) {
    if (this.view_only) return;
    const before = this.tree.getDraftNodeState(this.id);

    const draft = this.tree.getDraft(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);
    let loom = this.tree.getLoom(this.id);

    draft.drawdown = deleteDrawdownCol(draft.drawdown, j);
    draft.colShuttleMapping = deleteMappingCol(draft.colShuttleMapping, j);
    draft.colSystemMapping = deleteMappingCol(draft.colSystemMapping, j);
    const utils = getLoomUtilByType(loom_settings.type);
    loom = (utils.deleteFromThreading != null) ? utils.deleteFromThreading(loom, j) : loom;


    if (this.draft_edit_source == 'drawdown') {
      this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
        .then(loom => {
          this.addStateChange(before);
        })

    } else {
      this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
        .then(draft => {
          this.addStateChange(before);
        })

    }
  }


  swapEditingStyle() {
    const loom_settings = this.tree.getLoomSettings(this.id);
    if (loom_settings.type !== 'jacquard') {
      this.selection.onSelectCancel();
    }

  }

  public checkForPaint(source: string, index: number, event: any) {
    const draft = this.tree.getDraft(this.id);
    if (this.pencil == 'material' && this.mouse_pressed) {
      if (source == 'weft') draft.rowShuttleMapping[index] = this.selected_material_id;
      if (source == 'warp') draft.colShuttleMapping[index] = this.selected_material_id;
      const flags: DraftNodeBroadcastFlags = {
        meta: false,
        draft: true,
        loom: false,
        loom_settings: false,
        materials: true
      };
      this.tree.setDraft(this.id, draft, flags);

    }
  }

  public drawOnWarpMaterials(draft: Draft, currentPos: Interlacement) {
    draft.colShuttleMapping[currentPos.j] = this.selected_material_id;
    const flags: DraftNodeBroadcastFlags = {
      meta: false,
      draft: true,
      loom: false,
      loom_settings: false,
      materials: true
    };
    this.tree.setDraft(this.id, draft, flags);
  }

  public drawOnWeftMaterials(draft: Draft, currentPos: Interlacement) {
    draft.rowShuttleMapping[currentPos.i] = this.selected_material_id;
    const flags: DraftNodeBroadcastFlags = {
      meta: false,
      draft: true,
      loom: false,
      loom_settings: false,
      materials: true
    };
    this.tree.setDraft(this.id, draft, flags);
  }



  public updateWarpSystems(pattern: Array<number>) {
    const draft = this.tree.getDraft(this.id);
    draft.colSystemMapping = generateMappingFromPattern(draft.drawdown, pattern, 'col');
    const flags: DraftNodeBroadcastFlags = {
      meta: false,
      draft: true,
      loom: false,
      loom_settings: false,
      materials: false
    };
    this.tree.setDraft(this.id, draft, flags);

  }

  public updateWeftSystems(pattern: Array<number>) {
    const draft = this.tree.getDraft(this.id);
    draft.rowSystemMapping = generateMappingFromPattern(draft.drawdown, pattern, 'row');
    this.rowSystemMapping = draft.rowSystemMapping.slice();
    const flags: DraftNodeBroadcastFlags = {
      meta: false,
      draft: true,
      loom: false,
      loom_settings: false,
      materials: false
    };
    this.tree.setDraft(this.id, draft, flags);

  }

  public updateWarpShuttles(pattern: Array<number>) {
    const draft = this.tree.getDraft(this.id);
    draft.colShuttleMapping = generateMappingFromPattern(draft.drawdown, pattern, 'col');

    const flags: DraftNodeBroadcastFlags = {
      meta: false,
      draft: true,
      loom: false,
      loom_settings: false,
      materials: true
    };

    this.tree.setDraft(this.id, draft, flags);


  }

  public updateWeftShuttles(pattern: Array<number>) {
    const draft = this.tree.getDraft(this.id);
    draft.rowShuttleMapping = generateMappingFromPattern(draft.drawdown, pattern, 'row');
    const flags: DraftNodeBroadcastFlags = {
      meta: false,
      draft: true,
      loom: false,
      loom_settings: false,
      materials: true
    };

    this.tree.setDraft(this.id, draft, flags);


  }


}
