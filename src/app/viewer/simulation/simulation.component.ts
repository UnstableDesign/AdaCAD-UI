import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { TreeService } from '../../core/provider/tree.service';
import { SimulationService } from '../../core/provider/simulation.service';
import { Bounds, Draft, Interlacement, LoomSettings, SimulationData } from '../../core/model/datatypes';
import * as THREE from 'three';
import { convertEPItoMM } from '../../core/model/looms';
import { MaterialsService } from '../../core/provider/materials.service';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { cropDraft, warps, wefts } from '../../core/model/drafts';

@Component({
  selector: 'app-simulation',
  templateUrl: './simulation.component.html',
  styleUrls: ['./simulation.component.scss']
})
export class SimulationComponent implements OnInit {
  
  @Input('id') id;
  @Input('new_draft_flag$') new_draft_flag$;
  @Output() onExpanded = new EventEmitter();

  renderer;
  scene;
  camera;
  controls;
  sim_expanded: boolean = false;
  layer_spacing: number = 10;
  layer_threshold: number = 1;
  warp_threshold: number = 10;
  max_interlacement_width: number = 10;
  max_interlacement_height: number = 10;
  showing_warp_layer_map: boolean = false;
  showing_weft_layer_map: boolean = false;
  showing_warps: boolean = true;
  showing_wefts: boolean = true;
  showing_topo: boolean = false;
  showing_draft: boolean = false;
  boundary: number = 10;
  radius: number = 40;
  current_simdata: SimulationData = null;
  tanFOV: number = 0;
  originalHeight: number = 0; 
  dirty: boolean; //flags the need to recompute 
  selection_bounds: Bounds = null;
  render_size_error: boolean = false;

  constructor(
    private tree: TreeService, 
    public ms: MaterialsService,  
    public simulation: SimulationService) {




  }


  // @HostListener('window:resize', ['$event'])
  // onResize(event) {
    
  //   this.onWindowResize();
  // }

  ngOnInit(): void {

    
  }



  ngAfterViewInit(){
    
    const parent_div = document.getElementById('static_draft_view');
    const parent_rect = parent_div.getBoundingClientRect();

    const div = document.getElementById('simulation_container');
    // console.log("size ", parent_rect.width, parent_rect.height)

    let width = parent_rect.width;
    let height = parent_rect.height;


    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize( width, height );
    div.appendChild( this.renderer.domElement );


    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color( 0xf0f0f0 );

    this.camera = new THREE.PerspectiveCamera( 30, width / height, 1, 5000 );


    this.camera.position.set(0, 0, 500); 
    this.camera.lookAt( this.scene.position );
    this.scene.add(this.camera);

     this.controls = new OrbitControls( this.camera, this.renderer.domElement );


    this.tanFOV = Math.tan( ( ( Math.PI / 180 ) * this.camera.fov / 2 ) );
    this.originalHeight = height;

    this.renderer.render(this.scene, this.camera);


  }

  calcDefaultLayerSpacing(draft: Draft){

    let max_weft = draft.rowShuttleMapping.reduce((acc, val) => {
      let diam = this.ms.getDiameter(val);
      if(diam > acc) return diam;
      return acc;
    }, 0);

    let max_warp = draft.colShuttleMapping.reduce((acc, val) => {
      let diam = this.ms.getDiameter(val);
      if(diam > acc) return diam;
      return acc;
    }, 0);

    return (max_weft/2 + max_warp/2) * 10;

  }




  setDirty(){
    this.dirty = true;
  }

  unsetDirty(){
    this.dirty = false;
  }


  endSimulation(){
    this.simulation.endSimulation(this.scene);
  }


  loadNewDraft(id) : Promise<any>{

    const draft = this.tree.getDraft(id);
    const loom_settings = this.tree.getLoomSettings(id);

    this.layer_spacing = this.calcDefaultLayerSpacing(draft);
    this.simulation.setupSimulation(this.renderer, this.scene, this.camera, this.controls);
    this.resetSelectionBounds(draft);
    this.recalcAndRenderSimData(draft, loom_settings, this.selection_bounds);
    return Promise.resolve('done')
  
  }

  /**
   * this passes new information to a current rendering, updating which portion of the data we are visualizing. 
   * @param draft 
   * @param loom_settings 
   * @param start 
   * @param end 
   */
  updateSelection(start: Interlacement, end: Interlacement){
    console.log("UPDATE SELECTION CALLED", start, end)

    console.log("UPDATE SELECTION ", start, end)

    let width = end.j - start.j;
    if(width <= 0) return;

    let height = end.i - start.i;
    if(height <= 0) return;



    //recalc if this was currently too large to render or if we are making a new selection within an existing  
    if(this.current_simdata == null || this.render_size_error){

      let draft = this.tree.getDraft(this.id);
      let loom_settings = this.tree.getLoomSettings(this.id);
      let crop = cropDraft(draft, start.i, start.j, width, height);
   
      //since we trimmed the draft, the selection is now the entire trimmed draft
      this.selection_bounds  = {
        topleft: {x: this.boundary, y: this.boundary},
        width, height
      }
      this.recalcAndRenderSimData(crop, loom_settings,  this.selection_bounds);

    }else{

      this.selection_bounds  = {
        topleft: {x: start.j+this.boundary, y: start.i+this.boundary},
        width, height
      }
  
      console.log("RENDERING UPDATED DATA ", this.selection_bounds)
      this.simulation.renderSimdata(this.scene, this.selection_bounds, this.current_simdata, this.showing_warps, this.showing_wefts, this.showing_warp_layer_map, this.showing_weft_layer_map, this.showing_topo, this.showing_draft);

    }

  }


  resetSelectionBounds(draft: Draft){
    if(draft == null) draft = this.tree.getDraft(this.id);
    this.selection_bounds = {
      topleft: {x: this.boundary, y: this.boundary},
      width: warps(draft.drawdown),
      height: wefts(draft.drawdown)
    }
  }

  /**
   * returns the simdata bounds to the size of the entire draft stored at this ID
   */
  unsetSelection(){

    this.resetSelectionBounds(null);
    this.simulation.renderSimdata(this.scene, this.selection_bounds, this.current_simdata, this.showing_warps, this.showing_wefts, this.showing_warp_layer_map, this.showing_weft_layer_map, this.showing_topo, this.showing_draft);
  }

  /**
   * call this when the simulation needs to be updated due to a structural change. 
   * This will recalculate all the simulation data and then redraw it to screen. 
   * @param draft 
   * @param loom_settings 
   */
  updateSimulation(draft: Draft, loom_settings: LoomSettings){
    

    if(!this.dirty) return; //only recalc and redraw when there is a change that requires it. 
    this.recalcAndRenderSimData(draft, loom_settings, this.selection_bounds);

  }

  // changeLayerThreshold(){
  //   this.recalcAndRenderSimData();
  // }

  snapToX(){
    this.simulation.snapToX(this.controls);
  }

  toggleWefts(){
    if(!this.showing_wefts) this.simulation.showWefts();
    else this.simulation.hideWefts();
  }

  toggleDraft(){
    if(!this.showing_draft) this.simulation.showDraft();
    else this.simulation.hideDraft();
  }

  toggleWarps(){
    if(!this.showing_warps) this.simulation.showWarps();
    else this.simulation.hideWarps();
  }


  toggleTopo(){
    if(!this.showing_topo) this.simulation.showTopo();
    else this.simulation.hideTopo();
  }

  toggleWeftLayerView(){
    if(!this.showing_weft_layer_map) this.simulation.showWeftLayerMap();
    else this.simulation.hideWeftLayerMap();
  }

  toggleWarpLayerView(){
    if(!this.showing_warp_layer_map) this.simulation.showWarpLayerMap();
    else this.simulation.hideWarpLayerMap();
  }


  changeRadius(e: any){
    let draft = this.tree.getDraft(this.id);
    let loom_settings = this.tree.getLoomSettings(this.id);
    this.recalcAndRenderSimData(draft, loom_settings, this.selection_bounds);
  }


  // changeLayerSpacing(e: any){

  //   this.simulation.redrawCurrentSim(this.scene, this.draft)
  // }


  //this will update the colors on the current sim without recomputing the layer maps
  redrawCurrentSim(){
    let draft = this.tree.getDraft(this.id);
    this.simulation.redrawCurrentSim(this.scene, draft)

  }

  /**
   * recomputes the simulation data for a given draft and selection (e.g. if will only compute the selection if there is one). Loom settings is passed to speak for the EPI. 
   * @param draft 
   * @param loom_settings 
   * @param selection the bounds of the selection or null if no selection has been made. 
   */
  recalcAndRenderSimData(draft: Draft, loom_settings: LoomSettings, selection: Bounds){

    this.simulation.recalcSimData(
      this.scene, 
      draft, 
      convertEPItoMM(loom_settings), 
      this.layer_spacing, 
      this.layer_threshold, 
      this.max_interlacement_width, 
      this.max_interlacement_height,
      this.boundary,
      this.radius,
      this.ms
      )
    .then(simdata => {
      document.getElementById('sizeerror').style.display = "none"
      document.getElementById('simulation_container').style.display = "flex";
      this.render_size_error = false;
      this.current_simdata = simdata;
      this.simulation.renderSimdata(this.scene, selection,  simdata, this.showing_warps, this.showing_wefts, this.showing_warp_layer_map, this.showing_weft_layer_map,this.showing_topo, this.showing_draft);
    }).catch(err => {
      console.error("Gen Sim Data Returned Error", err);
      this.current_simdata = null;
      this.render_size_error = true;
      document.getElementById('sizeerror').style.display = "block"
      document.getElementById('simulation_container').style.display = "none"
    })
  



  }


  // changeILaceWidth(){
  //   this.recalcAndRenderSimData();
  // }

  // changeILaceHeight(){
  //   this.recalcAndRenderSimData(draft);

  // }


  pageClose(){
    this.simulation.endSimulation(this.scene);
  }

  expandSimulation(){

    console.log("EXPAND")
   
    this.onExpanded.emit();
    this.sim_expanded = !this.sim_expanded;
    this.onWindowResize();
  
  }

  /**
   * this gets called even if its not open!
   */
  onWindowResize() {
    console.log("ON RESIZE")
    let width;

    if(this.sim_expanded)   width = 2*window.innerWidth/3;
    else width = window.innerWidth/3;

    let height = window.innerHeight;

    this.camera.aspect = width / height;
    
    // adjust the FOV
    this.camera.fov = ( 360 / Math.PI ) * Math.atan( this.tanFOV * ( height / this.originalHeight ) );
    
    this.camera.updateProjectionMatrix();
    // this.camera.lookAt( this.scene.position );

    this.renderer.setSize( width, height );
    this.renderer.render( this.scene, this.camera );

  }


}
