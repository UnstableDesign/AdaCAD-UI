import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { Draft, Interlacement, LoomSettings, convertEPItoMM, cropDraft, warps, wefts } from 'adacad-drafting-lib';
import { GUI } from 'dat.gui';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Bounds, SimulationData, SimulationVars } from '../../core/model/datatypes';
import { defaults } from '../../core/model/defaults';
import { MaterialsService } from '../../core/provider/materials.service';
import { SimulationService } from '../../core/provider/simulation.service';
import { TreeService } from '../../core/provider/tree.service';

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
  gui;
  sim_expanded: boolean = false;

  simVars: SimulationVars = null;
  simData: SimulationData = null;


  tanFOV: number = 0;
  originalHeight: number = 0;
  dirty: boolean; //flags the need to recompute 
  selection_bounds: Bounds = null;
  render_size_error: boolean = false;

  constructor(
    private tree: TreeService,
    public ms: MaterialsService,
    public sim: SimulationService) {

    this.simVars = {
      pack: defaults.pack,
      warp_spacing: 10,
      lift_limit: 4,
      wefts_as_written: defaults.wefts_as_written,
      layer_spacing: defaults.layer_spacing,
      radius: 40,
      use_layers: true,
      ms: this.ms,
      simulate: false
    }


  }


  @HostListener('window:resize', ['$event'])
  onResize(event) {

    this.onWindowResize();
  }

  ngOnInit(): void {



  }



  ngAfterViewInit() {

    const parent_div = document.getElementById('static_draft_view');
    const parent_rect = parent_div.getBoundingClientRect();

    const div = document.getElementById('simulation_container');
    // console.log("size ", parent_rect.width, parent_rect.height)

    let width = parent_rect.width;
    let height = parent_rect.height;

    this.gui = new GUI({ autoPlace: false });
    div.appendChild(this.gui.domElement)


    const simulate = this.gui.add(this.simVars, 'simulate').name('Relax');
    simulate.onChange((value) => {
      this.handleSimulateChange(value);
    });

    const weft_change = this.gui.add(this.simVars, 'wefts_as_written').name('Actual Paths');
    weft_change.onChange((value) => {
      this.handleWeftAsWrittenChange(value);
    });

    const layers = this.gui.add(this.simVars, 'use_layers').name('Locate Layers');
    layers.onChange((value) => {
      this.handleLayersChange(value);
    });

    const lift_limit = this.gui.add(this.simVars, 'lift_limit', 0, 50, 1).name('Lift Limit');
    lift_limit.onChange((value) => {
      this.handleLiftLimitChange(value);
    });


    const pack = this.gui.add(this.simVars, 'pack', 0, 100).name('Pack');
    pack.onChange((value) => {
      this.handlePackChange(value);
    });


    const warp_spacing_change = this.gui.add(this.simVars, 'warp_spacing', .25, 25, .25).name("Warp-Density");
    warp_spacing_change.onChange((value) => {
      this.handleWarpSpacingChange(value);
    });

    const layer_spacing_change = this.gui.add(this.simVars, 'layer_spacing', 0, 50, 1).name("Layer-Size");
    layer_spacing_change.onChange((value) => {
      this.handleLayerSpacingChange(value);
    });


    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(width, height);
    div.appendChild(this.renderer.domElement);


    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);

    this.camera = new THREE.PerspectiveCamera(30, width / height, 1, 5000);


    this.camera.position.set(0, 0, 500);
    this.camera.lookAt(this.scene.position);
    this.scene.add(this.camera);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);


    this.tanFOV = Math.tan(((Math.PI / 180) * this.camera.fov / 2));
    this.originalHeight = height;

    this.renderer.render(this.scene, this.camera);


  }


  handleSimulateChange(value) {
    this.redrawCurrentSim();

  }

  handleLayersChange(value) {
    this.sim.recomputeTopoAndVerticies(this.simData, this.simVars).then(simdata => {
      this.simData = simdata;
      this.redrawCurrentSim();
    })
  }


  handleLiftLimitChange(value) {
    this.sim.recomputeTopoAndVerticies(this.simData, this.simVars).then(simdata => {
      this.simData = simdata;
      this.redrawCurrentSim();
    })
  }




  handlePackChange(value) {
    this.sim.recomputeTopoAndVerticies(this.simData, this.simVars).then(simdata => {
      this.simData = simdata;
      this.redrawCurrentSim();
    })
  }


  handleWeftAsWrittenChange(value) {
    this.sim.recomputeTopoAndVerticies(this.simData, this.simVars).then(simdata => {
      this.simData = simdata;
      this.redrawCurrentSim();
    })
  }

  handleLayerSpacingChange(value) {
    this.sim.recomputeVerticies(this.simData, this.simVars).then(simdata => {
      this.simData = simdata;
      this.redrawCurrentSim();
    })
  }


  handleWarpSpacingChange(value) {
    this.sim.recomputeVerticies(this.simData, this.simVars).then(simdata => {
      this.simData = simdata;
      this.redrawCurrentSim();
    })
  }



  setDirty() {
    this.dirty = true;
  }

  unsetDirty() {
    this.dirty = false;
  }


  endSimulation() {
    this.sim.endSimulation(this.scene);
  }

  public resetSimVars(d: Draft, ls: LoomSettings) {
    this.simVars.warp_spacing = convertEPItoMM(ls);
    this.simVars.layer_spacing = defaults.layer_spacing;
  }


  loadNewDraft(id): Promise<any> {

    const draft = this.tree.getDraft(id);
    const loom_settings = this.tree.getLoomSettings(id);

    //reset the sim vars 
    this.resetSimVars(draft, loom_settings);

    //this.layer_spacing = this.calcDefaultLayerSpacing(draft);
    this.sim.setupSimulation(this.renderer, this.scene, this.camera, this.controls, this.gui, [], []);
    this.resetSelectionBounds(draft);
    this.recalcAndRenderSimData(draft, this.selection_bounds);
    return Promise.resolve('done')

  }

  /**
   * this passes new information to a current rendering, updating which portion of the data we are visualizing. 
   * @param draft 
   * @param loom_settings 
   * @param start 
   * @param end 
   */
  updateSelection(start: Interlacement, end: Interlacement) {

    let width = end.j - start.j;
    if (width <= 0) return;

    let height = end.i - start.i;
    if (height <= 0) return;



    //recalc if this was currently too large to render or if we are making a new selection within an existing  
    if (this.simData == null || this.render_size_error) {

      let draft = this.tree.getDraft(this.id);
      let loom_settings = this.tree.getLoomSettings(this.id);
      let crop = cropDraft(draft, start.i, start.j, width, height);

      //since we trimmed the draft, the selection is now the entire trimmed draft
      this.selection_bounds = {
        topleft: { x: 0, y: 0 },
        width, height
      }
      this.recalcAndRenderSimData(crop, this.selection_bounds);

    } else {

      this.selection_bounds = {
        topleft: { x: start.j, y: start.i },
        width, height
      }

      console.log("RENDERING UPDATED DATA ", this.selection_bounds)
      this.sim.redraw(this.selection_bounds, this.simData, this.simVars);

    }

  }


  resetSelectionBounds(draft: Draft) {
    if (draft == null) draft = this.tree.getDraft(this.id);
    this.selection_bounds = {
      topleft: { x: 0, y: 0 },
      width: warps(draft.drawdown),
      height: wefts(draft.drawdown)
    }
  }

  /**
   * returns the simdata bounds to the size of the entire draft stored at this ID
   */
  unsetSelection() {

    this.resetSelectionBounds(null);
    this.sim.redraw(this.selection_bounds, this.simData, this.simVars);
  }

  /**
   * call this when the simulation needs to be updated due to a structural change. 
   * This will recalculate all the simulation data and then redraw it to screen. 
   * @param draft 
   * @param loom_settings 
   */
  updateSimulation(draft: Draft, loom_settings: LoomSettings, sim: SimulationVars) {


    if (!this.dirty) return; //only recalc and redraw when there is a change that requires it. 
    this.recalcAndRenderSimData(draft, this.selection_bounds);

  }

  // changeLayerThreshold(){
  //   this.recalcAndRenderSimData();
  // }

  snapToX() {
    this.sim.snapToX(this.controls);
  }

  // toggleWefts(){
  //   if(!this.showing_wefts) this.simulation.showWefts();
  //   else this.simulation.hideWefts();
  // }

  // toggleDraft(){
  //   if(!this.showing_draft) this.simulation.showDraft();
  //   else this.simulation.hideDraft();
  // }

  // toggleWarps(){
  //   if(!this.showing_warps) this.simulation.showWarps();
  //   else this.simulation.hideWarps();
  // }


  // toggleTopo(){
  //   if(!this.showing_topo) this.simulation.showTopo();
  //   else this.simulation.hideTopo();
  // }

  // toggleWeftLayerView(){
  //   if(!this.showing_weft_layer_map) this.simulation.showWeftLayerMap();
  //   else this.simulation.hideWeftLayerMap();
  // }

  // toggleWarpLayerView(){
  //   if(!this.sim.showing_warp_layer_map) this.simulation.showWarpLayerMap();
  //   else this.simulation.hideWarpLayerMap();
  // }


  changeRadius(e: any) {
    let draft = this.tree.getDraft(this.id);
    let loom_settings = this.tree.getLoomSettings(this.id);
    this.recalcAndRenderSimData(draft, this.selection_bounds);
  }


  //redraws whatever is stored at this.simData. 
  redrawCurrentSim() {
    this.sim.redraw(this.selection_bounds, this.simData, this.simVars)

  }

  redrawSimColors() {
    let draft = this.tree.getDraft(this.id);
    this.sim.redrawSimColors(draft, this.simVars)

  }

  /**
   * recomputes the topology and verticies of the simulation data for a given draft and selection (e.g. if will only compute the selection if there is one). Loom settings is passed to speak for the EPI. 
   * @param draft 
   * @param loom_settings 
   * @param selection the bounds of the selection or null if no selection has been made. 
   */
  recalcAndRenderSimData(draft: Draft, selection: Bounds) {

    this.sim.recalcSimData(draft, this.simVars)
      .then(simdata => {

        this.simData = simdata;

        document.getElementById('sizeerror').style.display = "none"
        document.getElementById('simulation_container').style.display = "flex";
        this.render_size_error = false;
        this.sim.redraw(selection, this.simData, this.simVars);

      }).catch(err => {

        this.simData = null;
        console.error("Gen Sim Data Returned Error", err);
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


  pageClose() {
    this.sim.endSimulation(this.scene);
  }

  expandSimulation() {

    this.onExpanded.emit();
    this.sim_expanded = !this.sim_expanded;
    this.onWindowResize();

  }

  /**
   * this gets called even if its not open!
   */
  onWindowResize() {
    let width;

    if (this.sim_expanded) width = 2 * window.innerWidth / 3;
    else width = window.innerWidth / 3;

    let height = window.innerHeight;

    this.camera.aspect = width / height;

    // adjust the FOV
    this.camera.fov = (360 / Math.PI) * Math.atan(this.tanFOV * (height / this.originalHeight));

    this.camera.updateProjectionMatrix();
    // this.camera.lookAt( this.scene.position );

    this.renderer.setSize(width, height);
    this.renderer.render(this.scene, this.camera);

  }


}