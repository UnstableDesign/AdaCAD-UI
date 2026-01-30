import { CdkDrag, CdkDragHandle, CdkDragMove, CdkDragStart } from '@angular/cdk/drag-drop';
import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { Draft, Interlacement, LoomSettings } from 'adacad-drafting-lib';
import { isUp, warps, wefts } from 'adacad-drafting-lib/draft';
import { Subscription } from 'rxjs';
import { DraftNode, DraftStateMove, Point } from '../../../core/model/datatypes';
import { StateService } from '../../../core/provider/state.service';
import { TreeService } from '../../../core/provider/tree.service';
import { ViewerService } from '../../../core/provider/viewer.service';
import { WorkspaceService } from '../../../core/provider/workspace.service';
import { ZoomService } from '../../../core/provider/zoom.service';
import { LayersService } from '../../provider/layers.service';
import { MultiselectService } from '../../provider/multiselect.service';
import { ViewportService } from '../../provider/viewport.service';
import { DraftContainerComponent } from '../draftcontainer/draftcontainer.component';


@Component({
  selector: 'app-subdraft',
  templateUrl: './subdraft.component.html',
  styleUrls: ['./subdraft.component.scss'],
  imports: [CdkDrag, CdkDragHandle, DraftContainerComponent]
})



export class SubdraftComponent implements OnInit {
  private layer = inject(LayersService);
  tree = inject(TreeService);
  private viewport = inject(ViewportService);
  ws = inject(WorkspaceService);
  private multiselect = inject(MultiselectService);
  private vs = inject(ViewerService);
  zs = inject(ZoomService);
  private ss = inject(StateService);


  @ViewChild('draftcontainer') draftcontainer: DraftContainerComponent;

  @Input() id: number;
  @Input() scale: number;
  @Input() draft: Draft;


  @Output() onSubdraftMove = new EventEmitter<any>();
  @Output() onSubdraftDrop = new EventEmitter<any>();
  @Output() onSubdraftStart = new EventEmitter<any>();
  @Output() onDeleteCalled = new EventEmitter<any>();
  @Output() onDuplicateCalled = new EventEmitter<any>();
  @Output() onConnectionMade = new EventEmitter<any>();
  @Output() onConnectionRemoved = new EventEmitter<any>();
  @Output() onDesignAction = new EventEmitter<any>();
  @Output() onConnectionStarted: any = new EventEmitter<any>();
  @Output() onSubdraftViewChange: any = new EventEmitter<any>();
  @Output() createNewSubdraftFromEdits: any = new EventEmitter<any>();
  @Output() onNameChange: any = new EventEmitter<any>();
  @Output() onOpenInEditor: any = new EventEmitter<any>();
  @Output() onRedrawOutboundConnections = new EventEmitter<any>();



  isNew: boolean = false;
  dn: DraftNode;
  private topleft: Point = { x: 0, y: 0 };


  parent_id: number = -1;

  /**
  * flag to tell if this is in a mode where it is looking foor a connectino
  */
  selecting_connection: boolean = false;


  /**
   * hold the top left point as an interlacement, independent of scale
   */
  interlacement: Interlacement;

  // private _scale: number; 

  ink = 'neq'; //can be or, and, neq, not, splice

  counter: number = 0; // keeps track of how frequently to call the move functions

  counter_limit: number = 50;  //this sets the threshold for move calls, lower number == more calls

  last_ndx: Interlacement = { i: -1, j: -1 }; //used to check if we should recalculate a move operation

  moving: boolean = false;

  disable_drag: boolean = false;

  is_preview: boolean = false;

  zndx = 0;

  has_active_connection: boolean = false;

  set_connectable: boolean = false;

  // draft_visible: boolean = true;

  loom_settings: LoomSettings;

  use_colors: boolean = false;

  draft_zoom: number = 1;

  offset: Point = null;

  previous_topleft: Point = { x: 0, y: 0 };

  multiSelectListChangeSubscription: Subscription;
  multiSelectMoveElementsSubscription: Subscription;

  wasDragged: boolean = false;

  constructor() {
    const layer = this.layer;
    this.zndx = layer.createLayer();
  }


  ngOnInit() {

    if (!this.is_preview) this.parent_id = this.tree.getSubdraftParent(this.id);
    const tl: Point = this.viewport.getTopRight();
    const tl_offset = { x: tl.x, y: tl.y };

    if (this.topleft.x === 0 && this.topleft.y === 0) this.setPosition(tl_offset);

    if (!this.is_preview) this.viewport.addObj(this.id, this.interlacement);


    this.dn = <DraftNode>this.tree.getNode(this.id);
    this.use_colors = this.dn.render_colors;



    if (this.tree.isSibling(this.id)) this.disableDrag();


  }



  ngAfterViewInit() {



    let sd_container = document.getElementById('scale-' + this.id);
    this.setPosition(this.topleft, true);

    this.multiSelectListChangeSubscription = this.multiselect.multiSelectListChange$.subscribe(list => {
      let sd_container = document.getElementById('scale-' + this.id);
      if (sd_container == null) return;
      if (list.includes(this.id)) {
        sd_container.classList.add('multiselected');
        if (this.multiSelectMoveElementsSubscription) this.multiSelectMoveElementsSubscription.unsubscribe();

        let ms_item = this.multiselect.selected.find(el => el.id == this.id);
        if (ms_item !== undefined) {
          this.multiSelectMoveElementsSubscription = ms_item.positionUpdate.subscribe(pos => {
            this.setPosition(pos, true);
          });
        }

      } else {
        sd_container.classList.remove('multiselected');
        if (this.multiSelectMoveElementsSubscription) this.multiSelectMoveElementsSubscription.unsubscribe();
      }
    });


  }

  ngOnDestroy() {
    if (this.multiSelectListChangeSubscription) this.multiSelectListChangeSubscription.unsubscribe();
    if (this.multiSelectMoveElementsSubscription) this.multiSelectMoveElementsSubscription.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges) {


    //if scale is changed, automatically call the function to rescale
    if (changes['scale']) {
      this.rescale().catch(e => { /* handle error silently */ })
    }

  }


  /**
   * this is called when the draft container displaying this draft has had a size change 
   */
  // updateOutboundConnections() {
  //   this.onRedrawOutboundConnections.emit(this.id);
  // }




  nameChange() {
    this.onNameChange.emit(this.id);
  }


  /**
   * this is called when the global workspace is rescaled. 
   * @returns 
   */
  rescale(): Promise<boolean> {

    return Promise.resolve(true)

  }

  /**called when bounds change, updates the global view port */
  updateViewport(topleft: Point) {
    // this.interlacement = utilInstance.resolvePointToAbsoluteNdx(topleft, this.scale);
    // this.viewport.updatePoint(this.id, this.interlacement);

  }



  /**selects this subdraft only, resetting connections as though no other subdrafts are selected */
  selectSubdraftOnly() {

    let allConnections = this.tree.getConnectionNodes();
    let upstreamConnections = this.tree.getUpstreamConnections(this.id);
    let downstreamConnections = this.tree.getDownstreamConnections(this.id);

    allConnections.forEach(el => {
      if (upstreamConnections.includes(el.id)) {
        el.upstreamOfSelected.next(true);
      } else {
        el.upstreamOfSelected.next(false);
      }

      if (downstreamConnections.includes(el.id)) {
        el.downstreamOfSelected.next(true);
      } else {
        el.downstreamOfSelected.next(false);
      }
    });


  }

  /**just strictly adds connectsion, but does not remove any */
  selectSubdraftMulti() {
    let upstreamConnections = this.tree.getUpstreamConnections(this.id);
    let downstreamConnections = this.tree.getDownstreamConnections(this.id);

    upstreamConnections.map(el => this.tree.getConnectionNode(el)).forEach(el => {
      if (el !== null) {

        el.upstreamOfSelected.next(true);
      }
    });
    downstreamConnections.map(el => this.tree.getConnectionNode(el)).forEach(el => {
      if (el !== null) {
        el.downstreamOfSelected.next(true);
      }
    });
  }


  /**
   * the tree is likely to converge as we dravel down so there is a chance that removing 
   * this subdrafts children will inadventantly remove a different selected subdrafts downstrea. 
   * As such, we unselect this and then add back any other multiselected element children
   */
  unselectSubdraft() {
    let upstreamConnections = this.tree.getUpstreamConnections(this.id);
    let downstreamConnections = this.tree.getDownstreamConnections(this.id);

    upstreamConnections.map(el => this.tree.getConnectionNode(el)).forEach(el => {
      if (el !== null) {

        el.upstreamOfSelected.next(false);
      }
    });
    downstreamConnections.map(el => this.tree.getConnectionNode(el)).forEach(el => {
      if (el !== null) {
        el.downstreamOfSelected.next(false);
      }
    });

    this.multiselect.getSelections().forEach(el => {
      if (el !== this.id) {
        this.selectSubdraftMulti();
      }
    });
  }


  toggleMultiSelection(e: any) {

    if (this.wasDragged) return;
    // this.onFocus.emit(this.id);
    //this.updateConnectionStyling(true);
    this.vs.setViewer(this.id);

    if (e.shiftKey == true) {
      this.multiselect.toggleSelection(this.id, this.topleft);
      if (this.multiselect.isSelected(this.id)) {
        this.selectSubdraftMulti();
      } else {
        this.unselectSubdraft();
      }
    } else {
      this.multiselect.clearSelections();
      this.selectSubdraftOnly();
    }

  }


  connectionEnded() {
    this.selecting_connection = false;
    this.enableDrag();
  }

  connectionStarted(obj) {
    let event = obj.event;
    let childid = obj.id;

    if (this.selecting_connection == true) {
      this.selecting_connection = false;
      this.onConnectionStarted.emit({
        type: 'stop',
        event: event,
        id: childid
      });
    } else {
      this.selecting_connection = true;

      this.disableDrag();

      this.onConnectionStarted.emit({
        type: 'start',
        event: event,
        id: childid
      });
    }

  }


  openInEditor(event: any) {
    this.onOpenInEditor.emit(this.id);
  }


  /**
   * called on create to position the element on screen
   * @param pos 
   */
  setPosition(pos: Point, emit: boolean = true) {
    this.topleft = { x: pos.x, y: pos.y };
    if (emit) this.dn.positionChange.next(this.topleft);

    let sd_container = document.getElementById('scale-' + this.id);
    if (sd_container == null) return;
    sd_container.style.transform = 'none'; //negate angulars default positioning mechanism
    sd_container.style.top = this.topleft.y + "px";
    sd_container.style.left = this.topleft.x + "px";
    this.updateViewport(this.topleft);
  }

  getPosition(): Point {
    return this.topleft;
  }


  /**
   * gets the next z-ndx to place this in front
   */
  public setAsPreview() {
    this.is_preview = true;
    this.zndx = this.layer.createLayer();
  }



  /**
   * does this subdraft exist at this point?
   * @param p the absolute position of the coordinate (based on the screen)
   * @returns true/false for yes or no
   */
  public hasPoint(p: Point): boolean {
    const size = document.getElementById('scale' + this.id)


    const endPosition = {
      x: this.topleft.x + size.offsetWidth,
      y: this.topleft.y + size.offsetHeight,
    };

    if (p.x < this.topleft.x || p.x > endPosition.x) return false;
    if (p.y < this.topleft.y || p.y > endPosition.y) return false;


    return true;

  }


  /**
   * Takes row/column position in this subdraft and translates it to an absolution position  
   * @param ndx the index
   * @returns the absolute position as nxy
   */
  public resolveNdxToPoint(ndx: Interlacement): Point {

    let y = this.topleft.y + ndx.i * this.scale;
    let x = this.topleft.x + ndx.j * this.scale;
    return { x: x, y: y };

  }

  /**
   * Takes an absolute coordinate and translates it to the row/column position Relative to this subdraft
   * @param p the screen coordinate
   * @returns the row and column within the draft (i = row, j=col), returns -1 if out of bounds
   */
  public resolvePointToNdx(p: Point): Interlacement {
    const draft = this.tree.getDraft(this.id);

    let i = Math.floor((p.y - this.topleft.y) / this.scale);
    let j = Math.floor((p.x - this.topleft.x) / this.scale);

    if (i < 0 || i >= wefts(draft.drawdown)) i = -1;
    if (j < 0 || j >= warps(draft.drawdown)) j = -1;

    return { i: i, j: j };

  }

  warps() {
    return warps(this.draft.drawdown)
  }

  wefts() {
    return wefts(this.draft.drawdown)

  }



  /**
   * takes an absolute reference and returns the value at that cell boolean or null if its unset
   * @param p a point of the absolute poistion of coordinate in question
   * @returns true/false/or null representing the eddle value at this point
   */
  public resolveToValue(p: Point): boolean {

    const coords = this.resolvePointToNdx(p);

    if (coords.i < 0 || coords.j < 0) return null; //this out of range

    const draft = this.tree.getDraft(this.id);

    if (!draft.drawdown[coords.i][coords.j].is_set) return null;

    return isUp(draft.drawdown, coords.i, coords.j);

  }


  onDoubleClick() {
    this.draftcontainer.onDoubleClick();
    this.isNew = false;

  }




  redrawExistingDraft() {

    const draft = this.tree.getDraft(this.id);
    this.draftcontainer.draft_visible = this.tree.getDraftVisible(this.id);
    this.draftcontainer.forceDrawDraft(draft);
    this.draftcontainer.draft_name = this.tree.getDraftName(this.id);

  }




  calculateDefaultCellSize(draft: Draft): number {
    const num_cells = wefts(draft.drawdown) * warps(draft.drawdown);
    if (num_cells < 1000) return 10;
    if (num_cells < 10000) return 8;
    if (num_cells < 100000) return 5;
    if (num_cells < 1000000) return 2;
    return 1;
  }








  /**
   * gets the position of this elment on the canvas. Dyanic top left might be bigger due to scolling intersection
   * previews. Use static for all calculating of intersections, etc. 
   * @returns 
   */
  getTopleft(): Point {
    return this.topleft;
  }

  /**
 * prevents hits on the operation to register as a palette click, thereby voiding the selection
 * @param e 
 */
  mousedown(e: any) {
    this.isNew = false;
    this.vs.setViewer(this.id);
    e.stopPropagation();
  }








  dragStart($event: CdkDragStart) {
    this.isNew = false;
    this.wasDragged = false;

    if (this.multiselect.isSelected(this.id)) {
      this.multiselect.setRelativePosition(this.topleft);
      this.multiselect.dragStart(this.id);
    }

    this.previous_topleft = { x: this.topleft.x, y: this.topleft.y };

    this.moving = true;
    this.offset = null;
    this.counter = 0;
    //set the relative position of this operation if its the one that's dragging

    this.onSubdraftStart.emit({ id: this.id });


  }


  /**
    this function converts the position of the pointer into the platte coordinate space, it also factors in the top left position so that the 
    pointer position remains constant within the subdraft
   * @param $event 
   */
  dragMove($event: CdkDragMove) {

    this.wasDragged = true;
    let parent = document.getElementById('scrollable-container');
    let op_container = document.getElementById('scale-' + this.id);
    let rect_palette = parent.getBoundingClientRect();


    const zoom_factor = 1 / this.zs.getMixerZoom();

    //this gives the position of
    let op_topleft_inscale = {
      x: op_container.offsetLeft,
      y: op_container.offsetTop
    }


    let scaled_pointer = {
      x: ($event.pointerPosition.x - rect_palette.x + parent.scrollLeft) * zoom_factor,
      y: ($event.pointerPosition.y - rect_palette.y + parent.scrollTop) * zoom_factor,
    }



    if (this.offset == null) {

      this.offset = {
        x: scaled_pointer.x - op_topleft_inscale.x,
        y: scaled_pointer.y - op_topleft_inscale.y
      }
      // console.log("LEFT WITH SCALE VS, LEFT POINTER ", op_topleft_inscale, scaled_pointer, this.offset);

    }


    this.topleft = {
      x: scaled_pointer.x - this.offset.x,
      y: scaled_pointer.y - this.offset.y

    }

    this.setPosition(this.topleft, true);
    if (this.multiselect.isSelected(this.id)) this.multiselect.dragMove(this.topleft);

    this.onSubdraftMove.emit({ id: this.id, point: this.topleft });

  }

  //The drag event has handled the on screen view, but internally, we need to track the top left of the element for saving and loading. 
  dragEnd($event: any) {

    //CATCH THE CASE WHERE THIS IS DROPPED OUTSIDE OF SELECTABLE AREA

    let op_container = document.getElementById('scale-' + this.id);


    this.topleft = {
      x: (op_container.offsetLeft < 0) ? 0 : this.topleft.x,
      y: (op_container.offsetTop < 0) ? 0 : this.topleft.y,

    }

    this.setPosition(this.topleft, true);



    this.moving = false;
    this.counter = 0;
    this.last_ndx = { i: -1, j: -1 };
    this.multiselect.setRelativePosition(this.topleft);
    this.onSubdraftDrop.emit({ id: this.id });

    if (this.multiselect.moving_id == this.id) {
      this.multiselect.dragEnd();
    } else {
      const change: DraftStateMove = {
        originator: 'DRAFT',
        type: 'MOVE',
        id: this.id,
        before: this.previous_topleft,
        after: this.topleft
      }

      this.ss.addStateChange(change);
    }

    setTimeout(() => {
      this.wasDragged = false;
    }, 0);


  }


  disableDrag() {
    this.disable_drag = true;
  }

  enableDrag() {
    this.disable_drag = false;
  }

  // showhide(){
  //   let vis = this.tree.getDraftVisible(this.id);
  //   this.tree.setDraftVisiblity(this.id, !vis);
  //  // this.draft_visible = !this.draft_visible;
  //   this.onSubdraftViewChange.emit(this.id);
  // }

  connectionClicked(id: number) {
    this.has_active_connection = true;
    // if(this.active_connection_order === 0){
    //   this.onConnectionMade.emit(id);
    // }else{
    //   this.onConnectionRemoved.emit(id);
    // }


  }

  resetConnections() {
    this.has_active_connection = false;
  }

  delete(id: number) {
    if (id !== this.id) console.error("In delete - draft id's don't match");
    this.onDeleteCalled.emit(id);
  }



  /**
   * this is emitted from the draft container when something from it's options menu is selected
   * @param e 
   */
  private designAction(e) {

    let event = e.event;
    let id = e.id;

    switch (event) {
      case 'duplicate':
        this.onDuplicateCalled.emit({ id });
        break;

      case 'delete':
        this.delete(id);
        break;

      case 'edit':
        this.onDesignAction.emit({ id });
        break;

      default:
        this.onDesignAction.emit({ id });
        break;

    }
  }


}

