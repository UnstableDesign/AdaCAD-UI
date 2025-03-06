import { Component, ComponentFactoryResolver, EventEmitter, HostListener, OnInit, Output, ViewChild, ViewContainerRef, ViewRef } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { fromEvent, Subscription } from 'rxjs';
import { defaults } from '../../core/model/defaults';
import { Bounds, Draft, DraftNode, DraftNodeProxy, Interlacement, NodeComponentProxy, Note, Node, Point, Cell, OpNode, Operation, LoomSettings, Loom} from '../../core/model/datatypes';
import { copyDraft, getDraftName, initDraftWithParams, warps, wefts } from '../../core/model/drafts';
import utilInstance from '../../core/model/util';
import { DesignmodesService } from '../../core/provider/designmodes.service';
import { NotesService } from '../../core/provider/notes.service';
import { StateService } from '../../core/provider/state.service';
import { TreeService } from '../../core/provider/tree.service';
import { LayersService } from '../../mixer/provider/layers.service';
import { MultiselectService } from '../provider/multiselect.service';
import { ViewportService } from '../provider/viewport.service';
import { ZoomService } from '../../core/provider/zoom.service';
import { FileService } from './../../core/provider/file.service';
import { ConnectionComponent } from './connection/connection.component';
import { NoteComponent } from './note/note.component';
import { OperationComponent } from './operation/operation.component';
import { SnackbarComponent } from './snackbar/snackbar.component';
import { SubdraftComponent } from './subdraft/subdraft.component';
import { ViewerService } from '../../core/provider/viewer.service';
import { copyLoom, copyLoomSettings, getLoomUtilByType } from '../../core/model/looms';
import { OperationService } from '../../core/provider/operation.service';
import { MediaService } from '../../core/provider/media.service';

@Component({
  selector: 'app-palette',
  templateUrl: './palette.component.html',
  styleUrls: ['./palette.component.scss']
})


export class PaletteComponent implements OnInit{


  // @Output() onDesignModeChange: any = new EventEmitter();  
  @Output() onOpenInEditor: any = new EventEmitter();  

  /**
   * A container that supports the automatic generation and removal of the components inside of it
   */
  @ViewChild('vc', {read: ViewContainerRef, static: true}) vc: ViewContainerRef;

  subdraftSubscriptions: Array<Subscription> = [];
  operationSubscriptions: Array<Subscription> = [];
  connectionSubscriptions: Array<Subscription> = [];
  noteSubscriptions: Array<Subscription> = [];


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
   snack_message:string;

   snack_bounds: Bounds;

     /**
   * stores the bounds of the shape being drawn
   */
   active_connection:Bounds;

   /**
    * a reference to the base size of each cell. Zoom in and out only modifies the view, not this base size.
    */
   default_cell_size: number = 5;

   needs_init: boolean = true;

   visible_op: number = -1;

   visible_op_inlet: number = -1;


  
  constructor(
    public dm: DesignmodesService, 
    private ops: OperationService,
    private media: MediaService,
    private tree: TreeService,
    private layers: LayersService, 
    private resolver: ComponentFactoryResolver, 
    private fs: FileService,
    private _snackBar: MatSnackBar,
    public viewport: ViewportService,
    private notes: NotesService,
    private vs: ViewerService,
    private ss: StateService,
    private zs: ZoomService,
    private multiselect: MultiselectService) { 
    this.pointer_events = true;
  }

/**
 * Called when palette is initailized
 */
  ngOnInit(){
    this.vc.clear();
    this.default_cell_size = defaults.draft_detail_cell_size; 


    
  }

  /**
   * Gets references to view items and adds to them after the view is initialized
   */
   ngAfterViewInit(){

  }

  /**
   * unsubscribes to all open subscriptions and clears the view component
   */
  ngOnDestroy(){

    this.unsubscribeFromAll();
    this.vc.clear();
    
  }

  /**
   * the only way to prevent memory leaks is to unsubscribe.
   * since we lose access to tree when a new file is uploaded we must unsubscribe 
   * when any upload action is taking place. If no action takes place, then resubscribe
   */
  unsubscribeFromAll(){
    
    this.subdraftSubscriptions.forEach(element => element.unsubscribe());
    this.operationSubscriptions.forEach(element => element.unsubscribe());
    this.connectionSubscriptions.forEach(element => element.unsubscribe());
    this.noteSubscriptions.forEach(element => element.unsubscribe());
  }

  /**
   * resubscribes to each subscription
   */
  resubscribe(){

    this.tree.getDrafts().forEach(element => {
     this.setSubdraftSubscriptions(element);
    });


    this.tree.getOperations().forEach(element => {
      this.setOperationSubscriptions(element)
    });

    this.tree.getConnections().forEach(element => {
    });

    this.tree.getConnections().forEach(element => {
    });



  }

  /**
   * called when a new file is loaded
   */
   clearComponents(){
    this.unsubscribeFromAll();
    this.notes.getRefs().forEach(ref => this.removeFromViewContainer(ref));
    this.vc.clear();
  }

  
/**
 * called when user moves position within viewer
 * @param data 
 */
  handleScroll(position: Point){
    this.viewport.setTopLeft(position);
    const div:HTMLElement = document.getElementById('scrollable-container');  
     div.offsetParent.scrollLeft = this.viewport.getTopLeft().x;
     div.offsetParent.scrollTop = this.viewport.getTopLeft().y;
  }

/**
 * called when user moves position within viewer
 * @param data 
 */
handlePan(diff: Point){
  const div:HTMLElement = document.getElementById('scrollable-container');  
   div.offsetParent.scrollLeft += diff.x;
   div.offsetParent.scrollTop += diff.y;
}



  /**
 * when someone zooms in or out, we'd like to keep the center point the same. We do this by scaling the entire palette and 
 * elements and then manually scrolling to the new center point.
 * TODO, this may not be the case anymore with new scaling 
 * @param data 
 */
   handleScrollFromZoom(old_zoom: number){
    // this.viewport.setTopLeft(position);
    // console.log(old_center, this.viewport.getCenterPoint());
    const div:HTMLElement = document.getElementById('scrollable-container');  
    const past_scroll_x = div.offsetParent.scrollLeft / old_zoom;
    const new_scroll_x = past_scroll_x * this.zs.getMixerZoom();

    const past_scroll_y = div.offsetParent.scrollTop / old_zoom;
    const new_scroll_y = past_scroll_y * this.zs.getMixerZoom();

     div.offsetParent.scrollLeft = new_scroll_x;
     div.offsetParent.scrollTop = new_scroll_y;
  }


  
  /**
 * called when user scrolls the winidow
 * @param data 
 */
   handleWindowScroll(data: any){


   const div:HTMLElement = document.getElementById('scrollable-container');
   if(div === null || div === undefined || div.offsetParent == null ) return;
   this.viewport.set(div.offsetParent.scrollLeft, div.offsetParent.scrollTop,  div.offsetParent.clientWidth,  div.offsetParent.clientHeight);
    //update the canvas to this position
  }

  /**
   * removes the view associate with this view ref
   * @param ref 
   */
  removeFromViewContainer(ref: ViewRef){
    const ndx: number = this.vc.indexOf(ref);
    if(ndx !== -1) this.vc.remove(ndx);
    else console.log('Error: view ref not found for removal', ref);

  }

  /**
   * adds a state to the timeline. This should be called 
   * each time a user performs an action that they should be able to undo/redo
   */
  addTimelineState(){

   this.fs.saver.ada()
      .then(so => {
        this.ss.addMixerHistoryState(so);
      });
  }

  /**
   * this cycles through all subdrafts and calls the download call on any subdrafts
   * who are currently visible. 
   */
  async downloadVisibleDraftsAsBmp() : Promise<any>{


    const visible_drafts: Array<SubdraftComponent> = this.tree.getDraftNodes().filter(el => el.visible).map(el=> <SubdraftComponent> el.component);
    const functions: Array<Promise<any>> = visible_drafts.map(el => el.draftcontainer.saveAsBmp());
    return Promise.all(functions).then(el =>
      console.log("Downloaded "+functions.length+" files")
    );

  }
  
  /**
   * this cycles through all subdrafts and calls the download call on any subdrafts
   * who are currently visible. 
   */
   async downloadVisibleDraftsAsWif() : Promise<any>{

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
  addOperation(name:string) : number{
      
      const opcomp:OperationComponent = this.createOperation(name);
      this.performAndUpdateDownstream(opcomp.id).then(el => {
        let children = this.tree.getNonCxnOutputs(opcomp.id);
       
        if(children.length > 0) this.vs.setViewer(children[0])
      
        this.addTimelineState();
      });

      return opcomp.id;
      
  }

   /**
  //  * called anytime an operation is added. Adds the operation to the tree. 
  //  * @param name the name of the operation to add
  //  */
  pasteOperation(opnode:OpNode) : Promise<number>{
      
    const opcomp:OperationComponent = this.createOperation(opnode.name);

    const new_node = <OpNode> this.tree.getNode(opcomp.id);
    new_node.inlets = opnode.inlets.slice();
    new_node.params = opnode.params.slice();
    new_node.component.topleft = {x: opnode.component.topleft.x+100, y:opnode.component.topleft.y+100};

   
    return this.performAndUpdateDownstream(opcomp.id).then(el => {

      this.addTimelineState();
      return Promise.resolve(new_node.id);
    });
    
}

  centerView(){
    this.rescale();
  }



  /**
   * updates the view after a zoom event is called. Changes the scale of the palette scale container and 
   * scrolls such that the top left point when zoom is called remains the same after the zoom is updated
   * 
   * the position of the operation does not change, only the scale does. 
   */
  rescale(){

    const view_window:HTMLElement = document.getElementById('scrollable-container');
    const container:HTMLElement = document.getElementById('palette-scale-container');
    if(view_window === null || view_window === undefined) return;

    //let the top left point of the scroll, this is given in terms of palette scale container. 
    if(container === null) return;

    // //what % of the range is this point 
    let pcentX = view_window.scrollLeft / view_window.scrollWidth;
    let pcentY = view_window.scrollTop / view_window.scrollHeight;


    //transform to the top left 
    //container.style.transformOrigin = scrollLeft+"px "+scrollTop+"px"; //this goes to the center point
    container.style.transformOrigin = "top left"; //reset after moving as to not affect scrolling 
    container.style.transform = 'scale(' + this.zs.getMixerZoom() + ')'; 


    // move the scroll by the same % within the new div size
    let newScrollLeft =  view_window.scrollWidth * pcentX;
    let newScrollTop =  view_window.scrollWidth * pcentY;


    view_window.scroll({
      left: newScrollLeft,
      top: newScrollTop,
      behavior: "instant"
    });

    this.redrawConnections();
  }

  
  redrawConnections(){

    //this needs something more robust. 

    let cxn:Array<ConnectionComponent> = this.tree.getConnections().filter(el => el !== null);
    cxn.forEach(el => {
      el.updateFromPosition();
      let to = this.tree.getConnectionOutputWithIndex(el.id)
      el.updateToPosition(to.inlet, to.arr);
    })
    



    // const ops = this.tree.getOperations();
    // ops.forEach(el => {
    //   this.updateAttachedComponents(el.id, false);
    // })

  }

  
  /**
   * loads the snackbar at the bottom of the screen
   * @param message the message to show on the snack bar
   * @param bounds the bounds of the element that we are showing info aboout
   */
  startSnackBar(message: string, bounds:Bounds){
    this.updateSnackBar(message, bounds);
    this._snackBar.openFromComponent(SnackbarComponent, {
      data: {
        message: this.snack_message,
        bounds: this.snack_bounds,
        scale: this.zs.getMixerZoom()
      }
    });
  }

  snackBarAlert(message: string){
    this._snackBar.open(message, 'Undo', {
      duration: 3000
    });
  }

  /**
   * updates data shown on the snackbar
   * @param message 
   * @param bounds 
   */
  updateSnackBar(message: string, bounds:Bounds){

    this.snack_bounds = bounds;
    this.snack_message = message;
  }

  /**
   * called to close the snackbar
   */
  closeSnackBar(){
    this._snackBar.dismiss();
  }


  /**
   * called when a new subdraft is created
   * @param sd 
   */
  setSubdraftSubscriptions(sd: SubdraftComponent){
    this.subdraftSubscriptions.push(sd.onSubdraftDrop.subscribe(this.subdraftDropped.bind(this)));
    this.subdraftSubscriptions.push(sd.onSubdraftMove.subscribe(this.subdraftMoved.bind(this)));
    this.subdraftSubscriptions.push(sd.onSubdraftStart.subscribe(this.subdraftStarted.bind(this)));
    this.subdraftSubscriptions.push(sd.onDeleteCalled.subscribe(this.onDeleteSubdraftCalled.bind(this)));
    this.subdraftSubscriptions.push(sd.onDuplicateCalled.subscribe(this.onDuplicateSubdraftCalled.bind(this)));
    this.subdraftSubscriptions.push(sd.onConnectionStarted.subscribe(this.onConnectionStarted.bind(this)));
    this.subdraftSubscriptions.push(sd.onDesignAction.subscribe(this.onSubdraftAction.bind(this)));
    this.subdraftSubscriptions.push(sd.onSubdraftViewChange.subscribe(this.onSubdraftViewChange.bind(this)));
    this.subdraftSubscriptions.push(sd.onNameChange.subscribe(this.onSubdraftNameChange.bind(this)));
    this.subdraftSubscriptions.push(sd.onOpenInEditor.subscribe(this.openInEditor.bind(this)));
    this.subdraftSubscriptions.push(sd.onRedrawOutboundConnections.subscribe(this.redrawOutboundConnections.bind(this)));
  }

  openInEditor(id: number){
    this.onOpenInEditor.emit(id);
  }

  /**
   * dynamically creates a a note component
   * @returns the created note instance
   */
   createNote(note: Note):NoteComponent{
  
    let tl: Point = null;

    const factory = this.resolver.resolveComponentFactory(NoteComponent);
    const notecomp = this.vc.createComponent<NoteComponent>(factory);
    this.setNoteSubscriptions(notecomp.instance);

    if(note === null || note.topleft == null || note.topleft === undefined){
      tl =  this.calculateInitialLocation();
      ;
      tl = {
        x: tl.x, 
        y: tl.y
      }
    }else{
      tl = {
        x: note.topleft.x, 
        y: note.topleft.y
      }
    }
    let id = this.notes.createNote(tl,  notecomp.instance, notecomp.hostView, note);

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
  setNoteSubscriptions(note: NoteComponent){
    this.noteSubscriptions.push(note.deleteNote.subscribe(this.deleteNote.bind(this)));
    this.noteSubscriptions.push(note.saveNoteText.subscribe(this.saveNote.bind(this)));
  }

  deleteNote(id: number){
    const note = this.notes.get(id);
    if(note === undefined) return;
    this.removeFromViewContainer(note.ref);
    this.notes.delete(id);
  }

  saveNote(){
    this.addTimelineState();
  }



  /**
   * dynamically creates a subdraft component, adds its inputs and event listeners, pushes the subdraft to the list of references
   * @param d a Draft object for this component to contain
   * @returns the created subdraft instance
   */
  createSubDraft(d: Draft, loom: Loom, loom_settings: LoomSettings) : Promise<SubdraftComponent>{
    

    const factory = this.resolver.resolveComponentFactory(SubdraftComponent);
    const subdraft = this.vc.createComponent<SubdraftComponent>(factory);
    const id = this.tree.createNode('draft', subdraft.instance, subdraft.hostView);
    this.setSubdraftSubscriptions(subdraft.instance);
   
    subdraft.instance.id = id;
    subdraft.instance.draft = d;
    subdraft.instance.scale = this.zs.getMixerZoom();


    return this.tree.loadDraftData({prev_id: -1, cur_id: id}, d, loom, loom_settings, true, 1, true)
      .then(d => {
        return Promise.resolve(subdraft.instance);
        }
      )
  }

  createSubDraftFromEditedDetail(id: number) : Promise<SubdraftComponent>{
    
    const node  = this.tree.getNode(id);
    const factory = this.resolver.resolveComponentFactory(SubdraftComponent);
    const subdraft = this.vc.createComponent<SubdraftComponent>(factory);
    this.setSubdraftSubscriptions(subdraft.instance);

    node.component = subdraft.instance;
    node.ref = subdraft.hostView;

    subdraft.instance.id = id;
    subdraft.instance.draft = this.tree.getDraft(id);
    subdraft.instance.scale = this.zs.getMixerZoom();

    return Promise.resolve(subdraft.instance);

  }


  

  /**
   * loads a subdraft component from data
   * @param id the node id assigned to this element on load
   * @param d the draft object to load into this subdraft
   * @param nodep the component proxy used to define
   * TODO, this likely is not positioning correctly
   */
   loadSubDraft(id: number, d: Draft, nodep: NodeComponentProxy, draftp: DraftNodeProxy){


    const factory = this.resolver.resolveComponentFactory(SubdraftComponent);
    const subdraft = this.vc.createComponent<SubdraftComponent>(factory);
    const node = this.tree.getNode(id)
    node.component = subdraft.instance;
    node.ref = subdraft.hostView;
    this.setSubdraftSubscriptions(subdraft.instance);
    subdraft.instance.id = id;
    subdraft.instance.scale = this.zs.getMixerZoom();
    subdraft.instance.use_colors = true;
    subdraft.instance.draft = d;
    subdraft.instance.parent_id = this.tree.getSubdraftParent(id);

    if(nodep !== null && nodep.topleft !== null){
      const adj_topleft: Point = {x: nodep.topleft.x, y: nodep.topleft.y};
      
      subdraft.instance.topleft = adj_topleft;

      if(draftp !== null && draftp !== undefined && draftp.render_colors !== undefined){
        subdraft.instance.use_colors = draftp.render_colors;
      }
    } 

  }

  setConnectionSubscriptions(cxn: ConnectionComponent){
    this.connectionSubscriptions.push(cxn.onConnectionRemoved.subscribe(this.removeConnection.bind(this)));

  }

  /**
   * called when a new operation is added
   * @param op 
   */
  setOperationSubscriptions(op: OperationComponent){
    this.operationSubscriptions.push(op.onOperationMove.subscribe(this.operationMoved.bind(this)));
    this.operationSubscriptions.push(op.onOperationMoveEnded.subscribe(this.operationMoveEnded.bind(this)));
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
    this.operationSubscriptions.push(op.onRedrawOutboundConnections.subscribe(this.redrawOutboundConnections.bind(this)));

  }


  /**
   * creates an operation component
   * @param name the name of the operation this component will perform
   * @returns the OperationComponent created
   */
    createOperation(name: string):OperationComponent{
      const factory = this.resolver.resolveComponentFactory(OperationComponent);
      const op = this.vc.createComponent<OperationComponent>(factory);
      const id = this.tree.createNode('op', op.instance, op.hostView);




      this.tree.loadOpData({prev_id: -1, cur_id: id}, name, undefined, undefined);
      this.setOperationSubscriptions(op.instance);

      op.instance.name = name;
      op.instance.id = id;
      op.instance.zndx = this.layers.createLayer();
      op.instance.default_cell = this.default_cell_size;

      let tr = this.calculateInitialLocation();
      op.instance.topleft ={x: tr.x, y: tr.y};

     



      return op.instance;
    }

    /**
   * loads an operation with the information supplied. 
   * @param name the name of the operation this component will perform
   * @params params the input data to be used in this operation
   * @returns the id of the node this has been assigned to
   */
    loadOperation(id: number, name: string, params: Array<any>, inlets: Array<any>, topleft:Point){

        const factory = this.resolver.resolveComponentFactory(OperationComponent);
        const op = this.vc.createComponent<OperationComponent>(factory);
        const node = this.tree.getNode(id)
        node.component = op.instance;
        node.ref = op.hostView;
    
        this.setOperationSubscriptions(op.instance);
  
        op.instance.name = name;
        op.instance.id = id;
        op.instance.zndx = this.layers.createLayer();
        op.instance.default_cell = this.default_cell_size;
        op.instance.loaded_inputs = params;
        op.instance.topleft = {x: topleft.x, y: topleft.y};
        op.instance.loaded = true;
  

      }

   

    /**
     * duplicates an operation with the information supplied. 
     * @param name the name of the operation this component will perform
     * @params params the input data to be used in this operation
     * @returns the id of the node this has been assigned to
     */
     duplicateOperation(name: string, params: Array<number>, topleft:Point, inlets: Array<any>):number{



      const op:OperationComponent = this.createOperation(name);
      

          


          this.tree.setOpParams(op.id, params.slice(), inlets.slice());
          op.loaded_inputs = params.slice();
          op.topleft = {x: topleft.x, y: topleft.y};
          op.duplicated = true;
    
          return op.id;
      }



    /**
     * creates a connection and draws it to screen
     * @param id - the id of this node
     */
     loadConnection(id: number){
      const factory = this.resolver.resolveComponentFactory(ConnectionComponent);
      const cxn = this.vc.createComponent<ConnectionComponent>(factory);
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
     createConnection(id_from: number, id_to:number, to_ndx: number):{input_ids: Array<number>, id: number}{

      const factory = this.resolver.resolveComponentFactory(ConnectionComponent);
      const cxn = this.vc.createComponent<ConnectionComponent>(factory);
      const id = this.tree.createNode('cxn', cxn.instance, cxn.hostView);
      const to_input_ids: Array<number> =  this.tree.addConnection(id_from, 0, id_to, to_ndx, id);
      
      cxn.instance.id = id;
      cxn.instance.scale = this.zs.getMixerZoom();

      this.setConnectionSubscriptions(cxn.instance);


      this.connectionSubscriptions.push()
      return {input_ids: to_input_ids, id: id};
    }




  /**
   * called from upload or import events
   * @param d 
   */
  addSubdraftFromDraft(d: Draft){
    let ls = defaults.loom_settings;

    let util = getLoomUtilByType(ls.type);
    util.computeLoomFromDrawdown(d.drawdown,ls)
    .then(loom => {
      return this.createSubDraft(d, loom, ls)
    }).then(sd => {
      let tr = this.calculateInitialLocation();
      sd.topleft ={x: tr.x, y: tr.y};
      this.addTimelineState();
    });
    
  }

  /**
  //  * called anytime an operation is added. Adds the operation to the tree. 
  //  * @param name the name of the operation to add
  //  */
  pasteSubdraft(draftnode:DraftNode): Promise<number>{
    //create a new idea for this draft node: 

    
    let d = copyDraft(draftnode.draft);
    let l = copyLoom(draftnode.loom);
    let ls = copyLoomSettings(draftnode.loom_settings);
    d.id = utilInstance.generateId(8);


    return this.createSubDraft(d, l, ls).then(sd => {
      let tr = this.calculateInitialLocation();
      sd.topleft ={x: tr.x, y: tr.y};
      this.addTimelineState();
      return Promise.resolve(sd.id);
    });
    
}

  /**
   * removes the subdraft sent to the function
   * updates the tree view_id's in response
   * @param id {number}  

   */
  removeSubdraft(id: number){


    if(id === undefined) return;

    this.vs.checkOnDelete(id);

    // if(this.has_viewer_focus == id){
    //   this.has_viewer_focus = -1;
    //   this.revealDraftDetails(-1);

    // }

    // if(this.selected_draft_id == id){
    //   this.selected_draft_id = -1;
    //   this.revealDraftDetails(-1);
    // }

    const outputs = this.tree.getNonCxnOutputs(id);
    const delted_nodes = this.tree.removeSubdraftNode(id);

    delted_nodes.forEach(node => {
      this.removeFromViewContainer(node.ref);
      this.viewport.removeObj(node.id);
    })

    outputs.forEach(out => {
      this.performAndUpdateDownstream(out);
    })

  }

  /**
   * this calls the tree to delete the operation.
   * the tree returns a list of all nodes deleted and this function updates the view to remove those elements
   * @param id 
   */
  removeOperation(id:number){


    if(id === undefined) return;

    const op_node = this.tree.getOpNode(id);
    const op_base = this.ops.getOp(op_node.name);
    op_base.params.forEach((param, ndx) => {
      if(param.type == 'file'){
        //remove the media file associated 
        this.media.removeInstance(op_node.params[ndx].id)
      }
    })

    const drafts_out = this.tree.getNonCxnOutputs(id);
    drafts_out.forEach(id => this.vs.checkOnDelete(id));

    const outputs:Array<number> = drafts_out.reduce((acc, el) => {
      return acc.concat(this.tree.getNonCxnOutputs(el));
    }, []);


    //TODO Make sure this is actually returning all the removed nodes
    const delted_nodes = this.tree.removeOperationNode(id);
    delted_nodes.forEach(node => {
      if(node.type == 'draft') this.vs.checkOnDelete(id);
      this.removeFromViewContainer(node.ref);
      this.viewport.removeObj(node.id);
    });

    outputs.forEach(out => {
      this.performAndUpdateDownstream(out);
    })

  }




  /**
   * Called from mixer when it receives a change from the design mode tool or keyboard press
   * triggers view mode changes required for this mode
   */
  public designModeChanged(){

    if(this.dm.isSelectedMixerEditingMode('move')){
      this.unfreezePaletteObjects();

    }else{
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
   * draws the selection atop the view
   * todo: update this to account for scroll
   * @param ndx 
   */
  private drawSelection(ndx: Interlacement){

    // //instantiate the canvas at this point
    // this.cx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // const bounds ={
    //   left: this.selection.start.j*this.zs.zoom,
    //   top: this.selection.start.i*this.zs.zoom,
    //   right: ndx.j *this.zs.zoom,
    //   bottom: ndx.i*this.zs.zoom
    // };

    // //will draw on outside of selection
    // this.cx.beginPath();
    // this.cx.strokeStyle = "#ff4081";
    // this.cx.lineWidth = 1;
    // this.cx.setLineDash([this.zs.zoom, 2]);
    // this.cx.strokeRect(bounds.left - this.viewport.getTopLeft().x, bounds.top  - this.viewport.getTopLeft().y, bounds.right-bounds.left, bounds.bottom-bounds.top);
    // this.cx.fillStyle = "#ff4081";
    // this.cx.font = "12px Arial";
    // const w = Math.round(this.selection.bounds.width /this.zs.zoom);
    // const h = Math.round(this.selection.bounds.height / this.zs.zoom);
    // this.cx.fillText(w.toString()+"x"+h.toString(),  bounds.left- this.viewport.getTopLeft().x, bounds.bottom+16-this.viewport.getTopLeft().y);

  }


  /**
   * Deletes the subdraft that called this function.
   */
    onDeleteSubdraftCalled(obj: any){
      
      if(obj === null) return;
      this.removeSubdraft(obj.id);
      this.addTimelineState();
   }

     /**
   * Deletes the subdraft that called this function.
   */
      onDeleteOperationCalled(obj: any){
      
        if(obj === null) return;
        this.removeOperation(obj.id);
        this.addTimelineState();
     }

   /**
   *Duplicates the operation that called this function.
   */
    onDuplicateOpCalled(obj: any){
      if(obj === null) return;

      const op = this.tree.getOpNode(obj.id);
      const op_comp = <OperationComponent> this.tree.getComponent(obj.id);
      const operation: Operation = this.ops.getOp(op.name);


      let new_tl: Point = null;


      if(this.tree.hasSingleChild(obj.id)){
          new_tl = {x: op_comp.topleft.x + 200, y: op_comp.topleft.y}
      }else{
        let container = document.getElementById('scale-'+obj.id);
        new_tl =  {x: op_comp.topleft.x + 10 + container.offsetWidth*this.zs.getMixerZoom()/this.default_cell_size, y: op_comp.topleft.y}
      }

      let new_params = op.params.slice();
      //make sure to duplicate any media objects
      operation.params.forEach((param, i) => {
        if(param.type == 'file'){
          let old_media_id = op.params[i].id;
          let new_media_item = this.media.duplicateIndexedColorImageInstance(old_media_id);
          new_params[i] = {id: new_media_item.id, data: new_media_item.img}
        }
      })

   


      const id: number = this.duplicateOperation(op.name, new_params, new_tl, op.inlets);
      const new_op = <OperationComponent> this.tree.getComponent(id);

      //duplicate the connections as well
      const cxns = this.tree.getInputsWithNdx(op.id);
      cxns.forEach(cxn => {
        if(cxn.tn.inputs.length > 0){
        const from = cxn.tn.inputs[0].tn.node.id;
        this.createConnection(from, new_op.id, cxn.ndx);
        }
      })



      this.operationParamChanged({id: id, prior_inlet_vals:[]});
      this.addTimelineState();
 }

 /**
  This is called when the finetune mode is closed and we need to create a new subdraft to hold the changes. 
  * @param obj {parent_id, new_id}
  * @returns 
  */
  // createNewSubdraftFromEdits(obj: any){
  //   this.changeDesignmode('move')

  //   if(obj === null) return;

  //   const sd = <SubdraftComponent> this.tree.getComponent(obj.parent_id);
  //   const new_draft = this.tree.getDraft(obj.new_id);
  //   const new_loom = this.tree.getLoom(obj.new_id);
  //   const new_ls = this.tree.getLoomSettings(obj.new_id);
  //   const new_topleft = {
  //       x: sd.topleft.x + 40 + this.zs.zoom *2, 
  //       y: sd.topleft.y}

    


  //   this.loadSubDraft(
  //     obj.new_id, 
  //     new_draft, 
  //     {
  //       node_id: obj.new_id,
  //       type: 'draft',
  //       topleft: sd.topleft
  //     },
  //     {
  //       node_id: obj.new_id,
  //       draft_id: new_draft.id,
  //       draft_name: new_draft.ud_name,
  //       draft: new_draft,
  //       draft_visible: true,
  //       loom: new_loom,
  //       loom_settings:new_ls,
  //       render_colors: true
  //     },
  //     this.zs.zoom);
  //     this.addTimelineState();

   
  //  }


    onDuplicateSubdraftCalled(obj: any){
        if(obj === null) return;

        const sd_draft = <Draft> this.tree.getDraft(obj.id);
        const sd_loom = <Loom> this.tree.getLoom(obj.id);
        const sd_ls = <LoomSettings> this.tree.getLoomSettings(obj.id);
        
        let new_draft = initDraftWithParams(
          {wefts: wefts(sd_draft.drawdown), 
            warps: warps(sd_draft.drawdown), 
            drawdown: sd_draft.drawdown.slice(), 
            rowShuttleMapping: sd_draft.rowShuttleMapping.slice(),
            colShuttleMapping: sd_draft.colShuttleMapping.slice(),
            rowSystemMapping: sd_draft.rowSystemMapping.slice(),
            colSystemMapping: sd_draft.colSystemMapping.slice(),
            gen_name: getDraftName(sd_draft)+" copy"
          });
        
      
      let new_loom = copyLoom(sd_loom)
      let new_ls = copyLoomSettings(sd_ls)


      this.createSubDraft(new_draft, new_loom, new_ls)
        .then(new_sd => {

          const orig_size = document.getElementById('scale-'+obj.id);
          let tr = this.calculateInitialLocation();
          new_sd.topleft ={x: tr.x, y: tr.y};
          this.addTimelineState();
        }).catch(console.error);
       
   }

  /**
   * A mouse event, originated in a subdraft, has been started
   * checkes the design mode and handles the event as required
   * @param obj contains the id of the moving subdraft
   */
  subdraftStarted(obj: any){
    if(obj === null) return;

    if(this.dm.isSelectedMixerEditingMode("move")){
  
      //get the reference to the draft that's moving
      const moving = <SubdraftComponent> this.tree.getComponent(obj.id);
      
      if(moving === null) return; 

    }

 }

 /**
  * when the connection is started, this manually adjusts styling on the outlet component 
  * @param id 
  * @param active 
  */
 setOutletStylingOnConnection(id: number, active: boolean){
  if(id == -1) return;

  let sd_container = document.getElementById(id+'-out')
  if(active) sd_container.style.backgroundColor = "#ff4081";
  else{
    if(this.tree.getNonCxnOutputs(id).length > 0){
      sd_container.style.backgroundColor = "black";
      sd_container.style.color = "white";
    }    
    else{
      sd_container.style.backgroundColor = "white";
      sd_container.style.color="black";
    } 

  } 
 }

 /**
  * triggers a mode that allows mouse-mouse to be followed by a line.
  * todo; add code that holds the point on scroll
  * @param obj - contains event, id of component who called
  */
 onConnectionStarted(obj: any){
  if(obj.type == 'stop' || (this.tree.getOpenConnectionId() !== -1)){
    this.selecting_connection = false;
    this.setOutletStylingOnConnection(this.tree.getOpenConnectionId(), false);
    this.tree.unsetOpenConnection();
    this.processConnectionEnd();
    if(obj.type == 'stop') return;
  }



  const valid = this.tree.setOpenConnection(obj.id);
  if(!valid) return;

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
  let sd_container = document.getElementById(obj.id+'-out')
  let sd_rect = sd_container.getBoundingClientRect();

  this.setOutletStylingOnConnection(obj.id, true);

  const zoom_factor =  1 / this.zs.getMixerZoom();
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

  this.startSnackBar("select an input or click an empty space to stop selecting", null);

 }






 /**
 * adds a connector flag to any subdrafts that we are allowed to connect to from this operation
 */
  // setDraftsConnectable(op_id: number){
  //   const nodes: Array<SubdraftComponent> = this.tree.getDrafts();
  //   const op: OperationComponent = <OperationComponent> this.tree.getComponent(op_id);
  //   const inputs: Array<number> = this.tree.getInputs(op_id);
  //   if(inputs.length >= op.maxInputs()){
  //     nodes.forEach(el => {
  //       el.unsetConnectable();

  //       //now unset the ones that are already assigned to other ops
  //       const connections: Array<number> = this.tree.getNonCxnOutputs(el.id);
  //       const op_ndx: number = connections.findIndex(id => (id === op_id));
  //       //if it had connections and the connection was not this operation, unset it
  //       if(op_ndx !== -1){
  //         el.setConnectable();
  //       }    
  //     });
  //   }else{

  //     nodes.forEach(el => {

  //       //look upstream to see if this operation is linked in any way to this op
  //       const upstream: Array<number> = this.tree.getUpstreamOperations(el.id);
  //       const ndx: number = upstream.findIndex(i => i === op_id);
  //       if(ndx === -1) el.setConnectable();
  
  //       //now unset the ones that are already assigned to other ops
  //       const connections: Array<number> = this.tree.getOutputs(el.id);
  //       const ops: Array<number> = connections.map(cxn => this.tree.getConnectionOutput(cxn));
  //       const op_ndx: number = ops.findIndex(op => (op === op_id));
  //       //if it had connections and the connection was not this operation, unset it
  //       if(ops.length > 0 && op_ndx === -1){
  //         el.unsetConnectable();
  //       }    
  
  //     });
  //   }

  //   const ops: Array<OperationComponent> = this.tree.getOperations();
  //   ops.forEach(op => {
  //     if(op.id != op_id) op.active_connection = true;
  //   });
   
  //  }

    /**
 * disables selection and pointer events on all
 */
  // unsetDraftsConnectable(){
  //   const nodes: Array<SubdraftComponent> = this.tree.getDrafts();
  //   nodes.forEach(el => {
  //     el.unsetConnectable();
  //   });

  //   const ops: Array<OperationComponent> = this.tree.getOperations();
  //   ops.forEach(op => {
  //     op.active_connection = false;
  //   });

  //  }

/**
 * disables selection and pointer events on all
 */
 freezePaletteObjects(){
  const nodes: Array<any> = this.tree.getComponents();
  nodes.forEach(el => {
    el.disableDrag();
  });

  const notes: Array<any> = this.notes.getComponents();
  notes.forEach(el => {
    el.disableDrag();
  });
 }

 /**
 * unfreezes all palette objects (except connections)
 */
  unfreezePaletteObjects(){
    const nodes: Array<any> = this.tree.getComponents();
    nodes.forEach(el => {
      if(el != null){
        el.enableDrag();
      } 
    });

    const notes: Array<any> = this.notes.getComponents();
    notes.forEach(el => {
      el.enableDrag();
    });
   }
  

   /**
    * this is called when an subdraft updates its show/hide value
    */
   onSubdraftViewChange(id: number){

    this.updateAttachedComponents(id, false);

   }

      /**
    * this is called when an subdraft updates its show/hide value
    */
    onSubdraftNameChange(id: number){

      const outs = this.tree.getNonCxnOutputs(id);
      const to_perform = outs.map(el => this.performAndUpdateDownstream(el));
      return Promise.all(to_perform) 
      .then(el => 
        {
          this.addTimelineState(); 
        })
        .catch(console.error);;

       
    }
    


 /**
   * draws when a user is using the mouse to identify an input to a component
   * @param mouse the absolute position of the mouse on screen
   * @param shift boolean representing if shift is pressed as well 
   */
connectionDragged(mouse: Point){



  let parent = document.getElementById('scrollable-container');
  let rect_palette = parent.getBoundingClientRect();

  const zoom_factor = 1 / this.zs.getMixerZoom();

  //on screen position relative to palette
  let screenX = mouse.x-rect_palette.x+parent.scrollLeft; //position of mouse relative to the palette sidebar - takes scroll into account
  let scaledX = screenX * zoom_factor;

  //on screen position relative to palette
  let screenY = mouse.y-rect_palette.y+parent.scrollTop;
  let scaledY = screenY * zoom_factor;
  

  //get the mouse position relative to the view frame
  const adj: Point  = {
    x: scaledX,
    y: scaledY
  }


  //get the mouse position relative to the view frame
  this.active_connection.width =  (adj.x - this.active_connection.topleft.x);
  this.active_connection.height =  (adj.y - this.active_connection.topleft.y);

  const svg = document.getElementById('scratch_svg');
  svg.style.top = (this.active_connection.topleft.y)+"px";
  svg.style.left = (this.active_connection.topleft.x)+"px"

 
  svg.innerHTML = ' <path d="M 0 0 C 0 50,'
  +(this.active_connection.width)+' '
  +(this.active_connection.height-50)+', '
  +(this.active_connection.width)+' '
  +(this.active_connection.height)
  +'" fill="transparent" stroke="#ff4081"  stroke-dasharray="4 2"  stroke-width="2"/> ' ;

 

}


/**
 * resets the view when a connection event ends
 */
 processConnectionEnd(){
  this.closeSnackBar();
  this.selecting_connection = false;
  this.setOutletStylingOnConnection(this.tree.getOpenConnectionId(), false);
  const svg = document.getElementById('scratch_svg');
  svg.innerHTML = ' ' ;

  if(!this.tree.hasOpenConnection()) return;


  const sd: SubdraftComponent = this.tree.getOpenConnection();
  if(sd !== null) sd.connectionEnded();
  this.tree.unsetOpenConnection();

} 


/**
 * Optimized this to work with adding of operations
 * @returns 
 */
calculateInitialLocation() : Point {

  const container = document.getElementById('scrollable-container');
  const container_rect = container.getBoundingClientRect();

  let tl = {
    x: (container.scrollLeft  + container_rect.x) * 1/this.zs.getMixerZoom(),
    y: (container.scrollTop +  container_rect.y) * 1/this.zs.getMixerZoom(),
  }

  return tl;


}

/**
 * this is called from a operation or subdraft that has changed size. This means that it's connection needs to be redrawn such that 
 * it properly displays the from position on the connection
 * @param sd_id : the subdraft id associated with the change
 */
redrawOutboundConnections(sd_id: number){
  let connections = this.tree.getOutputs(sd_id);


  connections.forEach(cxn => {
    let comp = this.tree.getComponent(cxn);
    if(comp !== null){
      (<ConnectionComponent> comp).updateFromPosition();
    }
  }) 

}



/**
 * this calls a function for an operation to perform and then subsequently calls all children 
 * to recalculate. After each calculation, it redraws and or creates any new subdrafts
 * @param op_id 
 * @returns 
 */
performAndUpdateDownstream(op_id:number) : Promise<any>{


  this.tree.getOpNode(op_id).dirty = true;
  this.tree.getDownstreamOperations(op_id).forEach(el => this.tree.getNode(el).dirty = true);
  const all_ops = this.tree.getDownstreamOperations(op_id).concat(op_id);

  return this.tree.performGenerationOps([op_id])
  .then(draft_ids => {
    all_ops.forEach(op =>{
      let children = this.tree.getNonCxnOutputs(op);
      (<OperationComponent> this.tree.getComponent(op)).updateChildren(children);
    })
  });

}

/**
 * when a subdraft is closed, it has no operation to run before updaing downstream, instead it ONLY needs to update the downstream values
 * @param subdraft_id 
 */
updateDownstream(subdraft_id: number) {

  let out = this.tree.getNonCxnOutputs(subdraft_id);
  
  out.forEach(op_id => {
    this.tree.getOpNode(op_id).dirty = true;
    this.tree.getDownstreamOperations(op_id).forEach(el => this.tree.getNode(el).dirty = true);  
  })

 
  return this.tree.performGenerationOps(out)
  .then(draft_ids => {

    const fns = this.tree.getDraftNodes()
      .filter(el => el.component !== null && el.dirty)
      .map(el => (<SubdraftComponent> el.component).draftcontainer.drawDraft((<DraftNode>el).draft));



    //create any new subdrafts nodes
    const new_drafts = this.tree.getDraftNodes()
      .filter(el => el.component === null)
      .map(el => {
        //console.log("loading new subdraft", (<DraftNode>el).draft);
        return this.loadSubDraft(
          el.id, 
          (<DraftNode>el).draft, 
          {
            node_id: el.id,
            type: el.type,
            topleft:{x: 0, y: 0},
          }, null);
        });
      

        return  Promise.all([Promise.all(fns), Promise.all(new_drafts)]);
        
       
  }).then(el => {
    const loads =[];
    const new_cxns = this.tree.nodes.filter(el => el.type === 'cxn' && el.component === null);   
    new_cxns.forEach(cxn => {
      const from_node:Array<number> = this.tree.getInputs(cxn.id);
      const to_node:Array<number> = this.tree.getOutputs(cxn.id);
      if(from_node.length !== 1 || to_node.length !== 1) Promise.reject("connection has zero or more than one input or output");
      loads.push(this.loadConnection(cxn.id));
    })

    return Promise.all(loads);

    }
  );

}

 
/**
 * when an inlet is pressed on an operation, highlight all things contributed to this inlet
 * @param op_id 
 * @param inlet_id 
 * @param ndx_in_inlets - if there aremultiple inputs at a single inlet, give the number in that list
 */
highlightPathToInlet(op_id: number, inlet_id: number, ndx_in_inlets: number){

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

const upstream_cxn = upstream_drafts.reduce((acc, draft)=>{
  return acc.concat(this.tree.getOutputs(draft));
}, []); 



//  const upstream_drafts = this.tree.getUpstreamDrafts(op_id);
const op_children = this.tree.getNonCxnOutputs(op_id);

 const all_ops = this.tree.getOpNodes();
 all_ops.forEach(op => {
  if(upstream_ops.find(el => el === op.id) === undefined){
    if(op.id !== op_id){
      const div = document.getElementById("scale-"+op.id);
      if(div !== null) div.style.opacity = ".2";
    } 
  }
 })

 const all_drafts = this.tree.getDraftNodes();
 all_drafts.forEach(draft => {
  if(upstream_drafts.find(el => el === draft.id) === undefined){
    if(op_children.find(del => del === draft.id) === undefined){
      const div = document.getElementById("scale-"+draft.id);
      if(div !== null) div.style.opacity = ".2";
    } 
  }
 })

 const all_cxns = this.tree.getConnections();
 all_cxns.forEach(cxn => {
  if(upstream_cxn.find(el => el === cxn.id) === undefined){
    const div = document.getElementById("scale-"+cxn.id);
    if(div !== null) div.style.opacity = ".2";
  }else{
    cxn.show_path_text = true;
    cxn.drawConnection();
  }
 })

}

resetOpacity(){
  const ops = this.tree.getOpNodes();
  ops.forEach(op => {
    const div = document.getElementById("scale-"+op.id);
    if(div !== null) div.style.opacity = "1"
  });

  const drafts = this.tree.getDraftNodes();
  drafts.forEach(draft => {
    const div = document.getElementById("scale-"+draft.id);
    if(div !== null) div.style.opacity = "1"
  });

  const cxns = this.tree.getConnections();
  cxns.forEach(cxn => {
    const div = document.getElementById("scale-"+cxn.id);
    if(div !== null)  div.style.opacity = "1"
    cxn.show_path_text = false;
    cxn.drawConnection();

  });

  
}



/**
 * called from an operation or inlet to allow for the inlighting of all upstream operations and drafts
 * @param obj 
 */
updateVisibility(obj: any){
  {

    this.resetOpacity();
    if(obj.show == true){

      //unset any no longer selected inlets
      const ops:Array<OpNode> = this.tree.getOpNodes();
      const not_selected = ops.filter(el => el.id !== obj.id);


      not_selected.forEach((op, ndx) => {
        const inlets = op.inlets.map((val, ndx)=> ndx);
        (<OperationComponent>op.component).resetVisibliity(inlets);
      })

      let selected = ops.filter(el => el.id == obj.id);
      if(selected.length > 0){
        const inlets = selected[0].inlets.map((val, ndx)=> ndx).filter(el => el !== obj.ndx);
        (<OperationComponent>selected[0].component).resetVisibliity(inlets);
      }


      this.highlightPathToInlet(obj.id, obj.ndx, obj.ndx_in_inlets);


    }else{
      this.visible_op = -1;
      this.visible_op_inlet = -1;
    }

  } 
}

/**
 * called from an operation or inlet to allow for the inlighting of all upstream operations and drafts
 * @param obj 
 */
inletLoaded(obj: any){
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
opCompLoaded(obj: any){
  //redraw the inlet
  // let opid = obj.id;
  // const cxns = this.tree.getInputsWithNdx(opid);


}




/**
 * emitted from operation when it receives a hit on its connection button, the id refers to the operation id
 */
connectionMade(obj: any){


  if(!this.tree.hasOpenConnection()) return;


  //this is defined in the order that the line was drawn
  const op:OperationComponent = <OperationComponent>this.tree.getComponent(obj.id);
  const sd: number = this.tree.getOpenConnectionId();
  
  this.createConnection(sd, obj.id, obj.ndx);

  this.performAndUpdateDownstream(obj.id).then(el => {
    let children = this.tree.getNonCxnOutputs(obj.id);
    if(children.length > 0) this.vs.setViewer(children[0]);
    this.addTimelineState();
  });

  this.processConnectionEnd();

}

pasteConnection(from: number, to: number, inlet: number){

  this.createConnection(from, to, inlet);

  this.performAndUpdateDownstream(to).then(el => {
    this.addTimelineState();
  });

}

/**
 * Called when a connection is explicitly deleted
 * id refers to the id of the connection that is being deleted. 
*/
 removeConnection(obj: {id: number}){

  let to = this.tree.getConnectionOutput(obj.id);
  let from = this.tree.getConnectionInput(obj.id);

  const to_delete = this.tree.removeConnectionNodeById(obj.id);  
  to_delete.forEach(node => this.removeFromViewContainer(node.ref));

 
 // if(to_delete.length > 0) console.log("Error: Removing Connection triggered other deletions");

   this.processConnectionEnd();
   this.setOutletStylingOnConnection(from, false);

   if(this.tree.getType(to)==="op"){
     this.performAndUpdateDownstream(to).then(done => {
      this.vs.updateViewer();
    }); 
   }
  

  this.addTimelineState();


}

 

 panStarted(mouse_pos: Point){
  this.last_point = mouse_pos;
  this.freezePaletteObjects();

 }


 /**
 * brings the base canvas to view and begins to render the
 * @param mouse the absolute position of the mouse on screen
 */
// shapeStarted(mouse: Point){

//   const rel:Point = {
//     x: mouse.x - this.viewport.getTopLeft().x,
//     y: mouse.y - this.viewport.getTopLeft().y
//   }
  
//   this.shape_bounds = {
//     topleft: rel,
//     width: this.zs.zoom,
//     height: this.zs.zoom
//   };


//   this.shape_vtxs = [];
//   this.canvas_zndx = this.layers.createLayer(); //bring this canvas forward
//   this.cx.fillStyle = "#ff4081";
//   this.cx.fillRect( this.shape_bounds.topleft.x, this.shape_bounds.topleft.y, this.shape_bounds.width,this.shape_bounds.height);
  
//   if(this.dm.isSelected('free', 'shapes')){
//     this.startSnackBar("CTRL+Click to end drawing", this.shape_bounds);
//   }else{
//     this.startSnackBar("Press SHIFT while dragging to constrain shape", this.shape_bounds);
//   }
 

// }

  /**
   * resizes and redraws the shape between the the current mouse and where the shape started
   * @param mouse the absolute position of the mouse on screen
   */
// shapeDragged(mouse: Point, shift: boolean){

//   const rel:Point = {
//     x: mouse.x - this.viewport.getTopLeft().x,
//     y: mouse.y - this.viewport.getTopLeft().y
//   }

//   this.shape_bounds.width =  (rel.x - this.shape_bounds.topleft.x);
//   this.shape_bounds.height =  (rel.y - this.shape_bounds.topleft.y);

//   if(shift){
//     const max: number = Math.max(this.shape_bounds.width, this.shape_bounds.height);
    
//     //allow lines to snap to coords
//     if(this.dm.isSelected('line', 'shapes')){
//         if(Math.abs(this.shape_bounds.width) < Math.abs(this.shape_bounds.height/2)){
//           this.shape_bounds.height = max;
//           this.shape_bounds.width = this.zs.zoom;
//         }else if(Math.abs(this.shape_bounds.height) < Math.abs(this.shape_bounds.width/2)){
//           this.shape_bounds.width = max;
//           this.shape_bounds.height = this.zs.zoom;
//         }else{
//           this.shape_bounds.width = max;
//           this.shape_bounds.height = max;  
//         }
        
//     }else{
//       this.shape_bounds.width = max;
//       this.shape_bounds.height = max;    
  
//     }
//   }

//   this.cx.clearRect(0, 0, this.canvas.width, this.canvas.height);
//   this.cx.beginPath();
//   this.cx.fillStyle = "#ff4081";
//   this.cx.strokeStyle = "#ff4081";
//   this.cx.setLineDash([]);
//   this.cx.lineWidth = this.zs.zoom;

//   if(this.dm.isSelected('line', 'shapes')){
//     this.cx.moveTo(this.shape_bounds.topleft.x+this.zs.zoom, this.shape_bounds.topleft.y+this.zs.zoom);
//     this.cx.lineTo(this.shape_bounds.topleft.x + this.shape_bounds.width, this.shape_bounds.topleft.y + this.shape_bounds.height);
//     this.cx.stroke();
//   }else if(this.dm.isSelected('fill_circle','shapes')){
//     this.shape_bounds.width = Math.abs(this.shape_bounds.width);
//     this.shape_bounds.height = Math.abs(this.shape_bounds.height);
//     this.cx.ellipse(this.shape_bounds.topleft.x, this.shape_bounds.topleft.y, this.shape_bounds.width, this.shape_bounds.height, 2 * Math.PI, 0,  this.shape_bounds.height/2);
//     this.cx.fill();
//   }else if(this.dm.isSelected('stroke_circle','shapes')){
//     this.cx.ellipse(this.shape_bounds.topleft.x, this.shape_bounds.topleft.y, this.shape_bounds.width, this.shape_bounds.height, 2 * Math.PI, 0,  this.shape_bounds.height/2);
//     this.cx.stroke();
//   }else if(this.dm.isSelected('fill_rect','shapes')){
//     this.cx.fillRect(this.shape_bounds.topleft.x, this.shape_bounds.topleft.y,this.shape_bounds.width,this.shape_bounds.height);
  
//   }else if(this.dm.isSelected('stroke_rect','shapes')){
//     this.cx.strokeRect(this.shape_bounds.topleft.x + this.zs.zoom, this.shape_bounds.topleft.y+ this.zs.zoom,this.shape_bounds.width-this.zs.zoom,this.shape_bounds.height-this.zs.zoom);

//   }else{

//     if(this.shape_vtxs.length > 1){
//       this.cx.moveTo(this.shape_vtxs[0].x, this.shape_vtxs[0].y);

//       for(let i = 1; i < this.shape_vtxs.length; i++){
//         this.cx.lineTo(this.shape_vtxs[i].x, this.shape_vtxs[i].y);
//         //this.cx.moveTo(this.shape_vtxs[i].x, this.shape_vtxs[i].y);
//       }

//     }else{
//       this.cx.moveTo(this.shape_bounds.topleft.x, this.shape_bounds.topleft.y);
//     }

//     this.cx.lineTo(this.shape_bounds.topleft.x + this.shape_bounds.width, this.shape_bounds.topleft.y + this.shape_bounds.height);
//     this.cx.stroke();
//     this.cx.fill();
    
//   }

// }


/**
 * clears the scratchpad for the new drawing event
 */
// drawStarted(){


//   this.canvas_zndx = this.layers.createLayer(); //bring this canvas forward
  
//   this.scratch_pad = [];
//   for(let i = 0; i < this.canvas.height; i+=this.zs.zoom ){
//       const row = [];
//       for(let j = 0; j< this.canvas.width; j+=this.zs.zoom ){
//           row.push(createCell(null));
//       }
//     this.scratch_pad.push(row);
//     }

//     this.startSnackBar("Drag to Draw", null);
//   }



  /**
   * update the viewport when the window is resized
   * @param event 
   */
  // @HostListener('window:resize', ['$event'])
  //   onResize(event) {

  //     this.viewport.setWidth(event.target.innerWidth);
  //     this.viewport.setHeight(event.target.innerHeight);

  //   }


 /**
  * handles actions to take when the mouse is down inside of the palette
  * @param event the mousedown event
  */
  @HostListener('mousedown', ['$event'])
    private onStart(event) {

      if(this.selecting_connection == true){
        this.processConnectionEnd();
      }

      if(this.needs_init){
      //this is a hack to update the screen posiitons because not all inforamtion is ready when onload and onview init completes
        let ops = this.tree.getOpNodes();
        ops.forEach(op => {
          this.opCompLoaded(op);
  
          // let drafts = this.tree.getDraftOutputs(op.id);
          // drafts.forEach((draft, ndx) => {
          //   let draftcomp = <SubdraftComponent> this.tree.getComponent(draft);
          //   draftcomp.updatePositionFromParent(<OperationComponent>op.component, ndx)
          // })
  
          }
        );
        this.needs_init = false;
      }

  

  
      this.removeSubscription();    
      
     

      if(this.dm.isSelectedMixerEditingMode("move")){

       if(event.shiftKey) return;
        this.multiselect.clearSelections();

      }else if(this.dm.isSelectedMixerEditingMode("pan")){

        this.panStarted({x: event.clientX, y: event.clientY});
        this.moveSubscription = 
        fromEvent(event.target, 'mousemove').subscribe(e => this.onDrag(e)); 

      }
  }


  @HostListener('mousemove', ['$event'])
  private onMove(event) {

    const mouse:Point = {
      x: event.clientX, 
      y: event.clientY
    };

    if(this.selecting_connection){
      this.connectionDragged(mouse);
    }
  }
  

  /**
   * called form the subscription created on start, checks the index of the location and returns null if its the same
   * @param event the event object
   */
  onDrag(event){


    const mouse: Point = {x: this.viewport.getTopLeft().x + event.clientX, y:this.viewport.getTopLeft().y+event.clientY};

    if(this.dm.isSelectedMixerEditingMode("pan")){
      
      const diff = {
        x:  (this.last_point.x-event.clientX), 
        y: (this.last_point.y-event.clientY)}

      this.handlePan(diff);

    }
    this.last_point = {x: event.clientX, y: event.clientY};
  }

  

/**
 * Called when the mouse is up or leaves the boundary of the view
 * @param event 
 * @returns 
 */
  @HostListener('mouseleave', ['$event'])
  @HostListener('mouseup', ['$event'])
     private onEnd(event) {


      this.removeSubscription();   

      if(this.dm.isSelectedMixerEditingMode('pan')){
        const div:HTMLElement = document.getElementById('scrollable-container');
        this.viewport.set(div.offsetParent.scrollLeft, div.offsetParent.scrollTop,  div.offsetParent.clientWidth,  div.offsetParent.clientHeight);

      }



      //unset vars that would have been created on press
      this.last_point = undefined;
  }
  
 

  /**
   * this function will update any components that should move when the compoment passed by obj moves
   * moves all compoments returned from tree.getNodesToUpdate(). All changes to what updates should be 
   * handled by getNodesToUpdateOnMove
   * @param obj 
   */
  updateAttachedComponents(id: number, follow: boolean){

    //start by moving the original object than ripple out;
    const moving : any = this.tree.getComponent(id);

    this.tree.getInputs(id).forEach(cxn => {
       const comp: ConnectionComponent = <ConnectionComponent>this.tree.getComponent(cxn);
       if(comp !== null){
        const tuple = this.tree.getConnectionOutputWithIndex(cxn);
        comp.updateToPosition(tuple.inlet, tuple.arr);
       } 
    });

    this.tree.getOutputs(id).forEach(cxn => {
      const comp: ConnectionComponent = <ConnectionComponent>this.tree.getComponent(cxn);
      if(comp !== null) comp.updateFromPosition();
   });

   if(!follow) return;

   const outs: Array<number> = this.tree.getNonCxnOutputs(id);

   //if this an operation with one child, move the child. 
   if(this.tree.getType(moving.id) === "op" ){

      outs.forEach((out, ndx) => {
        //const out_comp = <SubdraftComponent> this.tree.getComponent(out);
       // if(this.tree.getType(out_comp.id) === 'draft') out_comp.updatePositionFromParent(moving, ndx);
        this.updateAttachedComponents(out, false);
      })

    
    }

    const ins = this.tree.getNonCxnInputs(id);
    //if this is a draft with a parent, move the parent as well 
    if(this.tree.getType(moving.id) === "draft" && !this.tree.isSibling(moving.id)){
      ins.forEach(input => {
       // in_comp.updatePositionFromChild(moving);
        this.updateAttachedComponents(input, false);
      });
    }
      
   
  }


  /**
   * emitted from a subdraft when an internal action has changeded its value 
   * checks for a child subdraft, recomputes, redraws. 
   * @param obj with attribute id describing the subdraft that called this
   * @returns 
   */
  onSubdraftAction(obj: any){

    if(obj === null) return;

    const outputs = this.tree.getNonCxnOutputs(obj.id);
    const fns = outputs.map(out => this.performAndUpdateDownstream(out));
    Promise.all(fns).then(el => {
      this.addTimelineState();
    })



  }

  /**
   * emitted from an operation when its param has changed. This is automatically called on load 
   * which is annoying because it recomputes everything!
   * checks for a child subdraft, recomputes, redraws. 
   * @param obj with attribute id describing the operation that called this
   * @returns 
   */
   async operationParamChanged(obj: {id: number, prior_inlet_vals: Array<any>}){
    console.log("OPERATION PARAM CHANGED")

    if(obj === null) return;

    console.log("SWEEP INLETS")
    return this.tree.sweepInlets(obj.id, obj.prior_inlet_vals)
      .then(viewRefs => {
        viewRefs.forEach(el => {
          this.removeFromViewContainer(el)
        });
        return this.performAndUpdateDownstream(obj.id)
      } )
      .then(el => {
        return this.tree.sweepOutlets(obj.id)
      })
      .then(viewRefs => {
        viewRefs.forEach(el => {
          this.removeFromViewContainer(el)
        });

        //update the to positions coming out of this 
        let inputs = this.tree.getInputs(obj.id);

        inputs.forEach(input_cxn => {
          let comp = this.tree.getComponent(input_cxn);
          const tuple = this.tree.getConnectionOutputWithIndex(input_cxn);
          if(comp !== null) (<ConnectionComponent> comp).updateToPosition(tuple.inlet, tuple.arr);
        })

        this.addTimelineState();
        this.vs.updateViewer();
      })
      .catch(console.error);
   
    

  }

  paletteClicked(){
  }

/**
 * called from an operation component when it is dragged
 * @param obj (id, point of toplleft)
 */
  operationMoved(obj: any){
    if(obj === null) return;
  
    this.updateAttachedComponents(obj.id, true);
    this.moveAllSelections(obj.id);


  }

  /**
 * called from an operation component when it is done moving 
 * this allows us to not write postioin continuously, but just once on end
 * @param obj (id, point of toplleft)
 */
   operationMoveEnded(obj: any){
    if(obj === null) return;

    this.updateSelectionPositions(obj.id);

    this.addTimelineState();

  }

  updateSelectionPositions(moving_id: number){
    const selections = this.multiselect.getSelections();
    selections.forEach(sel => {
      if(this.tree.getType(sel) != 'cxn' && sel !== moving_id){
        const comp = this.tree.getComponent(sel);
        this.multiselect.setPosition(sel, comp.topleft)
      }

     
    })

  }

  /**
   * this is called when a multi-selected block of items is moved. 
   * Sometimes its called if you paste one set of items to a new space, in which case the nodes do
   * not yet exist. 
   * @param moving_id 
   * @returns 
   */
  moveAllSelections(moving_id: number){
    const selections = this.multiselect.getSelections();
    if(selections.length == 0) return;

    const rel_pos = this.multiselect.getRelativePosition();
    const cur_pos = this.tree.getComponent(moving_id).topleft;
    const diff:Point = {x: cur_pos.x - rel_pos.x, y: cur_pos.y - rel_pos.y};

    selections.forEach(sel => {
      if(this.tree.getNode(sel) == null) return;

      if(this.tree.getType(sel) == 'op' && sel !== moving_id){
        const comp = this.tree.getComponent(sel);
       (<OperationComponent>comp).setPosition(this.multiselect.getNewPosition(sel, diff))
        this.updateAttachedComponents(sel, true);
      }
      if(this.tree.getType(sel)=='draft' && sel !== moving_id){
        const comp = <SubdraftComponent> this.tree.getComponent(sel);
        if(comp.parent_id == -1) comp.setPosition( this.multiselect.getNewPosition(sel, diff));
      }
    });
  }




  /**
   * called when subdraft component says its moving
   * @param obj the subdraft that called this
   * @returns 
   */
  subdraftMoved(obj: any){

      if(obj === null) return;
  
      //get the reference to the draft that's moving
      const moving = <SubdraftComponent> this.tree.getComponent(obj.id);
      
      if(moving === null) return; 

      this.moveAllSelections(obj.id);
      this.updateAttachedComponents(moving.id, true);

    }


   /**
    * checks if this subdraft has been dropped onto of another and merges them accordingly 
    * @param obj 
    * @returns 
    */
  subdraftDropped(obj: any){

    this.closeSnackBar();

    if(obj === null) return;
    this.updateSelectionPositions(obj.id);

    this.addTimelineState();

  }


  getClosestToTopLeft(topleft: Point, rect_list: Array<any>): any{
    return rect_list
    .map(el => {return {id: el.id, rect: el.rect, dist: Math.pow(topleft.y - el.rect.top, 2) + Math.pow(topleft.x - el.rect.left, 2)}})
    .reduce( (acc, el) => {
      if(acc == null || el.dist < acc.dist) return el;
      return acc;
    }, null);
  }

  /**
   * reposition all of the drafts and operations on screen such that none of them overlap. 
   */
  explode(){

    //get each element as a dom rect
    let rect_list = this.tree.nodes
    .filter(el => (el !== null && el.type !== 'cxn'))
    .map(el => {return {dom: document.getElementById('scale-'+el.id), id: el.id}})
    .filter(el => el.dom !== undefined && el.dom !== null);
    
    rect_list.forEach(el => {
      let comp = this.tree.getComponent(el.id);
      let topleft = comp.topleft;
      (<SubdraftComponent | OperationComponent> comp).setPosition({x: topleft.x * 3, y: topleft.y * 3});
    })


    this.redrawConnections();

    //redraw notes
    let notes =  this.notes.getComponents();
    notes.forEach(el => {
      let topleft = el.topleft;
      (<NoteComponent> el).setPosition({x: topleft.x * 3, y: topleft.y * 3});
    })



    // //get average width and average height 
    // const width_sum = rect_list
    // .map(el => el.rect.width)
    // .reduce((acc, el) => {
    //   return acc + el;
    // }, 0);

    // const avg_width = width_sum / rect_list.length;

    // //get average width and average height 
    // const height_sum = rect_list
    // .map(el => el.rect.height)
    // .reduce((acc, el) => {
    //   return acc + el;
    // }, 0);

    // const avg_height = height_sum / rect_list.length;

    // const pallete_rect = document.getElementById('palette-scale-container').getBoundingClientRect();
    // const plot_units_w = Math.floor(pallete_rect.width / (avg_width+20));
    // const plot_units_h = Math.floor(pallete_rect.height / (avg_height+20));
    // const unit_w = pallete_rect.width / plot_units_w;
    // const unit_h = pallete_rect.height / plot_units_h;

    // if(plot_units_h * plot_units_h < rect_list.length) console.error("there are more elements than space available on the screen")
    // //create a 2D array of all the spaces for which an element can sit, mark "-1" meaning that nothing is sitting there. later that will be replaced with an id for the element in that position
    // const plots:Array<Array<number>> = [];
    // for(let i = 0; i < plot_units_w; i++){
    //   plots.push([])
    //   for(let j = 0; j < plot_units_h; j++){
    //     plots[i].push(-1)
    //   }
    // }



    // //work through the plots and assign the closest operation to the spot (this will )
    // for(let i = 0; i < plots.length; i++){
    //   for(let j = 0; j < plots[0].length; j++){
    //     let topleft: Point = {x: pallete_rect.left + j*unit_w, y: pallete_rect.top + i*unit_h};
    //     const closest = this.getClosestToTopLeft(topleft, rect_list);
    //     if(closest !== null ){
    //       rect_list = rect_list.filter(el => el.id !== closest.id);
    //       plots[i][j] = closest.id;
    //       let comp = this.tree.getComponent(closest.id);
    //       (<SubdraftComponent | OperationComponent> comp).setPosition(topleft);
    //     }
    //   }
    // }

    // console.log("PLOTS ", plots)






  






  }


      /**
       * TODO: Update this to get bounds and print all items, not just what's visible
       * @param obj 
       * @returns 
       */
  // getPrintableCanvas(obj): HTMLCanvasElement{

  //   this.cx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  //   const drafts: Array<SubdraftComponent> = this.tree.getDrafts();
  //   drafts.forEach(sd => {
  //     sd.drawForPrint(this.canvas, this.cx, this.zs.zoom);
  //   });

  //   const ops: Array<OperationComponent> = this.tree.getOperations();
  //   ops.forEach(op => {
  //     op.drawForPrint(this.canvas, this.cx, this.zs.zoom);
  //   });

  //   const cxns: Array<ConnectionComponent> = this.tree.getConnections();
  //   cxns.forEach(cxn => {
  //     cxn.drawForPrint(this.canvas, this.cx, this.zs.zoom);
  //   });

  //   // this.note_components.forEach(note =>{
  //   //   note.drawForPrint(this.canvas, this.cx, this.scale);
  //   // })

  //   return this.canvas;

  // }



  // redrawOpenModals(){
  //   const comps = this.tree.getDrafts();
  //   comps.forEach(sd => {
  //     if(sd.modal !== undefined && sd.modal.componentInstance !== null){
  //       sd.modal.componentInstance.redraw();
  //     }
  //   })
  // }
    
  redrawAllSubdrafts(){
      const dns = this.tree.getDraftNodes();
      dns.forEach(dn => {
        if(dn !== null && dn.component !== null){
          (<SubdraftComponent>dn.component).redrawExistingDraft();
        }else{
          let parent = this.tree.getSubdraftParent(dn.id);
          let comp = this.tree.getComponent(parent);
          if(comp !== null){
            (<OperationComponent> comp).redrawchildren++;
          }
          
        }
      })


      this.redrawConnections();

    }
  }