import { Injectable } from '@angular/core';
import { Draft, warps, wefts } from 'adacad-drafting-lib';
import * as THREE from 'three';
import { Bounds, SimulationData, SimulationVars, WeftPath, YarnVertex } from '../model/datatypes';
import { defaults } from '../model/defaults';
import { applyForce, createParticle, createSpring, followTheWefts, getDraftTopology, getFlatVtxList, renderWarps, satisfyConstraint, updateParticleMesh, updateSpringMesh, verlet } from '../model/yarnsimulation';

@Injectable({
  providedIn: 'root'
})
export class SimulationService {


  /**
   * store one instance of the data for this sim and the variables controlling the rendering
   */


  renderer;
  scene; camera;
  controls;
  gui;
  particles;
  springs;
  warp_layer_map_scene: any;
  weft_layer_map_scene: any;
  warp_scene: any;
  weft_scene: any;
  axis_scene: any;
  topo_scene: any;
  draft_scene: any;


  constructor() {
    this.particles = [];
    this.springs = [];
  }


  /**
   * clears the memory devoted to a scene
   * @param scene 
   */
  public endSimulation(scene) {

    // document.body.removeChild(this.renderer.domElement);
    scene.clear();
    scene.children.forEach(childMesh => {
      if (childMesh.geometry !== undefined) childMesh.geometry.dispose();
      if (childMesh.texture !== undefined) childMesh.texture.dispose();
      if (childMesh.material !== undefined) childMesh.material.dispose();
    });

  }

  /**
   * if the draft is too big, simulation will hang the interface. Impose a size limit to avoid 
   * long delays
   * @param draft 
   * @returns 
   */
  public isAcceptableSize(draft: Draft): boolean {
    let area = warps(draft.drawdown) * wefts(draft.drawdown);
    return (area <= defaults.max_simulation_area)
  }



  /**
   * computes an entire simulation from a draft and variables 
   * @param draft 
   * @param simVars 
   * @returns 
   */
  public computeSimulationDataFromDraft(draft: Draft, simVars: SimulationVars): Promise<SimulationData> {

    if (!this.isAcceptableSize(draft)) return Promise.reject("size error");

    const simData: SimulationData = {
      draft: draft,
      topo: null,
      wefts: null,
      warps: null
    };


    return getDraftTopology(simData.draft, simVars).then(topo => {
      simData.topo = topo;
      return followTheWefts(simData.draft, simData.topo, simVars);
    }).then(paths => {
      simData.wefts = paths;
      return renderWarps(simData.draft, simData.topo, simData.wefts, simVars)
    }).then(paths => {
      simData.warps = paths;
      return simData;

    })

  }


  /**
   * computes an entire simulation from a draft and variables 
   * @param draft 
   * @param simVars 
   * @returns 
   */
  public computeSimulationData(draft: Draft, simVars: SimulationVars): Promise<SimulationData> {

    if (!this.isAcceptableSize(draft)) return Promise.reject("size error");

    const simData: SimulationData = {
      draft: draft,
      topo: null,
      wefts: null,
      warps: null
    };


    return getDraftTopology(simData.draft, simVars).then(topo => {
      simData.topo = topo;
      return followTheWefts(simData.draft, simData.topo, simVars);
    }).then(paths => {
      simData.wefts = paths;
      return renderWarps(simData.draft, simData.topo, simData.wefts, simVars)
    }).then(paths => {
      simData.warps = paths;
      return simData;

    })

  }


  /**
   * computes the topology and verticies for the draft that has already been provided
   * @param draft 
   * @param simVars 
   * @returns 
   */
  public recomputeTopoAndVerticies(simData: SimulationData, simVars: SimulationVars): Promise<SimulationData> {

    if (!this.isAcceptableSize(simData.draft)) return Promise.reject("size error");



    return getDraftTopology(simData.draft, simVars).then(topo => {
      simData.topo = topo;
      return followTheWefts(simData.draft, simData.topo, simVars);
    }).then(paths => {
      simData.wefts = paths;
      return renderWarps(simData.draft, simData.topo, simData.wefts, simVars)
    }).then(paths => {
      simData.warps = paths;
      return simData;

    })


  }

  //use the current toplogy but recompute the positions of the verticies based on the simVars
  public recomputeVerticies(simData: SimulationData, simVars: SimulationVars): Promise<SimulationData> {

    return followTheWefts(simData.draft, simData.topo, simVars)
      .then(paths => {
        simData.wefts = paths;
        return renderWarps(simData.draft, simData.topo, simData.wefts, simVars);
      }).then(paths => {
        simData.warps = paths;
        return simData;

      });
  }



  public animate() {
    const gravity = new THREE.Vector3(0, -9.81, 0);
    const timeStep = 1 / 60;
    const damping = 0.98;

    requestAnimationFrame(() => this.animate()); // Bind 'this'
    this.controls.update();

    for (let p of this.particles) {
      p = applyForce(p, gravity.clone());
    }

    // Verlet integration
    for (let p of this.particles) {
      p = verlet(p, damping, timeStep);
    }

    // Satisfy spring constraints multiple times (for stiffness)
    for (let i = 0; i < 5; i++) {
      for (let s of this.springs) {
        s = satisfyConstraint(s);
      }
    }

    // Update visuals
    for (const p of this.particles) {
      updateParticleMesh(p);
    }

    for (const s of this.springs) {
      updateSpringMesh(s);
    }

    this.renderer.render(this.scene, this.camera);



  }



  public setupSimulation(renderer, scene, camera, controls, gui, particles, springs) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.gui = gui;
    this.particles = particles;
    this.springs = springs;

    // const light = new THREE.DirectionalLight(0xffffff, 1);
    // light.position.set(5, 10, 7.5);
    // this.scene.add(light);


    controls.update();

    this.animate();

  }



  public snapToX(controls) {
    controls.target = new THREE.Vector3(200, 0, 0);
    controls.update();
  }



  public recalcSimData(draft: Draft, simVars: SimulationVars): Promise<SimulationData> {

    return this.computeSimulationDataFromDraft(draft, simVars)
      .then(simdata => {
        return simdata
      })
  }

  /**
   * called when a rendering value changes that does not require a full recalculation of the simulation data
   */
  public redrawSimColors(draft: Draft, simVars: SimulationVars) {

    //update warp material colors
    draft.colShuttleMapping.forEach((material_id, j) => {
      let color = simVars.ms.getColorForSim(material_id);
      const render_color = new THREE.Color(color);
      let warp_render = this.scene.getObjectByName('warp-' + j);
      warp_render.material.color.set(render_color);

    })

    draft.rowShuttleMapping.forEach((material_id, j) => {
      let color = simVars.ms.getColorForSim(material_id);
      const render_color = new THREE.Color(color);
      let weft_render = this.scene.getObjectByName('weft-' + j);
      weft_render.material.color.set(render_color);

    })





  }


  //** renders the current for simData in this class */
  public redraw(selection: Bounds, simData: SimulationData, simVars: SimulationVars): Promise<any> {
    this.scene.clear();

    const light = new THREE.DirectionalLight(0xffffff, 1.0);
    const back_light = new THREE.DirectionalLight(0xffffff, 1.0);
    this.scene.add(light);
    this.scene.add(back_light);

    light.position.set(20, 0, 50);
    back_light.position.set(20, 0, -50);


    //update the particle positions here: 



    if (!simVars.simulate) {
      const boundary_vtx = this.getBoundaryVtxs(simData.wefts, selection);
      this.drawAxis(boundary_vtx);
      this.drawYarns(simData, simVars, selection, boundary_vtx);
    } else {
      if (simVars.simulate) this.drawSimulation(simData, simVars);
    }
    //  this.drawEndCaps(scene, simdata, boundary_vtx);
    //   this.drawWarpLayerMap(scene, boundary_vtx);
    //   this.drawWeftLayerMap(scene, boundary_vtx);
    //   this.drawTopology(scene, boundary_vtx);
    //   this.drawDraft(scene, this.currentSim.draft, this.currentSim.sim, boundary_vtx);


    return Promise.resolve()

  }


  drawSimulation(simData: SimulationData, simVars: SimulationVars) {
    for (const yarn of simData.wefts) {
      let count = 0;

      let diameter = simVars.ms.getDiameter(yarn.material);
      let color = simVars.ms.getColorForSim(yarn.material);


      for (const vtx of yarn.vtxs) {

        const p = createParticle(vtx.x, vtx.y, vtx.z, false);

        if (vtx.ndx.j === 0 || vtx.ndx.j === warps(simData.draft.drawdown) - 1) p.pinned = true;
        this.particles.push(p);
        this.scene.add(p.mesh);

        if (count >= 1) {
          const distance = this.particles[count - 1].position.distanceTo(this.particles[count].position);
          let s = createSpring(this.particles[count - 1], this.particles[count], distance, color, diameter)
          this.springs.push(s);
          this.scene.add(s.mesh);

        }
        count++;
      }
    }

    return Promise.resolve(simData);

  }


  drawAxis(boundary_vtx: any) {

    this.axis_scene = new THREE.Group();
    let axis_offset = 5.

    //X AXIS 
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const points = [];
    points.push(new THREE.Vector3(boundary_vtx.min_x - axis_offset, boundary_vtx.min_y - axis_offset, 0));
    points.push(new THREE.Vector3(boundary_vtx.max_x + axis_offset, boundary_vtx.min_y - axis_offset, 0));

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    this.axis_scene.add(line);


    /**Y AXIS */
    const y_points = [];
    y_points.push(new THREE.Vector3(boundary_vtx.min_x - axis_offset, boundary_vtx.min_y - axis_offset, 0));
    y_points.push(new THREE.Vector3(boundary_vtx.min_x - axis_offset, boundary_vtx.max_y + axis_offset, 0));

    const y_geometry = new THREE.BufferGeometry().setFromPoints(y_points);
    const y_line = new THREE.Line(y_geometry, material);
    this.axis_scene.add(y_line);

    /**Z AXIS */
    const z_points = [];
    z_points.push(new THREE.Vector3(boundary_vtx.min_x - axis_offset, boundary_vtx.min_y - axis_offset, 0));
    z_points.push(new THREE.Vector3(boundary_vtx.min_x - axis_offset, boundary_vtx.min_y - axis_offset, axis_offset));


    const z_geometry = new THREE.BufferGeometry().setFromPoints(z_points);
    const z_line = new THREE.Line(z_geometry, material);
    this.axis_scene.add(z_line);




    this.axis_scene = this.applyOrientationConversion(this.axis_scene, boundary_vtx);
    this.scene.add(this.axis_scene);


  }

  /**
   * given the vtx data this function returns the min/max values for wefts and warps
   * @param simdata 
   * @returns 
   */
  getBoundaryVtxs(paths: Array<WeftPath>, selection: Bounds): { min_x: number, max_x: number, min_y: number, max_y: number } {

    //collapse the paths into a flat list
    const vtxs: Array<YarnVertex> = getFlatVtxList(paths);
    console.log("VTXS ", vtxs)


    if (vtxs.length == 0) return;


    //get the weft boundary, draw warps from this data
    let in_bound_wefts = vtxs.filter((el) => (el.ndx.i >= selection.topleft.y && el.ndx.i < selection.topleft.y + selection.height));

    let min_y = in_bound_wefts.filter((vtx) => vtx.ndx.j >= selection.topleft.x && vtx.ndx.j < selection.topleft.x + selection.width)
      .reduce((acc, vtx) => {
        if (vtx.y < acc) return vtx.y;
        return acc;
      }, 100000);

    let max_y = in_bound_wefts.filter((vtx) => vtx.ndx.j >= selection.topleft.x && vtx.ndx.j < selection.topleft.x + selection.width).reduce((acc, vtx) => {
      if (vtx.y > acc) return vtx.y;
      return acc;
    }, 0);

    let min_x = in_bound_wefts.filter((vtx) => vtx.ndx.j >= selection.topleft.x && vtx.ndx.j < selection.topleft.x + selection.width).reduce((acc, vtx) => {
      if (vtx.x < acc) return vtx.x;
      return acc;
    }, 10000);

    let max_x = in_bound_wefts.filter((vtx) => vtx.ndx.j >= selection.topleft.x && vtx.ndx.j < selection.topleft.x + selection.width).reduce((acc, vtx) => {
      if (vtx.x > acc) return vtx.x;
      return acc;
    }, 0);



    return { min_x, max_x, min_y, max_y };




  }


  /**
   * this renders the imagery of the yarns. It uses the boundary provided by 
   * @param scene 
   * @param simdata 
   */
  drawYarns(simdata: SimulationData, simVars: SimulationVars, selection: Bounds, boundary_vtx: any) {

    this.warp_scene = new THREE.Group();
    this.warp_scene.name = 'warp-scene'
    this.weft_scene = new THREE.Group();
    this.weft_scene.name = 'weft-scene'

    //DRAW THE WAPRS

    console.log("WARPS ", simdata.warps)
    simdata.warps.forEach(path => {
      const pts = [];
      path.vtxs.forEach(vtx => {
        if (vtx.x !== undefined) {
          pts.push(new THREE.Vector3(vtx.x, vtx.y, -vtx.z));
        }
      });

      if (pts.length !== 0) {

        const material_id = path.material;
        let diameter = simVars.ms.getDiameter(material_id);
        let color = simVars.ms.getColorForSim(material_id)

        const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .01);
        const geometry = new THREE.TubeGeometry(curve, path.vtxs.length * 10, diameter / 2, 8, false);
        const material = new THREE.MeshPhysicalMaterial({
          color: color,
          emissive: 0x000000,
          depthTest: true,
          metalness: 0,
          roughness: 0.5,
          clearcoat: 1.0,
          clearcoatRoughness: 1.0,
          reflectivity: 0.0
        });
        let curveObject = new THREE.Mesh(geometry, material);
        curveObject.name = 'warp-' + path.system + "-" + path.material;

        this.weft_scene.add(curveObject);
      }

    })
    this.warp_scene = this.applyOrientationConversion(this.warp_scene, boundary_vtx);
    this.scene.add(this.warp_scene);

    //WEFT SIM
    console.log("PATHS ", simdata.wefts)
    simdata.wefts.forEach(path => {
      const pts = [];
      path.vtxs.forEach(vtx => {
        if (vtx.x !== undefined) {
          pts.push(new THREE.Vector3(vtx.x, vtx.y, -vtx.z));
        }
      });

      if (pts.length !== 0) {

        const material_id = path.material;
        let diameter = simVars.ms.getDiameter(material_id);
        let color = simVars.ms.getColorForSim(material_id)

        const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .01);
        const geometry = new THREE.TubeGeometry(curve, path.vtxs.length * 10, diameter / 2, 8, false);
        const material = new THREE.MeshPhysicalMaterial({
          color: color,
          emissive: 0x000000,
          depthTest: true,
          metalness: 0,
          roughness: 0.5,
          clearcoat: 1.0,
          clearcoatRoughness: 1.0,
          reflectivity: 0.0
        });
        let curveObject = new THREE.Mesh(geometry, material);
        curveObject.name = 'weft-' + path.system + "-" + path.material;

        this.weft_scene.add(curveObject);
      }

    })
    this.weft_scene = this.applyOrientationConversion(this.weft_scene, boundary_vtx);
    this.scene.add(this.weft_scene);
  }

  // drawDraft(scene, draft: Draft, sim: SimulationVars, boundary_vtx){
  //   this.draft_scene =  new THREE.Group();
  //   const geometry = new THREE.BufferGeometry();
  //   // const yarn_height = 5;
  //   const yarn_height = this.currentSim.sim.warp_spacing;

  //   let alldata = [];
  //   let positions = [];
  //   let colors = [];
  //   let normals = [];
  //   let indicies = [];

  //   for(let i = 0; i < wefts(draft.drawdown); i++){
  //     for(let j = 0; j < warps(draft.drawdown); j++){

  //      const col = (getCellValue(draft.drawdown[i][j])==true) ? 0 : 1;


  //      alldata.push({
  //         pos: [sim.warp_spacing*j, yarn_height*i, 0],
  //         norm: [0, 1, 0],
  //         color: [col, col, col]
  //       });

  //       alldata.push({
  //         pos: [sim.warp_spacing*(j+1), yarn_height*i, 0],
  //         norm: [0, 1, 0],
  //         color: [col, col, col]
  //       })

  //       alldata.push({
  //         pos: [sim.warp_spacing*j, yarn_height*(i+1), 0],
  //         norm: [0, 1, 0],
  //         color: [col, col, col]
  //       });

  //       alldata.push({
  //         pos: [sim.warp_spacing*(j+1), yarn_height*(i+1), 0],
  //         norm: [0, 1, 0],
  //         color: [col, col, col]
  //       });

  //       let starting_index = ((i*warps(draft.drawdown)) + j) *4;

  //       indicies =  indicies.concat([
  //         starting_index+2,starting_index+0,starting_index+3,starting_index+1,starting_index+3,starting_index+0
  //       ]);
  //     }
  //   }


  //   for (const vertex of alldata) {
  //     positions.push(...vertex.pos);
  //     normals.push(...vertex.norm);
  //     colors.push(...vertex.color);
  //   }

  //   geometry.setIndex(indicies);
  //   geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
  // 	geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
  // 	geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
  //   const material = new THREE.MeshBasicMaterial( {
  //     side: THREE.DoubleSide,
  //     vertexColors: true
  //   } );



  //   let mesh = new THREE.Mesh( geometry, material );
  //   this.draft_scene.add(mesh);
  //   this.draft_scene = this.applyOrientationConversion(this.draft_scene, boundary_vtx);
  // 	scene.add( this.draft_scene );


  // }

  showDraft() {
    // this.draft_scene.visible = true;
  }

  hideDraft() {
    //this.draft_scene.visible = false;
  }


  showWarps() {
    //this.warp_scene.visible = true;
  }

  hideWarps() {
    // this.warp_scene.visible = false;
  }

  showWefts() {
    // console.log("SHOW WEFTS");
    //this.weft_scene.visible = true;
  }

  hideWefts() {
    //this.weft_scene.visible = false;
  }


  hideWarpLayerMap() {
    //this.warp_layer_map_scene.visible = false;
  }

  showWarpLayerMap() {
    //this.warp_layer_map_scene.visible = true;
    // console.log("SHOW WARP LAYER MAP", this.warp_layer_map_scene)
  }

  hideWeftLayerMap() {
    // this.weft_layer_map_scene.visible = false;
  }

  showWeftLayerMap() {
    // this.weft_layer_map_scene.visible = true;
    // console.log("SHOW LAYER MAP", this.weft_layer_map_scene)
  }

  hideTopo() {
    // this.topo_scene.visible = false;
  }

  showTopo() {
    // this.topo_scene.visible = true;
    // console.log("SHOW LAYER MAP", this.topo_scene)
  }

  // drawWeftLayerMap(scene, boundary_vtx){

  //   this.weft_layer_map_scene =  new THREE.Group();

  //   let z = -20;

  //   const lm = this.currentSim.layer_maps;
  //   const sim = this.currentSim.sim;
  //   const draft = this.currentSim.draft;

  //   let range = lm.weft.reduce((acc, val) => {
  //     let max = val.reduce((sub_acc, vtx) => {
  //       if(vtx > sub_acc) return vtx;
  //       return sub_acc;
  //     }, 0);

  //     if(max > acc) return max;
  //     return acc;
  //   }, 0);

  //   if(range == 0) range = 1;

  //   const lut = new Lut();

  //   lut.setColorMap( 'rainbow', 512);


  //   const geometry = new THREE.BufferGeometry();
  //   // const yarn_height = 5;
  //   const yarn_height = this.currentSim.sim.warp_spacing;

  //   let alldata = [];
  //   let positions = [];
  //   let colors = [];
  //   let normals = [];
  //   let indicies = [];

  //   for(let i = 0; i < lm.weft.length; i++){
  //     for(let j = 0; j < lm.weft[0].length; j++){

  //       const r = 0.5 + ( lm.weft[i][j] / range );
  //       const col = lut.getColor(r);

  //       if(col !== undefined){

  //      alldata.push({
  //         pos: [sim.warp_spacing*j, yarn_height*i, z],
  //         norm: [0, 1, 0],
  //         color: [col.r, col.g, col.b]
  //       });

  //       alldata.push({
  //         pos: [sim.warp_spacing*(j+1), yarn_height*i, z],
  //         norm: [0, 1, 0],
  //         color: [col.r, col.g, col.b]
  //       })

  //       alldata.push({
  //         pos: [sim.warp_spacing*j, yarn_height*(i+1), z],
  //         norm: [0, 1, 0],
  //         color: [col.r, col.g, col.b]
  //       });

  //       alldata.push({
  //         pos: [sim.warp_spacing*(j+1), yarn_height*(i+1), z],
  //         norm: [0, 1, 0],
  //         color: [col.r, col.g, col.b]
  //       });
  //       }

  //       let starting_index = ((i*warps(draft.drawdown)) + j) *4;

  //       indicies =  indicies.concat([
  //         starting_index+2,starting_index+0,starting_index+3,starting_index+1,starting_index+3,starting_index+0
  //       ]);
  //     }
  //   }



  //   for (const vertex of alldata) {
  //     positions.push(...vertex.pos);
  //     normals.push(...vertex.norm);
  //     colors.push(...vertex.color);
  //   }




  //   geometry.setIndex(indicies);
  //   geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
  // 	geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
  // 	geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
  //   const material = new THREE.MeshBasicMaterial( {
  //     side: THREE.DoubleSide,
  //     transparent: true,
  //     vertexColors: true,
  //     opacity: .5
  //   } );



  //   let mesh = new THREE.Mesh( geometry, material );    
  //   this.weft_layer_map_scene.add(mesh);
  //   this.weft_layer_map_scene = this.applyOrientationConversion( this.weft_layer_map_scene, boundary_vtx);
  // 	scene.add(  this.weft_layer_map_scene );

  // }



  // drawWarpLayerMap(scene, boundary_vtx){

  //   this.warp_layer_map_scene =  new THREE.Group();

  //   let z = -20;

  //   const lm = this.currentSim.layer_maps;
  //   const sim = this.currentSim.sim;
  //   const draft = this.currentSim.draft;

  //   let range = lm.warp.reduce((acc, val) => {
  //     let max = val.reduce((sub_acc, vtx) => {
  //       if(vtx > sub_acc) return vtx;
  //       return sub_acc;
  //     }, 0);

  //     if(max > acc) return max;
  //     return acc;
  //   }, 0);

  //   if(range == 0) range = 1;

  //   const lut = new Lut();

  //   lut.setColorMap( 'rainbow', 512);


  //   const geometry = new THREE.BufferGeometry();
  //   // const yarn_height = 5;
  //   const yarn_height = this.currentSim.sim.warp_spacing;

  //   let alldata = [];
  //   let positions = [];
  //   let colors = [];
  //   let normals = [];
  //   let indicies = [];

  //   for(let i = 0; i < lm.warp.length; i++){
  //     for(let j = 0; j < lm.warp[0].length; j++){

  //       const r = 0.5 + ( lm.warp[i][j] / range );
  //       const col = lut.getColor(r);




  //      alldata.push({
  //         pos: [sim.warp_spacing*j, yarn_height*i, z],
  //         norm: [0, 1, 0],
  //         color: [col.r, col.g, col.b]
  //       });

  //       alldata.push({
  //         pos: [sim.warp_spacing*(j+1), yarn_height*i, z],
  //         norm: [0, 1, 0],
  //         color: [col.r, col.g, col.b]
  //       })

  //       alldata.push({
  //         pos: [sim.warp_spacing*j, yarn_height*(i+1), z],
  //         norm: [0, 1, 0],
  //         color: [col.r, col.g, col.b]
  //       });

  //       alldata.push({
  //         pos: [sim.warp_spacing*(j+1), yarn_height*(i+1), z],
  //         norm: [0, 1, 0],
  //         color: [col.r, col.g, col.b]
  //       });

  //       let starting_index = ((i*warps(draft.drawdown)) + j) *4;

  //       indicies =  indicies.concat([
  //         starting_index+2,starting_index+0,starting_index+3,starting_index+1,starting_index+3,starting_index+0
  //       ]);
  //     }
  //   }



  //   for (const vertex of alldata) {
  //     positions.push(...vertex.pos);
  //     normals.push(...vertex.norm);
  //     colors.push(...vertex.color);
  //   }




  //   geometry.setIndex(indicies);
  //   geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
  // 	geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
  // 	geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
  //   const material = new THREE.MeshBasicMaterial( {
  //     side: THREE.DoubleSide,
  //     transparent: true,
  //     vertexColors: true,
  //     opacity: .5
  //   } );



  //   let mesh = new THREE.Mesh( geometry, material );    
  //   this.warp_layer_map_scene.add(mesh);
  //   this.warp_layer_map_scene = this.applyOrientationConversion( this.warp_layer_map_scene, boundary_vtx);
  // 	scene.add(  this.warp_layer_map_scene );

  // }

  // drawTopology(scene, boundary_vtx){


  //   // console.log("LAYER MAP DRAWN")
  //   this.topo_scene =  new THREE.Group();
  //   const geometry = new THREE.BufferGeometry();
  //   let alldata = [];
  //   let positions = [];
  //   let colors = [];
  //   let normals = [];
  //   let indicies = [];


  //   const topo = this.currentSim.topo;
  //   const sim = this.currentSim.sim;
  //   const yarn_height = sim.warp_spacing;

  //   const lut = new Lut();
  //   const range = 10;

  //   lut.setColorMap( 'rainbow', 10);

  //   topo.forEach((vtx, x) => {
  //     const r = 0.5 + ( vtx.z_pos / range );
  //     const col = lut.getColor(r);
  //     // let z = vtx.z_pos * sim.layer_spacing;

  //     // let z = -10 + vtx.z_pos;
  //     let z = -1;
  //     alldata.push({
  //       pos: [sim.warp_spacing*vtx.j_left+2, yarn_height*vtx.i_bot+2, z],
  //       norm: [0, 1, 0],
  //       color: [col.r, col.g, col.b]
  //     });

  //     alldata.push({
  //       pos: [sim.warp_spacing*vtx.j_right+sim.warp_spacing-2, yarn_height*vtx.i_bot+2, z],
  //       norm: [0, 1, 0],
  //       color: [col.r, col.g, col.b]
  //     })

  //     alldata.push({
  //       pos: [sim.warp_spacing*vtx.j_left+2,yarn_height*vtx.i_top+yarn_height-2, z],
  //       norm: [0, 1, 0],
  //       color: [col.r, col.g, col.b]
  //     });

  //     alldata.push({
  //       pos: [sim.warp_spacing*vtx.j_right+sim.warp_spacing-2, yarn_height*vtx.i_top+yarn_height-2, z],
  //       norm: [0, 1, 0],
  //       color: [col.r, col.g, col.b]
  //     });

  //     let starting_index = x*4;

  //     indicies =  indicies.concat([
  //       starting_index+2,starting_index+0,starting_index+3,starting_index+1,starting_index+3,starting_index+0
  //     ]);

  //   })


  //   for (const vertex of alldata) {
  //     positions.push(...vertex.pos);
  //     normals.push(...vertex.norm);
  //     colors.push(...vertex.color);
  //   }


  //   geometry.setIndex(indicies);
  //   geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
  // 	geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
  // 	geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
  //   const material = new THREE.MeshBasicMaterial( {
  //     side: THREE.DoubleSide,
  //     transparent: true,
  //     vertexColors: true,
  //     opacity: .5,
  //     wireframe: true
  //   } );



  //   let mesh = new THREE.Mesh( geometry, material );
  //   this.topo_scene.add(mesh);
  //   this.topo_scene = this.applyOrientationConversion(  this.topo_scene, boundary_vtx);
  // 	scene.add(  this.topo_scene );

  // }


  applyOrientationConversion(object, boundary_vtx) {
    const trans = new THREE.Matrix4();

    let width = boundary_vtx.max_x - boundary_vtx.min_x;
    let height = boundary_vtx.max_y - boundary_vtx.min_y;

    trans.makeTranslation(-(boundary_vtx.min_x + width / 2), (boundary_vtx.min_y + height / 2), 0);
    object.applyMatrix4(trans);


    const quaternion = new THREE.Quaternion();

    //rotate around the x axis to match draft orientation in top left
    quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    object.applyQuaternion(quaternion);

    // quaternion.setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), Math.PI );
    // curveObject.applyQuaternion(quaternion);

    return object;
  }

  // drawEndCaps(scene,simdata: SimulationData, selection: Bounds, boundary_vtx: any ){

  //   const vtxs = simdata.vtxs;
  //   const draft = simdata.draft;
  //   const bounds = selection;
  //   const ms = simdata.sim.ms;



  //   if(vtxs.warps.length <= 0) return;


  //   //DRAW WARP ENDS
  //   let in_bounds_warps = vtxs.warps.filter(el => el.length > 0 && el[0].j >= bounds.topleft.x && el[0].j < bounds.topleft.x + bounds.width);

  //   in_bounds_warps.forEach((warp, ndx) => {

  //     let j = ndx + bounds.topleft.x;


  //     if(warp.length > 0){

  //       let start_vtx = this.getClosestVtx(simdata, bounds, true, bounds.topleft.y, j);
  //       let end_vtx = this.getClosestVtx(simdata, bounds, true, bounds.topleft.y + bounds.height, j);


  //     const material_id = draft.colShuttleMapping[j];
  //     let diameter = ms.getDiameter(material_id);
  //     const color = this.ms.getColorForSim(material_id)


  //     const top_geometry = new THREE.CircleGeometry( diameter/2, 32 );
  //     top_geometry.rotateX(Math.PI/2);



  //     if(start_vtx !== null) top_geometry.translate(start_vtx.x, boundary_vtx.min_y-10, -start_vtx.z);
  //     const material = new THREE.MeshBasicMaterial( { color: color } );
  //     let end_circle = new THREE.Mesh( top_geometry, material );
  //     this.warp_scene.add(end_circle);


  //     const bot_geometry = new THREE.CircleGeometry(  diameter/2, 32 );
  //     bot_geometry.rotateX(3*Math.PI/2);
  //     if(end_vtx !== null) bot_geometry.translate(end_vtx.x, boundary_vtx.max_y+10, -end_vtx.z);
  //     let top_circle = new THREE.Mesh( bot_geometry, material );
  //     // top_circle.tranlsateY(-top/2);
  //     // top_circle.tranlsateX(-right/2);
  //     this.warp_scene.add( top_circle );
  //     }

  //   })


  //   let in_bounds_wefts = vtxs.wefts.filter((el, ndx) => ndx >= bounds.topleft.y && ndx < bounds.topleft.y + bounds.height);


  //  in_bounds_wefts.forEach((weft, ndx) => {

  //     let in_range = weft.filter(el => el.j >= bounds.topleft.x && el.j < bounds.topleft.x + bounds.width);

  //     let i = ndx + bounds.topleft.y;

  //     if(weft.length > 0){
  //       let start_vtx = this.getClosestVtx(simdata, bounds, false, i, bounds.topleft.x);
  //       let end_vtx = this.getClosestVtx(simdata, bounds, false, i, bounds.topleft.x + bounds.width);

  //     const material_id = draft.rowShuttleMapping[i];
  //     let diameter = ms.getDiameter(material_id);
  //     const color = this.ms.getColorForSim(material_id)

  //     const top_geometry = new THREE.CircleGeometry(  diameter/2, 32 );
  //     top_geometry.rotateY(3*Math.PI/2);
  //     if(start_vtx !== null) top_geometry.translate(boundary_vtx.min_x-10, start_vtx.y,-start_vtx.z);
  //     const material = new THREE.MeshBasicMaterial( { color: color } );
  //     let end_circle = new THREE.Mesh( top_geometry, material );

  //     this.weft_scene.add(end_circle);

  //     const bot_geometry = new THREE.CircleGeometry( diameter/2, 32 );
  //     bot_geometry.rotateY(Math.PI/2);
  //     if(end_vtx !== null) bot_geometry.translate(boundary_vtx.max_x+10, end_vtx.y, -end_vtx.z);
  //     let top_circle = new THREE.Mesh( bot_geometry, material );
  //     this.weft_scene.add(top_circle);

  //     }

  //   })


  // }




}
