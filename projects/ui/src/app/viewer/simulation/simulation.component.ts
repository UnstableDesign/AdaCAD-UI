import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatLabel } from '@angular/material/input';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Draft, LoomSettings, SimulationData, convertEPItoMM, copyLoomSettings, warps, wefts } from 'adacad-drafting-lib';
import { SimulationVars } from 'adacad-drafting-lib/simulation';
import { Subscription } from 'rxjs';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Bounds, DraftNode } from '../../core/model/datatypes';
import { defaults } from '../../core/model/defaults';
import { MaterialsService } from '../../core/provider/materials.service';
import { SimulationService } from '../../core/provider/simulation.service';
import { TreeService } from '../../core/provider/tree.service';
import { ViewadjustService } from '../../core/provider/viewadjust.service';
@Component({
  selector: 'app-simulation',
  templateUrl: './simulation.component.html',
  styleUrls: ['./simulation.component.scss'],
  imports: [ReactiveFormsModule, MatSidenavModule, MatSlideToggleModule, MatLabel]
})
export class SimulationComponent implements OnInit, OnDestroy {
  private tree = inject(TreeService);
  ms = inject(MaterialsService);
  sim = inject(SimulationService);
  vas = inject(ViewadjustService);



  @Input('id') id;
  @Input('new_draft_flag$') new_draft_flag$;
  @Output() onExpanded = new EventEmitter();

  renderer;
  scene;
  camera;
  controls;
  gui;
  sim_expanded: boolean = false;
  hasFocus: boolean = false;

  simVars: SimulationVars = null;
  simData: SimulationData = null;
  public simControls: FormGroup = null;

  tanFOV: number = 0;
  originalHeight: number = 0;
  dirty: boolean; //flags the need to recompute 
  selection_bounds: Bounds = null;
  render_size_error: boolean = false;

  viewadjustSubscription: Subscription;
  materialColorChangeSubscription: Subscription;
  materialDiameterChangeSubscription: Subscription;
  draftChangeSubscription: Subscription;


  constructor(
  ) {

    //set up default sim vars
    this.simVars = {
      pack: defaults.pack,
      warp_spacing: 10,
      lift_limit: 4,
      wefts_as_written: defaults.wefts_as_written,
      layer_spacing: defaults.layer_spacing,
      use_layers: true,
      ms: this.ms.getShuttles(),
      simulate: false,
      use_smoothing: true,
      repulse_force_correction: 0,
      time: .05,
      mass: 150,
      max_theta: Math.PI / 12
    }


    this.initSimControls();

  }

  /**
   * called when something internally needs to cause the sim form to change.
   * shows present value of simVars 
   * @param formValues 
   */
  updateSimFormValues() {
    const ls = this.tree.getLoomSettings(this.id);
    this.simControls.patchValue({
      warpSpacing: ls.epi,
      liftLimit: this.simVars.lift_limit,
      pack: this.simVars.pack,
      mass: this.simVars.mass,
      maxTheta: this.simVars.max_theta * 180 / Math.PI,
      weftsAsWritten: (this.simVars.wefts_as_written) ? "true" : "false",
    }, { emitEvent: false });
  }


  ngOnInit(): void {

    this.simControls.valueChanges.subscribe(value => {
      this.updateSimParameters(value);
    });

    this.viewadjustSubscription = this.vas.viewAdjustChange.subscribe(x => {
      if (!this.hasFocus) return;
      this.updateRendererSize();
    });

    this.materialColorChangeSubscription = this.ms.materialColorChange.subscribe(id => {
      if (!this.hasFocus) return;
      this.simVars.ms = this.ms.getShuttles();
      this.redrawCurrentSim();
    });


    this.materialDiameterChangeSubscription = this.ms.materialDiameterChange.subscribe(id => {
      if (!this.hasFocus) return;

      this.simVars.ms = this.ms.getShuttles();
      if (this.simData) this.sim.computeSimulationData(this.simData.draft, this.simVars).then(simdata => {
        this.simData = simdata;
        this.redrawCurrentSim();
      })
    });




  }



  ngAfterViewInit() {

    const rendering_div = document.getElementById('simulation_rendering');
    if (!rendering_div) {
      console.error('simulation_rendering element not found');
      return;
    }

    const rect = rendering_div.getBoundingClientRect();
    const width = rect.width || 400;
    const height = rect.height || 400;


    // this.gui = new GUI({ autoPlace: false });
    // controls_div.appendChild(this.gui.domElement)


    // const simulate = this.gui.add(this.simVars, 'simulate').name('Relax');
    // simulate.onChange((value) => {
    //   this.handleSimulateChange(value);
    // });

    // const weft_change = this.gui.add(this.simVars, 'wefts_as_written').name('Actual Paths');
    // weft_change.onChange((value) => {
    //   this.handleWeftAsWrittenChange(value);
    // });

    // const layers = this.gui.add(this.simVars, 'use_layers').name('Locate Layers');
    // layers.onChange((value) => {
    //   this.handleLayersChange(value);
    // });

    // const smoothing = this.gui.add(this.simVars, 'use_smoothing').name('Smoothing');
    // smoothing.onChange((value) => {
    //   this.handleSmoothingChange(value);
    // });

    // const lift_limit = this.gui.add(this.simVars, 'lift_limit', 0, 50, 1).name('Lift Limit');
    // lift_limit.onChange((value) => {
    //   this.handleLiftLimitChange(value);
    // });


    // const pack = this.gui.add(this.simVars, 'pack', 0.001, 1, .001).name('Pack');
    // pack.onChange((value) => {
    //   this.handlePackChange(value);
    // });

    // const time = this.gui.add(this.simVars, 'time', .0001, 1, .001).name('Time');
    // time.onChange((value) => {
    //   this.handleTimeChange(value);
    // });

    // const mass = this.gui.add(this.simVars, 'mass', 100, 1000, 10).name('Mass');
    // mass.onChange((value) => {
    //   this.handleMassChange(value);
    // });

    // const max_theta = this.gui.add(this.simVars, 'max_theta', 0, Math.PI / 2).name('Max Theta');
    // max_theta.onChange((value) => {
    //   this.handleMaxThetaChange(value);
    // });


    // const warp_spacing_change = this.gui.add(this.simVars, 'warp_spacing', .25, 25, .25).name("Warp-Density");
    // warp_spacing_change.onChange((value) => {
    //   this.handleWarpSpacingChange(value);
    // });

    // const layer_spacing_change = this.gui.add(this.simVars, 'layer_spacing', 0, 50, 1).name("Layer-Size");
    // layer_spacing_change.onChange((value) => {
    //   this.handleLayerSpacingChange(value);
    //  });

    /////

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);

    this.camera = new THREE.PerspectiveCamera(30, width / height, .1, 2000);
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(this.scene.position);


    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(width, height);
    rendering_div.appendChild(this.renderer.domElement);


    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.tanFOV = Math.tan(((Math.PI / 180) * this.camera.fov / 2));
    this.originalHeight = height;

    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });


  }

  initSimControls() {
    this.simControls = new FormGroup({
      weftsAsWritten: new FormControl(defaults.wefts_as_written ? "true" : "false"),
      liftLimit: new FormControl(4, [Validators.required, Validators.min(1), Validators.max(50)]),
      pack: new FormControl(defaults.pack, [Validators.required, Validators.min(0.001), Validators.max(1)]),
      mass: new FormControl(150, [Validators.required, Validators.min(0), Validators.max(1000)]),
      maxTheta: new FormControl(45, [Validators.required, Validators.min(0), Validators.max(90)]), //in degrees
      warpSpacing: new FormControl(12, [Validators.required, Validators.min(0.25), Validators.max(120)]), //measured in epi
    });
  }




  handleSimulateChange(value) {



    this.redrawCurrentSim();

  }






  updateSimParameters(formValues: any) {



    if (this.id === -1 || this.hasFocus === false) return;

    let flag_needs_new_topo = false;
    if (formValues.weftsAsWritten !== undefined && formValues.weftsAsWritten !== this.simVars.wefts_as_written) {
      this.simVars.wefts_as_written = formValues.weftsAsWritten === "true";
    }
    if (formValues.liftLimit !== undefined && formValues.liftLimit !== this.simVars.lift_limit) {
      this.simVars.lift_limit = formValues.liftLimit;
      flag_needs_new_topo = true;
    }
    if (formValues.pack !== undefined && formValues.pack !== this.simVars.pack) {
      this.simVars.pack = formValues.pack;
    }
    if (formValues.mass !== undefined && formValues.mass !== this.simVars.mass) {
      this.simVars.mass = formValues.mass;
    }
    if (formValues.maxTheta !== undefined && formValues.maxTheta !== this.simVars.max_theta) {
      this.simVars.max_theta = formValues.maxTheta * Math.PI / 180;
    }
    if (formValues.warpSpacing !== undefined && formValues.warpSpacing !== this.simVars.warp_spacing) {
      let loom_settings = copyLoomSettings(this.tree.getLoomSettings(this.id));
      loom_settings.epi = formValues.warpSpacing;
      this.simVars.warp_spacing = convertEPItoMM(loom_settings);
    }


    this.simVars.ms = this.ms.getShuttles();

    if (this.simData) this.sim.computeSimulationData(this.simData.draft, this.simVars).then(simdata => {
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


    // document.body.removeChild(this.renderer.domElement);
    if (this.scene) this.scene.clear();
    if (this.scene && this.scene.children) this.scene.children.forEach(childMesh => {
      if (childMesh.geometry !== undefined) childMesh.geometry.dispose();
      if (childMesh.texture !== undefined) childMesh.texture.dispose();
      if (childMesh.material !== undefined) childMesh.material.dispose();
    });

  }


  public resetSimVars(ls: LoomSettings) {

    this.simVars.warp_spacing = convertEPItoMM(ls);
    this.simVars.layer_spacing = defaults.layer_spacing;
  }


  subscribeToDraftUpdates(id: number) {
    if (id === -1) return;
    const draftNode = this.tree.getNode(id) as DraftNode;
    if (draftNode.type !== 'draft') return;


    if (this.draftChangeSubscription) this.draftChangeSubscription.unsubscribe();

    this.draftChangeSubscription = draftNode.onValueChange.subscribe(draftNodeBroadcast => {
      this.simVars.warp_spacing = convertEPItoMM(draftNodeBroadcast.loom_settings);
      this.updateSimFormValues();
      this.recalcAndRenderSimData(draftNodeBroadcast.draft);
    });
  }


  /** if we switch into the view from another view */
  onFocus(id: number) {
    this.id = id;
    this.hasFocus = true;
    this.subscribeToDraftUpdates(id);
  }

  onFocusOut() {
    this.hasFocus = false;
    this.id = -1;
  }


  /** if we are in the sim mode, and the viewer id changes */
  onNewDraftLoaded(id: number): Promise<any> {
    if (id === -1) return;
    this.subscribeToDraftUpdates(id);
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
    //this.sim.redraw(this.selection_bounds, this.simData, this.simVars);
  }



  snapToX() {
    this.sim.snapToX(this.controls);
  }




  //redraws whatever is stored at this.simData. 
  redrawCurrentSim() {


    if (this.simData == null) return;
    if (this.simData.draft == null) return;
    if (this.simData.topo == null) return;
    if (this.simData.wefts == null) return;
    if (this.simData.warps == null) return;
    this.resetSelectionBounds(this.simData.draft);

    this.simVars.ms = this.ms.getShuttles(); //add this to capture color changes
    this.sim.redraw(this.selection_bounds, this.simData, this.simVars, this.scene).then(
      scene => {
        this.scene = scene;
        this.renderer.render(this.scene, this.camera);
        this.resetCamera();
      }
    );
  }




  /**
   * recomputes the topology and verticies of the simulation data for a given draft and selection (e.g. if will only compute the selection if there is one). Loom settings is passed to speak for the EPI. 
   * @param draft 
   * @param loom_settings 
   * @param selection the bounds of the selection or null if no selection has been made. 
   */
  recalcAndRenderSimData(draft: Draft) {


    this.simVars.ms = this.ms.getShuttles();

    this.resetSelectionBounds(draft);


    this.sim.recalcSimData(draft, this.simVars)
      .then(simdata => {

        this.simData = simdata;

        // document.getElementById('sizeerror').style.display = "none"
        // document.getElementById('simulation_container').style.display = "flex";
        // this.render_size_error = false;
        this.sim.redraw(this.selection_bounds, this.simData, this.simVars, this.scene).then(
          scene => {
            this.scene = scene;
            this.renderer.render(this.scene, this.camera);
            this.resetCamera();
          }
        )

      }).catch(err => {

        this.simData = null;
        console.error("Gen Sim Data Returned Error", err);
        this.render_size_error = true;
        document.getElementById('sizeerror').style.display = "block"
        document.getElementById('simulation_container').style.display = "none"
      })
  }


  /**
   * Resets the camera to center and frame the simulation scene
   */
  resetCamera() {
    if (!this.scene || !this.camera || !this.controls) return;

    // Calculate bounding box of all objects in the scene
    const box = new THREE.Box3();
    const objects = this.scene.children.filter(child => {
      // Only include meshes and groups, exclude lights
      return child.type === 'Mesh' || child.type === 'Group' || child.type === 'Line';
    });

    if (objects.length === 0) return;

    // Expand box to include all objects
    objects.forEach(object => {
      box.expandByObject(object);
    });

    // Get center and size of the bounding box
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Calculate the distance needed to fit the scene
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

    // Add some padding
    const distance = cameraZ * 1.5;

    // Position camera to view the scene from an angle
    this.camera.position.set(
      center.x + distance * 0.5,
      center.y + distance * 0.5,
      center.z + distance
    );

    // Set controls target to center of scene
    this.controls.target.copy(center);
    this.controls.update();

    // Render the scene with the new camera position
    this.renderer.render(this.scene, this.camera);
  }



  /**
   * Updates the renderer and camera to match the current container size
   */
  updateRendererSize() {
    if (!this.renderer || !this.camera) return;

    const rendering_div = document.getElementById('simulation_rendering');
    if (!rendering_div) return;

    const rect = rendering_div.getBoundingClientRect();
    const width = window.innerWidth - this.vas.left;
    const height = rect.height;

    if (width === 0 || height === 0) return;

    // Update camera aspect ratio
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // Update renderer size
    this.renderer.setSize(width, height);

    // Render the scene with updated size
    if (this.scene) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  ngOnDestroy() {
    if (this.viewadjustSubscription) this.viewadjustSubscription.unsubscribe();
    if (this.materialColorChangeSubscription) this.materialColorChangeSubscription.unsubscribe();
    if (this.materialDiameterChangeSubscription) this.materialDiameterChangeSubscription.unsubscribe();
    if (this.draftChangeSubscription) this.draftChangeSubscription.unsubscribe();

  }


}
