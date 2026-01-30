import { Component, EventEmitter, HostListener, OnInit, Output, ViewChild, ViewContainerRef, ViewRef, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AnalyzedImage, Draft, Img, Loom, LoomSettings, OpParamValType, Operation, copyDraft, generateId, getDraftName, initDraftWithParams, warps, wefts } from 'adacad-drafting-lib';
import { copyLoom, copyLoomSettings } from 'adacad-drafting-lib/loom';
import normalizeWheel from 'normalize-wheel';
import { Subscription, fromEvent } from 'rxjs';
import { Bounds, ConnectionExistenceChange, DraftExistenceChange, DraftNode, DraftNodeProxy, MoveAction, Node, NodeComponentProxy, Note, OpNode, Point } from '../../core/model/datatypes';
import { defaults } from '../../core/model/defaults';
import { ErrorBroadcasterService } from '../../core/provider/error-broadcaster.service';
import { FirebaseService } from '../../core/provider/firebase.service';
import { MediaService } from '../../core/provider/media.service';
import { NotesService } from '../../core/provider/notes.service';
import { OperationService } from '../../core/provider/operation.service';
import { StateService } from '../../core/provider/state.service';
import { TreeService } from '../../core/provider/tree.service';
import { ViewerService } from '../../core/provider/viewer.service';
import { WorkspaceService } from '../../core/provider/workspace.service';
import { ZoomService } from '../../core/provider/zoom.service';
import { LayersService } from '../../mixer/provider/layers.service';
import { MultiselectService } from '../provider/multiselect.service';
import { ViewportService } from '../provider/viewport.service';
import { FileService } from './../../core/provider/file.service';
import { ConnectionComponent } from './connection/connection.component';
import { NoteComponent } from './note/note.component';
import { OperationComponent } from './operation/operation.component';
import { SubdraftComponent } from './subdraft/subdraft.component';

@Component({
  selector: 'app-palette',
  templateUrl: './palette.component.html',
  styleUrls: ['./palette.component.scss']
})


export class PaletteComponent implements OnInit {
  private ops = inject(OperationService);
  private media = inject(MediaService);
  private tree = inject(TreeService);
  private layers = inject(LayersService);
  private fs = inject(FileService);
  private fb = inject(FirebaseService)
  private _snackBar = inject(MatSnackBar);
  viewport = inject(ViewportService);
  private notes = inject(NotesService);
  private vs = inject(ViewerService);
  private ws = inject(WorkspaceService);
  private ss = inject(StateService);
  private zs = inject(ZoomService);
  private multiselect = inject(MultiselectService);
  private errorBroadcaster = inject(ErrorBroadcasterService);


  // Local mixer editing mode tracking
  cur_mixer_mode: string = defaults.mixer_mode;

  // @Output() onDesignModeChange: any = new EventEmitter();  
  @Output() onOpenInEditor: any = new EventEmitter();
  @Output() onPerformOperationError: any = new EventEmitter();

  /**
   * A container that supports the automatic generation and removal of the components inside of it
   */
  @ViewChild('vc', { read: ViewContainerRef, static: true }) vc: ViewContainerRef;

  subdraftSubscriptions: Array<Subscription> = [];
  operationSubscriptions: Array<Subscription> = [];
  connectionSubscriptions: Array<Subscription> = [];
  noteSubscriptions: Array<Subscription> = [];
  stateSubscriptions: Array<Subscription> = [];


  /**
   * Subscribes to move event after a touch event is started.
   * @property {Subscription}
   */
  moveSubscription: Subscription;

  /**
   * flag to determine how conneection should be drawn
   */
  selecting_connection: boolean = false;


  /**
 * stores an i and j of the last user selected location within the component
 * @property {Point}
 */
  last_point: Point;

  /**
   * triggers a class to handle disabling pointerevents when switching modes
   * @property {boolean}
   */
  pointer_events: boolean;

  /**
   * trackable inputs to snackbar
   */
  snack_message: string;

  snack_bounds: Bounds;

  /**
   * track if shift key is held for cursor grabby hand feedback
   */
  shift_held: boolean = false;

  /**
   * track if space key is held for cursor grabby hand feedback
   */
  space_held: boolean = false;

  /**
   * track if middle mouse button is held for cursor grabby hand feedback
   */
  middle_mouse_held: boolean = false;

  /**
* stores the bounds of the shape being drawn
*/
  active_connection: Bounds;

  /**
   * a reference to the base size of each cell. Zoom in and out only modifies the view, not this base size.
   */
  default_cell_size: number = 5;

  needs_init: boolean = true;

  visible_op: number = -1;

  visible_op_inlet: number = -1;

  multi_select_bounds: Bounds;
  hasMultiSelectBounds: boolean = false;


  constructor() {
    this.pointer_events = true;


  }

  /**
   * Called when palette is initailized
   */
  ngOnInit() {

    this.multi_select_bounds = { topleft: { x: 0, y: 0 }, width: 0, height: 0 };

    // subscribe to all the possible undo trigger events
    const draftCreatedUndoSubscription = this.ss.draftCreatedUndo$.subscribe(action => {
      const dn = <DraftNode>action.node;
      this.removeSubdraft(dn.id);
    })


    /**
     * recreate the draft that was removed and all of it's associated outputs, call those outputs to be recomputed. 
     */
    const draftRemovedUndoSubscription = this.ss.draftRemovedUndo$.subscribe(action => {
      const dn = <DraftNode>action.node;
      this.pasteSubdraft(dn).then(id => {
        const outputs_to_update = [];
        action.outputs.forEach(output => {
          this.createConnection(id, output.to_id, output.inlet_id);
          outputs_to_update.push(this.performAndUpdateDownstream(output.to_id));
        });
        return Promise.all(outputs_to_update);
      }).catch(error => {
        this.postOperationErrorMessage(dn.component.id, error);
      });
    })


    const draftMoveUndoSubscription = this.ss.draftMoveUndo$.subscribe(action => {
      const dn = this.tree.getNode((<MoveAction>action).id);
      if (dn && dn.component) (<SubdraftComponent>dn.component).setPosition((<MoveAction>action).before);
      this.subdraftMoved({ id: (<MoveAction>action).id });
      this.subdraftDropped({ id: (<MoveAction>action).id });
    })

    //Subscribe to state events that are triggered by undo/redo
    const paramChangeFromStateSubscription = this.ss.opParamChangeUndo$.subscribe(action => {
      const op = this.tree.getOpNode(action.opid);
      if (op && op.component) (<OperationComponent>op.component).setParamFromStateEvent(action.paramid, action.value);
    });

    const opCreatedUndoSubscription = this.ss.opCreatedUndo$.subscribe(action => {
      const on = <OpNode>action.node;
      this.removeOperation(on.id);
    })

    const opMoveUndoSubscription = this.ss.opMoveUndo$.subscribe(action => {
      const op = this.tree.getOpNode((<MoveAction>action).id);
      if (op && op.component) (<OperationComponent>op.component).setPosition((<MoveAction>action).before);
    });


    /**
     * uses paste to recreate a new operation component with all the previous info. 
     * relinks the inputs
     * computes the output
     * relinks the outputs and hten recomputes those receiveing input from this node. 
     */
    const opRemovedUndoSubscription = this.ss.opRemovedUndo$.subscribe(action => {

      action.media.forEach(el => {
        this.media.addIndexColorMediaInstance(el.id, el.ref, <AnalyzedImage>el.img);
      });

      let new_id = -1;
      const on = <OpNode>action.node;
      this.pasteOperation(on).then(id => {
        new_id = id;
        action.inputs.forEach(input => {
          this.createConnection(input.from_id, id, input.inlet_id);
        });

        return this.performAndUpdateDownstream(id);
      }).then(el => {
        const outputs_to_update = [];
        action.outputs.forEach(output => {
          const children = this.tree.getNonCxnOutputs(new_id);
          if (children.length > output.outlet_id) {
            this.createConnection(children[output.outlet_id], output.to_id, output.inlet_id);
            outputs_to_update.push(this.performAndUpdateDownstream(output.to_id));
          }
        });
        return Promise.all(outputs_to_update);

      }).catch(err => {
        this.postOperationErrorMessage(on.id, err);
      })

    })

    const cxnCreatedUndoSubscription = this.ss.connectionCreatedUndo$.subscribe(action => {
      this.removeConnection({ id: action.node.id });
    })

    const cxnRemovedUndoSubscription = this.ss.connectionRemovedUndo$.subscribe(action => {
      const cxn = this.createConnection(action.inputs[0].from_id, action.outputs[0].to_id, action.outputs[0].inlet_id);
      this.performAndUpdateDownstream(action.outputs[0].to_id).then(el => {
        let children = this.tree.getNonCxnOutputs(action.outputs[0].to_id);
        if (children.length > 0) this.vs.setViewer(children[0]);
      }).catch(err => {
        this.postOperationErrorMessage(action.outputs[0].to_id, err);
      });
    });


    const noteCreatedUndoSubscription = this.ss.noteCreatedUndo$.subscribe(action => {
      this.deleteNote(action.id);
    });

    const noteRemovedUndoSubscription = this.ss.noteRemovedUndo$.subscribe(action => {
      this.createNote(action.before);
    });

    const noteUpdatedUndoSubscription = this.ss.noteUpdatedUndo$.subscribe(action => {
      const note = this.notes.get(action.id);
      note.component.updateValues(action.before);
    });

    const noteMoveUndoSubscription = this.ss.noteMoveUndo$.subscribe(action => {
      const note = this.notes.get(action.id);
      note.component.setPosition(action.before);
    });


    const mixerMoveUndoSubscription = this.ss.mixerMoveUndo$.subscribe(action => {
      this.moveSelectionsFromUndo(action.moving_id, action.selected, action.relative_position);
    });


    this.stateSubscriptions.push(draftCreatedUndoSubscription);
    this.stateSubscriptions.push(draftRemovedUndoSubscription);
    this.stateSubscriptions.push(draftMoveUndoSubscription);
    this.stateSubscriptions.push(paramChangeFromStateSubscription);
    this.stateSubscriptions.push(opCreatedUndoSubscription);
    this.stateSubscriptions.push(opMoveUndoSubscription);
    this.stateSubscriptions.push(opRemovedUndoSubscription);
    this.stateSubscriptions.push(cxnRemovedUndoSubscription);
    this.stateSubscriptions.push(cxnCreatedUndoSubscription);
    this.stateSubscriptions.push(cxnRemovedUndoSubscription);
    this.stateSubscriptions.push(noteCreatedUndoSubscription);
    this.stateSubscriptions.push(noteRemovedUndoSubscription);
    this.stateSubscriptions.push(noteUpdatedUndoSubscription);
    this.stateSubscriptions.push(noteMoveUndoSubscription);
    this.stateSubscriptions.push(mixerMoveUndoSubscription);

    this.vc.clear();
    this.default_cell_size = defaults.draft_detail_cell_size;
  }

  /**
   * Gets references to view items and adds to them after the view is initialized
   */
  ngAfterViewInit() {


  }

  /**
   * unsubscribes to all open subscriptions and clears the view component
   */
  ngOnDestroy() {

    this.unsubscribeFromComponents();
    this.unsubscribeFromState();
    this.vc.clear();

  }

  /**
   * the only way to prevent memory leaks is to unsubscribe.
   * since we lose access to tree when a new file is uploaded we must unsubscribe 
   * when any upload action is taking place. If no action takes place, then resubscribe
   */
  unsubscribeFromComponents() {

    this.subdraftSubscriptions.forEach(element => element.unsubscribe());
    this.operationSubscriptions.forEach(element => element.unsubscribe());
    this.connectionSubscriptions.forEach(element => element.unsubscribe());
    this.noteSubscriptions.forEach(element => element.unsubscribe());
  }

  unsubscribeFromState() {
    this.stateSubscriptions.forEach(element => element.unsubscribe());

  }

  // /**
  //  * resubscribes to each subscription
  //  */
  // resubscribe() {

  //   this.tree.getDrafts().forEach(element => {
  //     this.setSubdraftSubscriptions(element);
  //   });


  //   this.tree.getOperations().forEach(element => {
  //     this.setOperationSubscriptions(element)
  //   });

  //   this.tree.getConnections().forEach(element => {
  //   });

  //   this.tree.getConnections().forEach(element => {
  //   });



  // }

  /**
   * called when a new file is loaded
   */
  clearComponents() {
    this.unsubscribeFromComponents();
    this.notes.getRefs().forEach(ref => this.removeFromViewContainer(ref));
    this.vc.clear();
  }


  /**
   * called when user moves position within viewer
   * @param data 
   */
  handleScroll(position: Point) {
    this.viewport.setTopLeft(position);
    const div: HTMLElement = document.getElementById('scrollable-container');
    if (!div) return;
    div.scrollLeft = this.viewport.getTopLeft().x;
    div.scrollTop = this.viewport.getTopLeft().y;
  }

  /**
   * pans the mixer viewport by the given offset
   * @param diff - the {x, y} offset to pan by in pixels
   */
  handlePan(diff: Point) {
    const div: HTMLElement = document.getElementById('scrollable-container');
    if (!div) return;

    div.scrollLeft += diff.x;
    div.scrollTop += diff.y;
  }



  /**
  * when someone zooms in or out, we'd like to keep the center point the same. We do this by scaling the entire palette and 
  * elements and then manually scrolling to the new center point.
  * TODO, this may not be the case anymore with new scaling 
  * @param data 
  */
  handleScrollFromZoom(old_zoom: number) {
    // this.viewport.setTopLeft(position);
    // console.log(old_center, this.viewport.getCenterPoint());
    const div: HTMLElement = document.getElementById('scrollable-container');

    if (!div) {
      return;
    }

    const past_scroll_x = div.scrollLeft / old_zoom;
    const new_scroll_x = past_scroll_x * this.zs.getMixerZoom();

    const past_scroll_y = div.scrollTop / old_zoom;
    const new_scroll_y = past_scroll_y * this.zs.getMixerZoom();

    div.scrollLeft = new_scroll_x;
    div.scrollTop = new_scroll_y;
  }



  /**
  * called when user scrolls the winidow
  * @param data 
  */
  handleWindowScroll(data: any) {


    const div: HTMLElement = document.getElementById('scrollable-container');

    if (div === null || div === undefined) return;

    this.viewport.set(div.scrollLeft, div.scrollTop, div.clientWidth, div.clientHeight);
    //update the canvas to this position
  }

  /**
   * removes the view associate with this view ref
   * @param ref 
   */
  removeFromViewContainer(ref: ViewRef) {
    const ndx: number = this.vc.indexOf(ref);
    if (ndx !== -1) this.vc.remove(ndx);
    // else console.log('Error: view ref not found for removal', ref);

  }


  /**
   * adds a state to the timeline. This should be called 
   * each time a user performs an action that they should be able to undo/redo
   */
  // addTimelineState(change: StateChangeEvent) {

  //   this.ss.writeStateToTimeline(change);

  //   this.fs.saver.ada()
  //     .then(so => {
  //       let meta = this.ws.current_file;
  //       return this.fb.updateFile(so.file, meta);
  //     })
  //     .catch(err => console.error(err));
  // }

  /**
   * this cycles through all subdrafts and calls the download call on any subdrafts
   * who are currently visible. 
   */
  async downloadVisibleDraftsAsBmp(): Promise<any> {


    const visible_drafts: Array<SubdraftComponent> = this.tree.getDraftNodes().filter(el => el.visible).map(el => <SubdraftComponent>el.component);
    const functions: Array<Promise<any>> = visible_drafts.map(el => el.draftcontainer.saveAsBmp());
    return Promise.all(functions);

  }

  /**
   * this cycles through all subdrafts and calls the download call on any subdrafts
   * who are currently visible. 
   */
  async downloadVisibleDraftsAsWif(): Promise<any> {

    // const drafts: Array<SubdraftComponent> = this.tree.getDrafts();
    // const visible_drafts: Array<SubdraftComponent> = drafts.filter(el => el.draft_visible)
    // const functions: Array<Promise<any>> = visible_drafts.map(el => el.saveAsWif());
    // return Promise.all(functions)
    // .then(el =>
    //   console.log("Downloaded "+functions.length+" files")
    // );

  }



  /**
  //  * called anytime an operation is added. Adds the operation to the tree. 
  //  * @param name the name of the operation to add
  //  */
  addOperation(name: string): number {

    console.log("****************ADDING OPERATION", name);
    const opcomp: OperationComponent = this.createOperation(name);

    this.performAndUpdateDownstream(opcomp.id).then(el => {
      let children = this.tree.getNonCxnOutputs(opcomp.id);
      if (children.length > 0) this.vs.setViewer(children[0])
    }).catch(err => {
      this.postOperationErrorMessage(opcomp.id, err);
    });

    return opcomp.id;

  }

  /**
  //  * called anytime an operation is added. Adds the operation to the tree. 
  //  * @param name the name of the operation to add
  //  */
  pasteOperation(opnode: OpNode): Promise<number> {

    const opcomp: OperationComponent = this.createOperation(opnode.name);

    const new_node = <OpNode>this.tree.getNode(opcomp.id);
    new_node.inlets = opnode.inlets.slice();
    new_node.params = opnode.params.slice();
    const topleft = (<OperationComponent>new_node.component).getPosition();
    const newpos = { x: topleft.x + 100, y: topleft.y + 100 };
    (<OperationComponent>new_node.component).setPosition(newpos, true);


    return this.performAndUpdateDownstream(opcomp.id).then(el => {
      return Promise.resolve(new_node.id);
    }).catch(err => {
      this.postOperationErrorMessage(opcomp.id, err);
      return Promise.reject(err);
    });

  }

  centerView() {
    this.rescale();
  }



  /**
   * updates the view after a zoom event is called. Changes the scale of the palette scale container and
   * scrolls such that the top left point when zoom is called remains the same after the zoom is updated
   *
   * the position of the operation does not change, only the scale does.
   * @param old_zoom - optional previous zoom level for center-based zooming
   */
  rescale(old_zoom?: number) {

    const view_window: HTMLElement = document.getElementById('scrollable-container');
    const container: HTMLElement = document.getElementById('palette-scale-container');
    if (view_window === null || view_window === undefined) return;

    //let the top left point of the scroll, this is given in terms of palette scale container.
    if (container === null) return;

    const new_zoom = this.zs.getMixerZoom();

    // if the old_zoom is provided, then zoom at viewport center 
    // e.g, for keyboard shortcuts
    if (old_zoom !== undefined && old_zoom !== new_zoom) {
      const centerX = view_window.clientWidth / 2;
      const centerY = view_window.clientHeight / 2;

      // calculate world position at viewport center
      const worldPos = {
        x: (view_window.scrollLeft + centerX) / old_zoom,
        y: (view_window.scrollTop + centerY) / old_zoom
      };

      // apply CSS scale transform
      container.style.transformOrigin = "top left";
      container.style.transform = 'scale(' + new_zoom + ')';

      // calculate new scroll position to keep center point fixed
      const newScrollLeft = worldPos.x * new_zoom - centerX;
      const newScrollTop = worldPos.y * new_zoom - centerY;

      view_window.scroll({
        left: newScrollLeft,
        top: newScrollTop,
        behavior: "instant"
      });

    } else {
      // original behavior: maintain scroll percentage (zoom from top-left)
      let pcentX = view_window.scrollLeft / view_window.scrollWidth;
      let pcentY = view_window.scrollTop / view_window.scrollHeight;

      container.style.transformOrigin = "top left";
      container.style.transform = 'scale(' + new_zoom + ')';

      // move the scroll by the same % within the new div size
      let newScrollLeft = view_window.scrollWidth * pcentX;
      let newScrollTop = view_window.scrollWidth * pcentY;

      view_window.scroll({
        left: newScrollLeft,
        top: newScrollTop,
        behavior: "instant"
      });
    }

    this.redrawConnections();
  }


  redrawConnections() {

    //this needs something more robust. 

    let cxn: Array<ConnectionComponent> = this.tree.getConnections().filter(el => el !== null);
    cxn.forEach(el => {
      el.refreshConnection();
    });

  }


  /**
   * loads the snackbar at the bottom of the screen
   * @param message the message to show on the snack bar
   * @param bounds the bounds of the element that we are showing info aboout
   */
  // startSnackBar(message: string, bounds: Bounds) {
  //   this.updateSnackBar(message, bounds);
  //   this._snackBar.openFromComponent(SnackbarComponent, {
  //     data: {
  //       message: this.snack_message,
  //       bounds: this.snack_bounds,
  //       scale: this.zs.getMixerZoom()
  //     }
  //   });
  // }

  /**
   * updates data shown on the snackbar
   * @param message 
   * @param bounds 
   */
  // updateSnackBar(message: string, bounds: Bounds) {

  //   this.snack_bounds = bounds;
  //   this.snack_message = message;
  // }

  /**
   * called to close the snackbar
   */
  // closeSnackBar() {
  //   this._snackBar.dismiss();
  // }


  /**
   * called when a new subdraft is created
   * @param sd 
   */
  setSubdraftSubscriptions(sd: SubdraftComponent) {
    this.subdraftSubscriptions.push(sd.onSubdraftDrop.subscribe(this.subdraftDropped.bind(this)));
    this.subdraftSubscriptions.push(sd.onSubdraftMove.subscribe(this.subdraftMoved.bind(this)));
    this.subdraftSubscriptions.push(sd.onSubdraftStart.subscribe(this.subdraftStarted.bind(this)));
    this.subdraftSubscriptions.push(sd.onDeleteCalled.subscribe(this.onDeleteSubdraftCalled.bind(this)));
    this.subdraftSubscriptions.push(sd.onDuplicateCalled.subscribe(this.onDuplicateSubdraftCalled.bind(this)));
    this.subdraftSubscriptions.push(sd.onConnectionStarted.subscribe(this.onConnectionStarted.bind(this)));
    this.subdraftSubscriptions.push(sd.onDesignAction.subscribe(this.onSubdraftAction.bind(this)));
    this.subdraftSubscriptions.push(sd.onSubdraftViewChange.subscribe(this.onSubdraftViewChange.bind(this)));
    this.subdraftSubscriptions.push(sd.onNameChange.subscribe(this.onNameChange.bind(this)));
    this.subdraftSubscriptions.push(sd.onOpenInEditor.subscribe(this.openInEditor.bind(this)));
  }

  openInEditor(id: number) {
    this.onOpenInEditor.emit(id);
  }

  /**
   * dynamically creates a a note component
   * @returns the created note instance
   */
  createNote(note: Note): NoteComponent {

    let tl: Point = null;

    const notecomp = this.vc.createComponent(NoteComponent);
    this.setNoteSubscriptions(notecomp.instance);

    if (note === null || note.topleft == null || note.topleft === undefined) {
      tl = this.calculateInitialLocation();
      ;
      tl = {
        x: tl.x,
        y: tl.y
      }
    } else {
      tl = {
        x: note.topleft.x,
        y: note.topleft.y
      }
    }
    let id = this.notes.createNote(tl, notecomp.instance, notecomp.hostView, note);

    notecomp.instance.id = id;
    return notecomp.instance;
  }


  //   /**
  //  * dynamically creates a a note component
  //  * @returns the created note instance
  //  */
  //   loadNote(note: Note):NoteComponent{

  //     console.log("LOADING NOTE", note);
  //     if(note.component === null || note.component === undefined){
  //       const noteinstance  = this.createNote();


  //     }else{

  //     }

  //     const notecomp = this.vc.createComponent(NoteComponent);
  //     this.setNoteSubscriptions(notecomp.instance);

  //     note.component = notecomp.instance;
  //     note.ref = notecomp.hostView;

  //     notecomp.instance.id = note.id;
  //     notecomp.instance.scale = this.zs.zoom;
  //     notecomp.instance.default_cell = this.default_cell_size;

  //     return notecomp.instance;
  //   }



  /**
  * called when a new operation is added
  * @param op 
  */
  setNoteSubscriptions(note: NoteComponent) {
    this.noteSubscriptions.push(note.deleteNote.subscribe(this.deleteNote.bind(this)));
    this.noteSubscriptions.push(note.saveNoteText.subscribe(this.saveNote.bind(this)));
    this.noteSubscriptions.push(note.onNoteMoved.subscribe(this.saveNote.bind(this)));
  }

  deleteNote(id: number) {
    const note = this.notes.get(id);
    if (note === undefined) return;
    this.removeFromViewContainer(note.ref);
    this.notes.delete(id);
  }

  saveNote() {
  }



  /**
   * dynamically creates a subdraft component, adds its inputs and event listeners, pushes the subdraft to the list of references
   * @param d a Draft object for this component to contain
   * @returns the created subdraft instance
   */
  createSubDraft(d: Draft, loom: Loom, loom_settings: LoomSettings): Promise<SubdraftComponent> {

    const component = this.vc.createComponent(SubdraftComponent);
    const id = this.tree.createNode('draft', component.instance, component.hostView);
    const subdraft: SubdraftComponent = component.instance;
    this.setSubdraftSubscriptions(subdraft);

    subdraft.id = id;
    subdraft.draft = d;
    subdraft.dn = <DraftNode>this.tree.getNode(id);
    subdraft.scale = this.zs.getMixerZoom();
    subdraft.setPosition(this.calculateInitialLocation(), true);

    return this.tree.loadDraftData({ prev_id: -1, cur_id: id }, d, loom, loom_settings, true, 1, true)
      .then(d => {
        return Promise.resolve(subdraft);
      })
  }

  createSubDraftFromEditedDetail(id: number): Promise<SubdraftComponent> {
    const node: Node = this.tree.getNode(id);
    const subdraft = this.vc.createComponent(SubdraftComponent);
    this.setSubdraftSubscriptions(subdraft.instance);

    node.component = subdraft.instance;
    node.ref = subdraft.hostView;

    subdraft.instance.id = id;
    subdraft.instance.dn = <DraftNode>this.tree.getNode(id);
    subdraft.instance.draft = this.tree.getDraft(id);
    subdraft.instance.scale = this.zs.getMixerZoom();

    return Promise.resolve(subdraft.instance);

  }





  loadSubDraft(id: number, d: Draft, nodep: NodeComponentProxy, draftp: DraftNodeProxy) {
    const component = this.vc.createComponent(SubdraftComponent);
    const node = this.tree.getNode(id)
    node.component = component.instance;
    node.ref = component.hostView;
    const subdraft: SubdraftComponent = component.instance;
    this.setSubdraftSubscriptions(subdraft);





    subdraft.id = id;
    subdraft.dn = <DraftNode>this.tree.getNode(id);
    subdraft.scale = this.zs.getMixerZoom();
    subdraft.use_colors = true;
    subdraft.draft = d;
    subdraft.parent_id = this.tree.getSubdraftParent(id);

    if (nodep !== null && nodep.topleft !== null) {
      const adj_topleft: Point = { x: nodep.topleft.x, y: nodep.topleft.y };
      subdraft.setPosition(adj_topleft, true);

      if (draftp !== null && draftp !== undefined && draftp.render_colors !== undefined) {
        subdraft.use_colors = draftp.render_colors;
      }
    }

  }

  setConnectionSubscriptions(cxn: ConnectionComponent) {
    this.connectionSubscriptions.push(cxn.onConnectionRemoved.subscribe(this.removeConnection.bind(this)));

  }

  /**
   * called when a new operation is added
   * @param op 
   */
  setOperationSubscriptions(op: OperationComponent) {
    this.operationSubscriptions.push(op.onOperationParamChange.subscribe(this.operationParamChanged.bind(this)));
    this.operationSubscriptions.push(op.deleteOp.subscribe(this.onDeleteOperationCalled.bind(this)));
    this.operationSubscriptions.push(op.duplicateOp.subscribe(this.onDuplicateOpCalled.bind(this)));
    this.operationSubscriptions.push(op.onConnectionRemoved.subscribe(this.removeConnection.bind(this)));
    this.operationSubscriptions.push(op.onConnectionStarted.subscribe(this.onConnectionStarted.bind(this)));
    this.operationSubscriptions.push(op.onInputAdded.subscribe(this.connectionMade.bind(this)));
    this.operationSubscriptions.push(op.onInputVisibilityChange.subscribe(this.updateVisibility.bind(this)));
    this.operationSubscriptions.push(op.onInletLoaded.subscribe(this.inletLoaded.bind(this)));
    this.operationSubscriptions.push(op.onOpLoaded.subscribe(this.opCompLoaded.bind(this)));
    this.operationSubscriptions.push(op.onOpenInEditor.subscribe(this.openInEditor.bind(this)));
    this.operationSubscriptions.push(op.onNameChanged.subscribe(this.onNameChange.bind(this)));

  }


  /**
   * creates an operation component
   * @param name the name of the operation this component will perform
   * @returns the OperationComponent created
   */
  createOperation(name: string): OperationComponent {

    const op = this.vc.createComponent<OperationComponent>(OperationComponent);
    const id = this.tree.createNode('op', op.instance, op.hostView);



    this.tree.loadOpData({ prev_id: -1, cur_id: id }, name, undefined, undefined);
    this.setOperationSubscriptions(op.instance);

    op.instance.name = name;
    op.instance.opnode = <OpNode>this.tree.getNode(id);
    op.instance.id = id;
    op.instance.zndx = this.layers.createLayer();
    op.instance.default_cell = this.default_cell_size;

    let tr = this.calculateInitialLocation();
    (<OperationComponent>op.instance).setPosition({ x: tr.x, y: tr.y }, true);



    return op.instance;
  }

  /**
  
  * loads an operation with the information supplied. 
  * @param name the name of the operation this component will perform
  * @params params the input data to be used in this operation
  * @returns the id of the node this has been assigned to
  */
  loadOperation(id: number, name: string, params: Array<any>, inlets: Array<any>, topleft: Point) {

    const component = this.vc.createComponent<OperationComponent>(OperationComponent);
    const node: OpNode = <OpNode>this.tree.getNode(id)
    node.component = component.instance;
    node.ref = component.hostView;

    const op: OperationComponent = component.instance;

    this.setOperationSubscriptions(op);

    op.name = name;
    op.id = id;
    op.zndx = this.layers.createLayer();
    op.default_cell = this.default_cell_size;
    op.opnode = node;
    op.setPosition({ x: topleft.x, y: topleft.y }, true);
    op.loaded = true;


  }



  /**
   * duplicates an operation with the information supplied. 
   * @param name the name of the operation this component will perform
   * @params params the input data to be used in this operation
   * @returns the id of the node this has been assigned to
   */
  duplicateOperation(name: string, params: Array<OpParamValType>, topleft: Point, inlets: Array<any>): number {



    console.log("DUPLICATING OPERATION ", name, params, topleft, inlets);

    const op: OperationComponent = this.createOperation(name);
    this.tree.setOpParams(op.id, params.slice(), inlets.slice());
    (<OperationComponent>op).setPosition({ x: topleft.x, y: topleft.y }, true);
    return op.id;
  }



  /**
   * creates a connection and draws it to screen
   * @param id - the id of this node
   */
  loadConnection(id: number) {
    const cxn = this.vc.createComponent(ConnectionComponent);
    const node = this.tree.getNode(id);

    node.component = cxn.instance;
    this.setConnectionSubscriptions(cxn.instance);
    node.ref = cxn.hostView;

    cxn.instance.id = id;
    cxn.instance.scale = this.zs.getMixerZoom();

  }



  /**
   * creates a connection component and registers it with the tree
   * @returns the list of all id's connected to the "to" node 
   */
  createConnection(id_from: number, id_to: number, to_ndx: number): { input_ids: Array<number>, id: number } {

    const cxn = this.vc.createComponent(ConnectionComponent);
    const id = this.tree.createNode('cxn', cxn.instance, cxn.hostView);
    const to_input_ids: Array<number> = this.tree.addConnection(id_from, 0, id_to, to_ndx, id);

    cxn.instance.id = id;
    cxn.instance.scale = this.zs.getMixerZoom();

    this.setConnectionSubscriptions(cxn.instance);


    this.connectionSubscriptions.push()
    return { input_ids: to_input_ids, id: id };
  }




  // /**
  //  * called from upload or import events
  //  * @param d 
  //  */
  // addSubdraftFromDraft(d: Draft) {
  //   let ls = defaults.loom_settings;

  //   let util = getLoomUtilByType(ls.type);
  //   util.computeLoomFromDrawdown(d.drawdown, ls)
  //     .then(loom => {
  //       return this.createSubDraft(d, loom, ls)
  //     }).then(sd => {
  //       let tr = this.calculateInitialLocation();
  //       sd.topleft = { x: tr.x, y: tr.y };
  //     });

  // }

  /**
  //  * called anytime an operation is added. Adds the operation to the tree. 
  //  * @param name the name of the operation to add
  //  */
  pasteSubdraft(draftnode: DraftNode): Promise<number> {
    //create a new idea for this draft node: 


    let d = copyDraft(draftnode.draft);
    let l = copyLoom(draftnode.loom);
    let ls = copyLoomSettings(draftnode.loom_settings);
    d.id = generateId(8);

    return this.createSubDraft(d, l, ls).then(sd => {
      let tr = this.calculateInitialLocation();
      sd.setPosition({ x: tr.x, y: tr.y }, true);
      return Promise.resolve(sd.id);
    });

  }

  /**
   * removes the subdraft sent to the function
   * updates the tree view_id's in response
   * @param id {number}  
  
   */
  removeSubdraft(id: number) {


    if (id === undefined) return;

    this.vs.checkOnDelete(id);

    const outputs = this.tree.getNonCxnOutputs(id);
    const delted_nodes = this.tree.removeSubdraftNode(id);

    delted_nodes.forEach(node => {
      this.removeFromViewContainer(node.ref);
      this.viewport.removeObj(node.id);
    })

    outputs.forEach(out => {
      this.performAndUpdateDownstream(out).catch(err => {
        this.postOperationErrorMessage(out, err);
      });
    })

  }

  /**
   * this calls the tree to delete the operation.
   * the tree returns a list of all nodes deleted and this function updates the view to remove those elements
   * @param id 
   */
  removeOperation(id: number) {

    if (id === undefined) return;

    const op_node = this.tree.getOpNode(id);
    const op_base = this.ops.getOp(op_node.name);
    op_base.params.forEach((param, ndx) => {
      if (param.type == 'file') {
        //remove the media file associated 
        this.media.removeInstance(+(<Img>op_node.params[ndx]).id)
      }
    })

    const drafts_out = this.tree.getNonCxnOutputs(id);
    drafts_out.forEach(id => this.vs.checkOnDelete(id));

    const outputs: Array<number> = drafts_out.reduce((acc, el) => {
      return acc.concat(this.tree.getNonCxnOutputs(el));
    }, []);


    //TODO Make sure this is actually returning all the removed nodes
    const delted_nodes = this.tree.removeOperationNode(id);
    delted_nodes.forEach(node => {
      if (node.type == 'draft') this.vs.checkOnDelete(id);
      this.removeFromViewContainer(node.ref);
      this.viewport.removeObj(node.id);
    });

    outputs.forEach(out => {
      this.performAndUpdateDownstream(out).catch(err => {
        this.postOperationErrorMessage(out, err);
      });
    })

  }




  /**
   * Sets the mixer editing mode
   * @param mode - The mixer editing mode ('pan', 'move', 'select', etc.)
   */
  public setMixerEditingMode(mode: string): void {
    this.cur_mixer_mode = mode;
  }

  /**
   * Checks if a specific mixer editing mode is currently selected
   * @param value - The mode to check
   * @returns true if the mode is selected
   */
  public isSelectedMixerEditingMode(value: string): boolean {
    return this.cur_mixer_mode === value;
  }

  /**
   * Called from mixer when it receives a change from the design mode tool or keyboard press
   * triggers view mode changes required for this mode
   */
  public designModeChanged() {

    if (this.isSelectedMixerEditingMode('move')) {
      this.unfreezePaletteObjects();

    } else {
      this.freezePaletteObjects();
    }

    // if(this.dm.getDesignMode('draw', 'design_modes').selected || this.dm.getDesignMode('shape',  'design_modes').selected){
    //   const old_zoom = this.zs.zoom;
    //   this.zs.setZoom(Math.ceil(this.zs.zoom))
    //   this.rescale(old_zoom);
    // }

  }

  /**
   * specifically removes the subscription from the move event
   */
  private removeSubscription() {
    if (this.moveSubscription) {
      this.moveSubscription.unsubscribe();
    }
  }



  /**
   * Emitted from the subject object when it has been called for deletion.
   */
  onDeleteSubdraftCalled(id: number) {

    if (id === null || id == -1) return;

    const change: DraftExistenceChange = {
      originator: 'DRAFT',
      type: 'REMOVED',
      node: this.tree.getNode(id),
      inputs: [],
      outputs: this.tree.getOutwardConnectionProxies(id)
    }
    this.ss.addStateChange(change);

    this.removeSubdraft(id);
  }

  /**
  * Deletes the subdraft that called this function.
  */
  onDeleteOperationCalled(obj: any) {

    if (obj === null) return;


    this.removeOperation(obj.id);
  }

  /**
  *Duplicates the operation that called this function.
  */
  onDuplicateOpCalled(obj: any) {
    if (obj === null) return;

    const op = this.tree.getOpNode(obj.id);
    const op_comp = <OperationComponent>this.tree.getComponent(obj.id);
    const operation: Operation = this.ops.getOp(op.name);


    let new_tl: Point = null;

    const op_topleft = op_comp.getPosition();
    if (this.tree.hasSingleChild(obj.id)) {
      new_tl = { x: op_topleft.x + 200, y: op_topleft.y }
    } else {
      let container = document.getElementById('scale-' + obj.id);
      new_tl = { x: op_topleft.x + 10 + container.offsetWidth * this.zs.getMixerZoom() / this.default_cell_size, y: op_topleft.y }
    }

    let new_params: Array<OpParamValType> = op.params.slice();
    //make sure to duplicate any media objects
    operation.params.forEach((param, i) => {
      if (param.type == 'file') {
        let old_media_id = (<Img>op.params[i]).id;
        let new_media_item = this.media.duplicateIndexedColorImageInstance(+old_media_id);
        new_params[i] = { id: new_media_item.id.toString(), data: <AnalyzedImage>new_media_item.img }
      }
    })




    const id: number = this.duplicateOperation(op.name, new_params, new_tl, op.inlets);
    const new_op = <OperationComponent>this.tree.getComponent(id);

    //duplicate the connections as well
    const cxns = this.tree.getInputsWithNdx(op.id);
    cxns.forEach(cxn => {
      if (cxn.tn.inputs.length > 0) {
        const from = cxn.tn.inputs[0].tn.node.id;
        this.createConnection(from, new_op.id, cxn.ndx);
      }
    })

    this.performAndUpdateDownstream(id).catch(err => {
      this.postOperationErrorMessage(id, err);
    });


  }


  onDuplicateSubdraftCalled(obj: any) {
    if (obj === null) return;

    const sd_draft = <Draft>this.tree.getDraft(obj.id);
    const sd_loom = <Loom>this.tree.getLoom(obj.id);
    const sd_ls = <LoomSettings>this.tree.getLoomSettings(obj.id);

    let new_draft = initDraftWithParams(
      {
        wefts: wefts(sd_draft.drawdown),
        warps: warps(sd_draft.drawdown),
        drawdown: sd_draft.drawdown.slice(),
        rowShuttleMapping: sd_draft.rowShuttleMapping.slice(),
        colShuttleMapping: sd_draft.colShuttleMapping.slice(),
        rowSystemMapping: sd_draft.rowSystemMapping.slice(),
        colSystemMapping: sd_draft.colSystemMapping.slice(),
        gen_name: getDraftName(sd_draft) + " copy"
      });


    let new_loom = copyLoom(sd_loom)
    let new_ls = copyLoomSettings(sd_ls)

    this.createSubDraft(new_draft, new_loom, new_ls)
      .then(new_sd => {

        const orig_size = document.getElementById('scale-' + obj.id);
        let tr = this.calculateInitialLocation();
        new_sd.setPosition({ x: tr.x, y: tr.y }, true);


      }).catch(console.error);

  }

  /**
   * A mouse event, originated in a subdraft, has been started
   * checkes the design mode and handles the event as required
   * @param obj contains the id of the moving subdraft
   */
  subdraftStarted(obj: any) {
    if (obj === null) return;

    if (this.isSelectedMixerEditingMode("move")) {

      //get the reference to the draft that's moving
      const moving = <SubdraftComponent>this.tree.getComponent(obj.id);

      if (moving === null) return;

    }

  }

  /**
   * when the connection is started, this manually adjusts styling on the outlet component 
   * @param id 
   * @param active 
   */
  setOutletStylingOnConnection(id: number, active: boolean) {
    if (id == -1) return;

    let sd_container = document.getElementById(id + '-out')
    if (active) sd_container.style.backgroundColor = "#ff4081";
    else {
      if (this.tree.getNonCxnOutputs(id).length > 0) {
        sd_container.style.backgroundColor = "black";
        sd_container.style.color = "white";
      }
      else {
        sd_container.style.backgroundColor = "white";
        sd_container.style.color = "black";
      }

    }
  }

  /**
   * triggers a mode that allows mouse-mouse to be followed by a line.
   * todo; add code that holds the point on scroll
   * @param obj - contains event, id of component who called
   */
  onConnectionStarted(obj: any) {
    if (obj.type == 'stop' || (this.tree.getOpenConnectionId() !== -1)) {
      this.selecting_connection = false;
      this.setOutletStylingOnConnection(this.tree.getOpenConnectionId(), false);
      this.tree.unsetOpenConnection();
      this.processConnectionEnd();
      if (obj.type == 'stop') return;
    }



    const valid = this.tree.setOpenConnection(obj.id);
    if (!valid) return;

    this.selecting_connection = true;

    //make sure to unselect anything else that had previously been selected
    // const all_drafts = this.tree.getDraftNodes();
    // const not_selected = all_drafts.filter(el => el.id !== obj.id);
    // not_selected.forEach(node => {
    //   let comp = <SubdraftComponent>node.component;
    //   if(comp !== null) comp.selecting_connection = false;
    // })



    //const sd: SubdraftComponent = <SubdraftComponent> this.tree.getComponent(obj.id);

    let adj: Point;


    let parent = document.getElementById('scrollable-container');
    let parent_rect = parent.getBoundingClientRect();
    let sd_container = document.getElementById(obj.id + '-out')
    let sd_rect = sd_container.getBoundingClientRect();

    this.setOutletStylingOnConnection(obj.id, true);

    const zoom_factor = 1 / this.zs.getMixerZoom();
    //on screen position relative to palette
    let screenX = sd_rect.x - parent_rect.x + parent.scrollLeft;
    let scaledX = screenX * zoom_factor;

    //on screen position relative to palette
    let screenY = sd_rect.y - parent_rect.y + parent.scrollTop;
    let scaledY = screenY * zoom_factor;

    adj = {
      x: scaledX,
      y: scaledY
    }


    this.unfreezePaletteObjects();

    this.active_connection = {
      topleft: adj,
      width: this.default_cell_size,
      height: this.default_cell_size
    };


  }






  /**
   * disables selection and pointer events on all
   */
  freezePaletteObjects() {
    const nodes: Array<any> = this.tree.getComponents();
    nodes
      .filter(el => el && el.disableDrag)
      .forEach(el => {
        el.disableDrag();
      });

    const notes: Array<any> = this.notes.getComponents();
    notes
      .filter(el => el && el.disableDrag)
      .forEach(el => {
        el.disableDrag();
      });
  }

  /**
  * unfreezes all palette objects (except connections)
  */
  unfreezePaletteObjects() {
    const nodes: Array<any> = this.tree.getComponents();
    nodes
      .filter(el => el && el.disableDrag)
      .forEach(el => {
        el.enableDrag();
      });

    const notes: Array<any> = this.notes.getComponents();

    notes
      .filter(el => el && el.disableDrag)
      .forEach(el => {
        el.enableDrag();
      });
  }


  /**
   * this is called when an subdraft updates its show/hide value
   */
  onSubdraftViewChange(id: number) {

    /** TODO need a force redraw here. */
    // this.updateAttachedComponents(id, false);

  }


  onNameChange(id: number) {

    const outs = this.tree.getNonCxnOutputs(id);
    const to_perform = outs.map(el => this.performAndUpdateDownstream(el).catch(err => {
      this.postOperationErrorMessage(el, err);
    }));

    return Promise.all(to_perform)
      .catch(console.error);




  }



  /**
    * draws when a user is using the mouse to identify an input to a component
    * @param mouse the absolute position of the mouse on screen
    * @param shift boolean representing if shift is pressed as well 
    */
  connectionDragged(mouse: Point) {



    let parent = document.getElementById('scrollable-container');
    let rect_palette = parent.getBoundingClientRect();

    const zoom_factor = 1 / this.zs.getMixerZoom();

    //on screen position relative to palette
    let screenX = mouse.x - rect_palette.x + parent.scrollLeft; //position of mouse relative to the palette sidebar - takes scroll into account
    let scaledX = screenX * zoom_factor;

    //on screen position relative to palette
    let screenY = mouse.y - rect_palette.y + parent.scrollTop;
    let scaledY = screenY * zoom_factor;


    //get the mouse position relative to the view frame
    const adj: Point = {
      x: scaledX,
      y: scaledY
    }


    //get the mouse position relative to the view frame
    this.active_connection.width = (adj.x - this.active_connection.topleft.x);
    this.active_connection.height = (adj.y - this.active_connection.topleft.y);



    const svg = document.getElementById('scratch_svg');
    svg.style.top = (this.active_connection.topleft.y) + "px";
    svg.style.left = (this.active_connection.topleft.x) + "px"

    const cpOffset = 400;


    svg.innerHTML = ' <path d="M 0 0 C 0 ' + cpOffset + ','
      + (this.active_connection.width) + ' '
      + (this.active_connection.height - cpOffset) + ', '
      + (this.active_connection.width) + ' '
      + (this.active_connection.height)
      + '" fill="transparent" stroke="#ff4081"  stroke-dasharray="20 1"  stroke-width="8"/> ';



  }


  /**
   * resets the view when a connection event ends
   */
  processConnectionEnd() {
    this.selecting_connection = false;
    this.setOutletStylingOnConnection(this.tree.getOpenConnectionId(), false);
    const svg = document.getElementById('scratch_svg');
    svg.innerHTML = ' ';

    if (!this.tree.hasOpenConnection()) return;


    const sd: SubdraftComponent = this.tree.getOpenConnection();
    if (sd !== null) sd.connectionEnded();
    this.tree.unsetOpenConnection();

  }


  /**
   * Optimized this to work with adding of operations
   * @returns 
   */
  calculateInitialLocation(): Point {

    const container = document.getElementById('scrollable-container');
    const container_rect = container.getBoundingClientRect();

    let tl = {
      x: (container.scrollLeft + container_rect.x) * 1 / this.zs.getMixerZoom(),
      y: (container.scrollTop + container_rect.y) * 1 / this.zs.getMixerZoom(),
    }

    //prevent this from getting hidden
    if (tl.x < 300) tl.x = 300;
    if (tl.y < 64) tl.y = 64;

    // Try to find a non-overlapping position
    const padding = 20; // minimum spacing between components
    const stepSize = 50; // how far to move when checking next position
    const maxAttempts = 100; // prevent infinite loops

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (!this.isOverlapping(tl, padding)) {
        return tl;
      }

      // Try positions in a spiral pattern
      const angle = attempt * 0.5; // radians
      const radius = Math.floor(attempt / 4) * stepSize;
      tl = {
        x: tl.x + Math.cos(angle) * radius,
        y: tl.y + Math.sin(angle) * radius
      };

      // Keep within bounds
      if (tl.x < 300) tl.x = 300;
      if (tl.y < 64) tl.y = 64;
    }

    // If we couldn't find a non-overlapping position, return the original
    return tl;


  }


  /**
   * Check if a position overlaps with any existing component
   * @param position The position to check
   * @param padding Minimum spacing required
   * @returns true if overlapping, false otherwise
   */
  private isOverlapping(position: Point, padding: number): boolean {
    // Get all components (drafts and operations)
    const allComponents = [
      ...this.tree.getDraftNodes().map(dn => dn.component),
      ...this.tree.getOperations(),
      ...this.notes.getComponents()
    ].filter(comp => comp !== null && comp !== undefined);

    for (const comp of allComponents) {
      const topleft = (<SubdraftComponent | OperationComponent | NoteComponent>comp).getPosition();
      if (!topleft) continue;

      const compDom = document.getElementById('scale-' + comp.id);
      if (!compDom) continue;

      const compRect = compDom.getBoundingClientRect();
      const compWidth = compRect.width / this.zs.getMixerZoom();
      const compHeight = compRect.height / this.zs.getMixerZoom();

      // Check if rectangles overlap (with padding)
      const compRight = topleft.x + compWidth + padding;
      const compBottom = topleft.y + compHeight + padding;
      const compLeft = topleft.x - padding;
      const compTop = topleft.y - padding;

      // For now, we'll assume new components have a default size
      // You may want to pass the expected size as a parameter
      const newWidth = 200; // default width, adjust as needed
      const newHeight = 200; // default height, adjust as needed

      const newRight = position.x + newWidth + padding;
      const newBottom = position.y + newHeight + padding;
      const newLeft = position.x - padding;
      const newTop = position.y - padding;

      // Check for overlap
      if (!(newRight < compLeft || newLeft > compRight || newBottom < compTop || newTop > compBottom)) {
        return true; // Overlapping
      }
    }

    return false; // No overlap found
  }

  /**
   * this is called from a operation or subdraft that has changed size. This means that it's connection needs to be redrawn such that 
   * it properly displays the from position on the connection
   * @param sd_id : the subdraft id associated with the change
   */
  // redrawOutboundConnections(sd_id: number) {
  //   let connections = this.tree.getOutputs(sd_id);


  //   connections.forEach(cxn => {
  //     let comp = this.tree.getComponent(cxn);
  //     if (comp !== null) {
  //       (<ConnectionComponent>comp).updateFromPosition();
  //     }
  //   })

  // }



  /**
   * this calls a function for an operation to perform and then subsequently calls all children 
   * to recalculate. After each calculation, it redraws and or creates any new subdrafts
   * @param op_id 
   * @returns 
   */
  private performAndUpdateDownstream(op_id: number): Promise<any> {

    console.log("Perform and update downstream from palette", op_id);
    return this.tree.performAndUpdateDownstream([op_id])

      .catch(err => {
        console.error("Error performing and updating downstream", err);
        return Promise.reject(err);
      });

  }




  /**
   * when an inlet is pressed on an operation, highlight all things contributed to this inlet
   * @param op_id 
   * @param inlet_id 
   * @param ndx_in_inlets - if there aremultiple inputs at a single inlet, give the number in that list
   */
  highlightPathToInlet(op_id: number, inlet_id: number, ndx_in_inlets: number) {

    const cxns = this.tree.getInputsAtNdx(op_id, inlet_id);
    const upstream_ops = this.tree.getUpstreamOperations(cxns[ndx_in_inlets].tn.node.id);
    const upstream_drafts = this.tree.getUpstreamDrafts(cxns[ndx_in_inlets].tn.node.id);

    // const upstream_ops = cxns.reduce((acc, val)=>{
    //    const ids = this.tree.getUpstreamOperations(val.tn.node.id);
    //    return acc.concat(ids);
    //  }, []); 

    // const upstream_drafts = cxns.reduce((acc, val)=>{
    //   const ids = this.tree.getUpstreamDrafts(val.tn.node.id);
    //   return acc.concat(ids);
    // }, []); 

    const upstream_cxn = upstream_drafts.reduce((acc, draft) => {
      return acc.concat(this.tree.getOutputs(draft));
    }, []);



    //  const upstream_drafts = this.tree.getUpstreamDrafts(op_id);
    const op_children = this.tree.getNonCxnOutputs(op_id);

    const all_ops = this.tree.getOpNodes();
    all_ops.forEach(op => {
      if (upstream_ops.find(el => el === op.id) === undefined) {
        if (op.id !== op_id) {
          const div = document.getElementById("scale-" + op.id);
          if (div !== null) div.style.opacity = ".2";
        }
      }
    })

    const all_drafts = this.tree.getDraftNodes();
    all_drafts.forEach(draft => {
      if (upstream_drafts.find(el => el === draft.id) === undefined) {
        if (op_children.find(del => del === draft.id) === undefined) {
          const div = document.getElementById("scale-" + draft.id);
          if (div !== null) div.style.opacity = ".2";
        }
      }
    })

    const all_cxns = this.tree.getConnections();
    all_cxns.forEach(cxn => {
      if (upstream_cxn.find(el => el === cxn.id) === undefined) {
        const div = document.getElementById("scale-" + cxn.id);
        if (div !== null) div.style.opacity = ".2";
      } else {
        cxn.show_path_text = true;
        cxn.drawConnection();
      }
    })

  }

  resetOpacity() {
    const ops = this.tree.getOpNodes();
    ops.forEach(op => {
      const div = document.getElementById("scale-" + op.id);
      if (div !== null) div.style.opacity = "1"
    });

    const drafts = this.tree.getDraftNodes();
    drafts.forEach(draft => {
      const div = document.getElementById("scale-" + draft.id);
      if (div !== null) div.style.opacity = "1"
    });

    const cxns = this.tree.getConnections();
    cxns.forEach(cxn => {
      const div = document.getElementById("scale-" + cxn.id);
      if (div !== null) div.style.opacity = "1"
      cxn.show_path_text = false;
      cxn.drawConnection();

    });


  }



  /**
   * called from an operation or inlet to allow for the inlighting of all upstream operations and drafts
   * @param obj 
   */
  updateVisibility(obj: any) {
    {

      this.resetOpacity();
      if (obj.show == true) {

        //unset any no longer selected inlets
        const ops: Array<OpNode> = this.tree.getOpNodes();
        const not_selected = ops.filter(el => el.id !== obj.id);


        not_selected.forEach((op, ndx) => {
          const inlets = op.inlets.map((val, ndx) => ndx);
          (<OperationComponent>op.component).resetVisibliity(inlets);
        })

        let selected = ops.filter(el => el.id == obj.id);
        if (selected.length > 0) {
          const inlets = selected[0].inlets.map((val, ndx) => ndx).filter(el => el !== obj.ndx);
          (<OperationComponent>selected[0].component).resetVisibliity(inlets);
        }


        this.highlightPathToInlet(obj.id, obj.ndx, obj.ndx_in_inlets);


      } else {
        this.visible_op = -1;
        this.visible_op_inlet = -1;
      }

    }
  }

  /**
   * called from an operation or inlet to allow for the inlighting of all upstream operations and drafts
   * @param obj 
   */
  inletLoaded(obj: any) {
    //redraw the inlet
    // let opid = obj.opid;
    // let ndx = obj.ndx;

    // const opnode = this.tree.getOpNode(opid);
    // const cxns = this.tree.getInputsAtNdx(opnode.id, ndx);
    // // console.log("CXNS ", cxns);
    // cxns.forEach(io => {
    //   const cxn = <ConnectionComponent> this.tree.getComponent(io.tn.node.id);
    //   // console.log("ATTEMPTING TO UPDATE TO POSITION ")
    //   cxn.updateToPosition(opnode.id, this.zs.zoom)
    // })
  }

  /**
   * called from an operation or inlet to allow for the highlighting of all upstream operations and drafts
   * @param obj 
   */
  opCompLoaded(obj: any) {
    //redraw the inlet
    // let opid = obj.id;
    // const cxns = this.tree.getInputsWithNdx(opid);


  }


  postOperationErrorMessage(op_id: number, err: any) {
    //emit something here to the parent to flash a message
    this.onPerformOperationError.emit({ op_id: op_id, error: err });
  }

  /**
   * emitted from operation when it receives a hit on its connection button, the id refers to the operation id
   */
  connectionMade(obj: any) {


    if (!this.tree.hasOpenConnection()) return;


    //this is defined in the order that the line was drawn
    const op: OperationComponent = <OperationComponent>this.tree.getComponent(obj.id);
    const sd: number = this.tree.getOpenConnectionId();




    const cxn = this.createConnection(sd, obj.id, obj.ndx);
    const change: ConnectionExistenceChange = {
      originator: 'CONNECTION',
      type: 'CREATED',
      node: this.tree.getNode(cxn.id),
      inputs: [{ from_id: sd, inlet_id: 0 }],
      outputs: [{ identity: 'OP', outlet_id: 0, to_id: obj.id, inlet_id: obj.ndx }]
    }

    this.ss.addStateChange(change);


    this.performAndUpdateDownstream(obj.id).then(el => {
      let children = this.tree.getNonCxnOutputs(obj.id);
      if (children.length > 0) this.vs.setViewer(children[0]);
    }).catch(err => {
      console.error("Error performing and updating downstream", err);
      this.postOperationErrorMessage(obj.id, err);
    });

    this.processConnectionEnd();

  }

  pasteConnection(from: number, to: number, inlet: number) {

    this.createConnection(from, to, inlet);


    this.performAndUpdateDownstream(to).catch(err => {
      console.error("Error performing and updating downstream", err);
      this.postOperationErrorMessage(to, err);
    });

  }

  /**
   * Called when a connection is explicitly deleted
   * id refers to the id of the connection that is being deleted. 
  */
  removeConnection(obj: { id: number }) {

    let to = this.tree.getConnectionOutputWithIndex(obj.id);
    let from = this.tree.getConnectionInput(obj.id);


    const to_delete = this.tree.removeConnectionNodeById(obj.id);
    to_delete.forEach(node => this.removeFromViewContainer(node.ref));

    // if(to_delete.length > 0) console.log("Error: Removing Connection triggered other deletions");

    this.processConnectionEnd();
    this.setOutletStylingOnConnection(from, false);

    if (this.tree.getType(to.id) === "op") {
      this.performAndUpdateDownstream(to.id).then(done => {
        this.vs.updateViewer();


      }).catch(err => {
        console.error("Error performing and updating downstream", err);
        this.postOperationErrorMessage(to.id, err);
      });
    }






  }



  panStarted(mouse_pos: Point) {
    this.last_point = mouse_pos;
    this.freezePaletteObjects();

  }




  /**
   * Handles mouse wheel zoom with Ctrl/Cmd modifier, zooming at cursor position
   * Uses normalize-wheel to handle cross-browser and touchpad/mouse differences
   * @param event - The wheel event
   */
  @HostListener('wheel', ['$event'])
  public onWheel(event: WheelEvent) {
    // Only zoom when Ctrl (Windows/Linux) or Cmd (Mac) is pressed
    if (!event.ctrlKey && !event.metaKey) return;

    event.preventDefault();

    const view_window: HTMLElement = document.getElementById('scrollable-container');
    const container: HTMLElement = document.getElementById('palette-scale-container');
    if (!view_window || !container) return;

    // normalize wheel event across browsers and 
    // input types (mouse vs touchpad)
    const normalized = normalizeWheel(event);

    // use spinY for zoom (normalized spin speed, good for zoom)
    // only zoom if we have enough spin to warrant a zoom step
    const spinThreshold = 0.15;
    if (Math.abs(normalized.spinY) < spinThreshold) {
      return;
    }

    const zoom_before = this.zs.getMixerZoom();

    // Get mouse position relative to the scrollable container (not viewport)
    const rect = view_window.getBoundingClientRect();
    const mousePos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    // Calculate world position under cursor BEFORE zoom
    const worldPos = {
      x: (view_window.scrollLeft + mousePos.x) / zoom_before,
      y: (view_window.scrollTop + mousePos.y) / zoom_before
    };

    const zoomOut = normalized.spinY > 0;
    if (zoomOut) {
      this.zs.zoomOutMixer();
    } else {
      this.zs.zoomInMixer();
    }

    const zoom_after = this.zs.getMixerZoom();

    // Apply CSS scale transform
    container.style.transformOrigin = "top left";
    container.style.transform = 'scale(' + zoom_after + ')';

    // Calculate new scroll position to keep world position under cursor
    const newScrollLeft = worldPos.x * zoom_after - mousePos.x;
    const newScrollTop = worldPos.y * zoom_after - mousePos.y;

    // Set scroll position
    view_window.scroll({
      left: newScrollLeft,
      top: newScrollTop,
      behavior: "instant"
    });

    this.viewport.set(
      view_window.scrollLeft,
      view_window.scrollTop,
      view_window.clientWidth,
      view_window.clientHeight
    );

    // Redraw connections at new zoom level
    this.redrawConnections();
  }

  /**
   * Handles mouse down events, including pan mode triggers (shift+click, space+click, middle-click)
   * @param event - The mousedown event
   */
  @HostListener('mousedown', ['$event'])
  public onStart(event) {


    if (this.selecting_connection == true) {
      this.processConnectionEnd();
    }

    // if (this.needs_init) {
    //   //this is a hack to update the screen posiitons because not all inforamtion is ready when onload and onview init completes
    //   let ops = this.tree.getOpNodes();
    //   ops.forEach(op => {
    //     this.opCompLoaded(op);

    //     // let drafts = this.tree.getDraftOutputs(op.id);
    //     // drafts.forEach((draft, ndx) => {
    //     //   let draftcomp = <SubdraftComponent> this.tree.getComponent(draft);
    //     //   draftcomp.updatePositionFromParent(<OperationComponent>op.component, ndx)
    //     // })

    //   }
    //   );
    //   this.needs_init = false;
    // }




    this.removeSubscription();

    // Enable panning with Shift+left-click, Space+left-click, or middle-click
    const isPanMode = this.isSelectedMixerEditingMode("pan");
    const isShiftClick = event.shiftKey && event.button === 0;
    const isSpaceClick = this.space_held && event.button === 0;
    const isMiddleClick = event.button === 1;

    // Check if the click is on a draggable element (subdraft, operation, or note)
    // If so, don't start panning - let the click event propagate to the element
    const target = event.target as HTMLElement;
    const isOnDraggable = target.closest('.subdraft-parent-container, .operation-parent, .note-container') !== null;

    if (isMiddleClick) {
      // set to true so we can show grabby hand cursor
      this.middle_mouse_held = true;
    }

    // Don't start panning if clicking on a draggable element (allow click event to fire)
    if ((isPanMode || isSpaceClick || isMiddleClick) && !isOnDraggable) {
      event.preventDefault(); // Prevent middle-click scroll behavior and space scrolling
      this.panStarted({ x: event.clientX, y: event.clientY });
      this.moveSubscription =
        fromEvent(event.target, 'mousemove').subscribe(e => this.onDrag(e));
      return;
    }

    //handle clicks on the palette

    if (this.isSelectedMixerEditingMode("move") && !isOnDraggable) {


      if (isShiftClick) {
        this.hasMultiSelectBounds = true;
        this.multi_select_bounds.topleft = { x: event.clientX, y: event.clientY };
        this.moveSubscription = fromEvent(event.target, 'mousemove').subscribe(e => this.onMultiSelectDrag(e));

      } else {
        this.multiselect.clearSelections();
      }



    }
  }


  @HostListener('mousemove', ['$event'])
  public onMove(event) {

    const mouse: Point = {
      x: event.clientX,
      y: event.clientY
    };

    if (this.selecting_connection) {
      this.connectionDragged(mouse);
    }
  }

  onMultiSelectDrag(event) {
    const mouse: Point = { x: event.clientX, y: event.clientY };


    if (mouse.x < this.multi_select_bounds.topleft.x) {
      this.multi_select_bounds.topleft.x = mouse.x;
    }
    if (mouse.y < this.multi_select_bounds.topleft.y) {
      this.multi_select_bounds.topleft.y = mouse.y;
    }

    this.multi_select_bounds.width = Math.abs(mouse.x - this.multi_select_bounds.topleft.x);
    this.multi_select_bounds.height = Math.abs(mouse.y - this.multi_select_bounds.topleft.y);

  }




  /**
   * called form the subscription created on start, checks the index of the location and returns null if its the same
   * @param event the event object
   */
  onDrag(event) {


    const mouse: Point = { x: this.viewport.getTopLeft().x + event.clientX, y: this.viewport.getTopLeft().y + event.clientY };

    // pan if in pan mode, or if shift/middle-click was used to initiate
    if (this.last_point) {
      const diff = {
        x: (this.last_point.x - event.clientX),
        y: (this.last_point.y - event.clientY)
      }

      this.handlePan(diff);
    }
    this.last_point = { x: event.clientX, y: event.clientY };
  }



  /**
   * Called when the mouse is up or leaves the boundary of the view
   * @param event
   * @returns
   */
  @HostListener('mouseleave', ['$event'])
  @HostListener('mouseup', ['$event'])
  public onEnd(event) {


    this.removeSubscription();

    // reset middle mouse state
    if (event.button === 1 || event.type === 'mouseleave') {
      this.middle_mouse_held = false;
    }

    // update viewport if panning happened
    if (this.last_point) {
      const div: HTMLElement = document.getElementById('scrollable-container');
      if (div) {
        this.viewport.set(div.scrollLeft, div.scrollTop, div.clientWidth, div.clientHeight);
      }

      // re-enable dragging on nodes after panning
      this.unfreezePaletteObjects();
    }

    // if (this.hasMultiSelectBounds) {
    //   this.hasMultiSelectBounds = false;
    //   this.multi_select_bounds = { topleft: { x: 0, y: 0 }, width: 0, height: 0 };
    //   this.multiselect.clearSelections();
    // }

    //unset vars that would have been created on press
    this.last_point = undefined;
  }



  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Shift' && !this.shift_held) {
      this.shift_held = true;
    }
    if (event.key === ' ' && !this.space_held) {
      this.space_held = true;
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    if (event.key === 'Shift') {
      this.shift_held = false;
    }
    if (event.key === ' ') {
      this.space_held = false;
    }
  }




  /**
   * emitted from a subdraft when an internal action has changeded its value 
   * checks for a child subdraft, recomputes, redraws. 
   * @param obj with attribute id describing the subdraft that called this
   * @returns 
   */
  onSubdraftAction(obj: any, flag_for_debugging: boolean) {

    if (obj === null) return;

    const outputs = this.tree.getNonCxnOutputs(obj.id);
    const fns = outputs.map(out => this.performAndUpdateDownstream(out));

    Promise.all(fns).catch(error => {
      this.postOperationErrorMessage(obj.id, error);
    })

  }

  /**
   * emitted from an operation when its param has changed. This is automatically called on load 
   * which is annoying because it recomputes everything!
   * checks for a child subdraft, recomputes, redraws. 
   * @param obj with attribute id describing the operation that called this
   * @returns 
   */
  async operationParamChanged(obj: { id: number, prior_inlet_vals: Array<any> }) {
    if (obj === null) return;

    console.log("Operation param changed", obj.id);
    return this.tree.sweepInlets(obj.id, obj.prior_inlet_vals)
      .then(viewRefs => {
        viewRefs.forEach(el => {
          this.removeFromViewContainer(el)
        });
        return this.performAndUpdateDownstream(obj.id)
      })
      .then(el => {
        return this.tree.sweepOutlets(obj.id)
      })
      .then(viewRefs => {
        viewRefs.forEach(el => {
          this.removeFromViewContainer(el)
        });
      })
      .catch(error => {
        this.postOperationErrorMessage(obj.id, error);
      });



  }




  moveSelectionsFromUndo(moving_id: number, selections: Array<{ id: number, topleft: Point }>, rel_pos: Point) {
    if (selections.length == 0) return;

    const comp = <SubdraftComponent | OperationComponent>this.tree.getComponent(moving_id);
    const cur_pos = comp.getPosition();
    const diff: Point = { x: cur_pos.x - rel_pos.x, y: cur_pos.y - rel_pos.y };

    selections.forEach(sel => {
      if (this.tree.getNode(sel.id) == null) return;

      if (this.tree.getType(sel.id) == 'op') {
        const comp = this.tree.getComponent(sel.id) as OperationComponent;
        const comp_topleft = comp.getPosition();
        const new_pos: Point = { x: (comp_topleft.x - diff.x), y: (comp_topleft.y - diff.y) }
        comp.setPosition(new_pos, true)
      }
      if (this.tree.getType(sel.id) == 'draft') {
        const comp = <SubdraftComponent>this.tree.getComponent(sel.id);
        const comp_topleft = comp.getPosition();
        const new_pos: Point = { x: (comp_topleft.x - diff.x), y: (comp_topleft.y - diff.y) }
        if (comp.parent_id == -1) comp.setPosition(new_pos, true)
      }
    });
  }



  /**
   * called when subdraft component says its moving
   * @param obj the subdraft that called this
   * @returns 
   */
  subdraftMoved(obj: any) {


  }


  /**
   * checks if this subdraft has been dropped 
   * @param obj 
   * @returns 
   */
  subdraftDropped(obj: any) {


  }

  /**
   * reposition all of the drafts and operations on screen such that none of them overlap. 
   */
  explode() {

    //get each element as a dom rect
    let rect_list = this.tree.nodes
      .filter(el => (el !== null && el.type !== 'cxn'))
      .map(el => { return { dom: document.getElementById('scale-' + el.id), id: el.id } })
      .filter(el => el.dom !== undefined && el.dom !== null);

    rect_list.forEach(el => {
      let comp = <SubdraftComponent | OperationComponent>this.tree.getComponent(el.id);
      let topleft = comp.getPosition();
      comp.setPosition({ x: topleft.x * 3, y: topleft.y * 3 });
    })


    this.redrawConnections();

    //redraw notes
    let notes = this.notes.getComponents();
    notes.forEach(el => {
      let topleft = el.topleft;
      (<NoteComponent>el).setPosition({ x: topleft.x * 3, y: topleft.y * 3 });
    })













  }





  // redrawAllSubdrafts() {
  //   const dns = this.tree.getDraftNodes();

  //   const startTime = performance.now();
  //   dns.forEach((dn, index) => {
  //     const flags: DraftNodeBroadcastFlags = {
  //       meta: false,
  //       draft: true,
  //       loom: false,
  //       loom_settings: false,
  //       materials: true
  //     };
  //     //SPOOFs the change detector to force a redrew
  //     this.tree.broadcastDraftNodeValueChange(dn.id, flags);
  //   })

  //   this.redrawConnections();

  // }
}