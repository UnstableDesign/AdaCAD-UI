import { Injectable, inject } from '@angular/core';
import { Draft, getCellValue, initDraftFromDrawdown, warps, wefts } from 'adacad-drafting-lib';
import { Sequence } from 'adacad-drafting-lib/sequence';
import * as THREE from 'three';
import { Bounds, SimulationData, SimulationVars, YarnVertex } from '../model/datatypes';
import { defaults } from '../model/defaults';
import { createLayerMaps, getDraftTopology, translateTopologyToPoints } from '../model/yarnsimulation';
import { MaterialsService } from '../provider/materials.service';

@Injectable({
  providedIn: 'root'
})
export class SimulationService {
  private ms = inject(MaterialsService);


  hasSimulation: boolean = false;
  // currentSim: SimulationData  = null;

  warp_layer_map_scene: any;
  weft_layer_map_scene: any;
  warp_scene: any;
  weft_scene: any;
  axis_scene: any;
  topo_scene: any;
  draft_scene: any;


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

    this.hasSimulation = false;
  }

  private tileDraft(draft: Draft, boundary: number): Promise<Draft> {
    //extend to left and right top and bottom
    let pattern = new Sequence.TwoD();
    let weft_mats = new Sequence.OneD();
    let weft_sys = new Sequence.OneD();
    let warp_mats = new Sequence.OneD();
    let warp_sys = new Sequence.OneD();

    draft.drawdown.forEach((row, ndx) => {
      let seq = new Sequence.OneD().import(row);
      weft_mats.push(draft.rowShuttleMapping[ndx]);
      weft_sys.push(draft.rowSystemMapping[ndx]);

      if (ndx == 0) {
        warp_mats.import(draft.colShuttleMapping);
        warp_sys.import(draft.colSystemMapping)
      }

      //first, expand rows
      for (let i = 0; i < boundary; i++) {

        seq.push(getCellValue(row[i % row.length]));
        let from_end = (i % row.length);
        seq.unshift(getCellValue(row[(row.length - 1 - from_end)]))

        if (ndx == 0) {

          warp_mats.push(draft.colShuttleMapping[i % row.length]);
          warp_mats.unshift(draft.colShuttleMapping[(row.length - 1 - from_end)])
          warp_sys.push(draft.colSystemMapping[i % row.length]);
          warp_sys.unshift(draft.colSystemMapping[(row.length - 1 - from_end)])

        }

      }
      pattern.pushWeftSequence(seq.val());

    })


    let extended_pattern = new Sequence.TwoD().import(pattern.export());
    for (let i = 0; i < boundary; i++) {
      let offset = i % wefts(draft.drawdown);
      let row = pattern.getWeft(i % wefts(draft.drawdown));
      extended_pattern.pushWeftSequence(row);

      let ending_row = pattern.getWeft(wefts(draft.drawdown) - 1 - offset);
      extended_pattern.unshiftWeftSequence(ending_row);

      weft_mats.push(draft.rowShuttleMapping[i]);
      weft_sys.push(draft.rowSystemMapping[i]);
      weft_mats.unshift(draft.rowShuttleMapping[wefts(draft.drawdown) - 1 - offset]);
      weft_sys.unshift(draft.rowSystemMapping[wefts(draft.drawdown) - 1 - offset]);


    }

    const expanded_draft = initDraftFromDrawdown(extended_pattern.export());
    expanded_draft.colShuttleMapping = warp_mats.val();
    expanded_draft.colSystemMapping = warp_sys.val();
    expanded_draft.rowShuttleMapping = weft_mats.val();
    expanded_draft.rowSystemMapping = weft_sys.val();

    return Promise.resolve(expanded_draft);
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
   * generates a new simulation with the given draft and simulation parameters
   * @param draft 
   * @param sim 
   * @returns promise for simulation data
   */
  public generateSimulationData(draft: Draft, sim: SimulationVars): Promise<SimulationData> {

    if (!this.isAcceptableSize(draft)) return Promise.reject("size error");

    const currentSim: SimulationData = {
      draft: draft,
      sim: sim,
      topo: null,
      vtxs: null,
      layer_maps: null
    };


    return this.tileDraft(draft, sim.boundary).then(expandeddraft => {
      currentSim.draft = expandeddraft;
      return getDraftTopology(currentSim.draft, sim);
    })
      .then(
        topology => {
          currentSim.topo = topology;
          return createLayerMaps(currentSim.draft, topology, sim);
        }
      )
      .then(lm => {
        currentSim.layer_maps = lm;
        return translateTopologyToPoints(currentSim.draft, currentSim.topo, lm, sim);


      }).then(vtxs => {
        currentSim.vtxs = vtxs;
        return currentSim;
      })

  }

  public setupSimulation(renderer, scene, camera, controls) {



    const animate = function () {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
      controls.update();

    };

    controls.update();
    animate();

  }

  public snapToX(controls) {
    controls.target = new THREE.Vector3(200, 0, 0);
    controls.update();
  }



  public recalcSimData(scene, draft: Draft, warp_spacing: number, layer_spacing: number, layer_threshold: number, max_interlacement_width: number, max_interlacement_height: number, boundary: number, radius: number, ms: MaterialsService): Promise<SimulationData> {

    const sim: SimulationVars = {
      warp_spacing,
      layer_spacing,
      layer_threshold,
      max_interlacement_width,
      max_interlacement_height,
      boundary,
      radius,
      ms
    };

    return this.generateSimulationData(draft, sim)
      .then(simdata => {
        return simdata
      })
  }

  /**
   * called when a rendering value changes that does not require a full recalculation of the simulation data
   */
  public redrawCurrentSim(scene, draft: Draft) {

    //update warp material colors
    draft.colShuttleMapping.forEach((material_id, j) => {
      let color = this.ms.getColorForSim(material_id);
      const render_color = new THREE.Color(color);
      let warp_render = scene.getObjectByName('warp-' + j);
      warp_render.material.color.set(render_color);

    })

    draft.rowShuttleMapping.forEach((material_id, j) => {
      let color = this.ms.getColorForSim(material_id);
      const render_color = new THREE.Color(color);
      let weft_render = scene.getObjectByName('weft-' + j);
      weft_render.material.color.set(render_color);

    })





  }


  public renderSimdata(scene, selection: Bounds, simdata: SimulationData, warps: boolean, wefts: boolean, warp_layer: boolean, weft_layers: boolean, topo: boolean, show_draft: boolean): Promise<any> {
    this.hasSimulation = true;

    if (simdata.draft == null) return;

    //if no explicit selection has been made, use the default full boundary

    scene.clear();

    const light = new THREE.DirectionalLight(0xffffff, 1.0);
    const back_light = new THREE.DirectionalLight(0xffffff, 1.0);
    scene.add(light);
    scene.add(back_light);

    light.position.set(20, 0, 50);
    back_light.position.set(20, 0, -50);


    const boundary_vtx = this.getBoundaryVtxs(simdata, selection);


    this.drawAxis(scene, simdata, boundary_vtx);
    this.drawYarns(scene, simdata, selection, boundary_vtx);
    // this.drawEndCaps(scene, simdata, boundary_vtx);
    // this.drawWarpLayerMap(scene, boundary_vtx);
    // this.drawWeftLayerMap(scene, boundary_vtx);
    // this.drawTopology(scene, boundary_vtx);
    // this.drawDraft(scene, this.currentSim.draft, this.currentSim.sim, boundary_vtx);


    if (!wefts) this.hideWefts();
    if (!warps) this.hideWarps();
    if (!warp_layer) this.hideWarpLayerMap();
    if (!weft_layers) this.hideWeftLayerMap();
    if (!topo) this.hideTopo();
    if (!show_draft) this.hideDraft();

    return Promise.resolve()

  }

  drawAxis(scene, simdata: SimulationData, boundary_vtx: any) {

    this.axis_scene = new THREE.Group();

    //X AXIS 
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const points = [];
    points.push(new THREE.Vector3(boundary_vtx.min_x - 20, boundary_vtx.min_y - 20, 0));
    points.push(new THREE.Vector3(boundary_vtx.max_x + 20, boundary_vtx.min_y - 20, 0));

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    this.axis_scene.add(line);


    /**Y AXIS */
    const y_points = [];
    y_points.push(new THREE.Vector3(boundary_vtx.min_x - 20, boundary_vtx.min_y - 20, 0));
    y_points.push(new THREE.Vector3(boundary_vtx.min_x - 20, boundary_vtx.max_y + 20, 0));

    const y_geometry = new THREE.BufferGeometry().setFromPoints(y_points);
    const y_line = new THREE.Line(y_geometry, material);
    this.axis_scene.add(y_line);

    /**Z AXIS */
    const z_points = [];
    z_points.push(new THREE.Vector3(boundary_vtx.min_x - 20, boundary_vtx.min_y - 20, 0));
    z_points.push(new THREE.Vector3(boundary_vtx.min_x - 20, boundary_vtx.min_y - 20, 100));


    const z_geometry = new THREE.BufferGeometry().setFromPoints(z_points);
    const z_line = new THREE.Line(z_geometry, material);
    this.axis_scene.add(z_line);




    this.axis_scene = this.applyOrientationConversion(this.axis_scene, boundary_vtx);
    scene.add(this.axis_scene);


  }

  /**
   * given the vtx data and a boundary, this function returns the min/max values for wefts and warps to be used to position the start and end of the warp and weft data. 
   * @param simdata 
   * @returns 
   */
  getBoundaryVtxs(simdata: SimulationData, selection: Bounds): { min_x: number, max_x: number, min_y: number, max_y: number } {
    const vtxs = simdata.vtxs;

    if (vtxs == null) return;


    //get the weft boundary, draw warps from this data
    let in_bound_wefts = vtxs.wefts.filter((el, ndx) => (ndx >= selection.topleft.y && ndx < selection.topleft.y + selection.height));

    let min_y = in_bound_wefts.reduce((acc, row) => {
      let min_in_row = row.filter((vtx) => vtx.j >= selection.topleft.x && vtx.j < selection.topleft.x + selection.width).reduce((subacc, vtx) => {
        if (vtx.y < subacc) return vtx.y;
        return subacc;
      }, 10000);

      if (min_in_row < acc) return min_in_row;
      return acc;
    }, 100000);

    let max_y = in_bound_wefts.reduce((acc, row) => {
      let max_in_row = row.filter((vtx) => vtx.j >= selection.topleft.x && vtx.j < selection.topleft.x + selection.width).reduce((subacc, vtx) => {
        if (vtx.y > subacc) return vtx.y;
        return subacc;
      }, 0);

      if (max_in_row > acc) return max_in_row;
      return acc;
    }, 0);

    let min_x = in_bound_wefts.reduce((acc, row) => {
      let min_in_row = row.filter((vtx) => vtx.j >= selection.topleft.x && vtx.j < selection.topleft.x + selection.width).reduce((subacc, vtx) => {
        if (vtx.x < subacc) return vtx.x;
        return subacc;
      }, 10000);

      if (min_in_row < acc) return min_in_row;
      return acc;
    }, 100000);

    let max_x = in_bound_wefts.reduce((acc, row) => {
      let max_in_row = row.filter((vtx) => vtx.j >= selection.topleft.x && vtx.j < selection.topleft.x + selection.width).reduce((subacc, vtx) => {
        if (vtx.x > subacc) return vtx.x;
        return subacc;
      }, 0);

      if (max_in_row > acc) return max_in_row;
      return acc;
    }, 0);

    return { min_x, max_x, min_y, max_y };




  }

  getClosestVtx(simdata: SimulationData, selection: Bounds, warp: boolean, i: number, j: number): YarnVertex {

    if (warp) {
      let vtxs = simdata.vtxs.warps[j];
      let closest_ndx = vtxs.reduce((acc, vtx, ndx) => {
        if (Math.abs(vtx.i - i) < acc.dist) return { dist: Math.abs(vtx.i - i), ndx };
        return acc;
      }, { dist: 10000, ndx: -1 });
      if (closest_ndx.ndx == -1) return null;
      return vtxs[closest_ndx.ndx]
    } else {

      //on wefts 
      let vtxs = simdata.vtxs.wefts[i];
      let closest_ndx = vtxs.reduce((acc, vtx, ndx) => {
        if (vtx.j >= selection.topleft.x && vtx.j < (selection.topleft.x + selection.width) && Math.abs(vtx.j - j) < acc.dist) return { dist: Math.abs(vtx.j - j), ndx };
        return acc;
      }, { dist: 10000, ndx: -1 });
      if (closest_ndx.ndx == -1) return null;
      return vtxs[closest_ndx.ndx]
    }
  }

  /**
   * this renders the imagery of the yarns. It uses the boundary provided by 
   * @param scene 
   * @param simdata 
   */
  drawYarns(scene, simdata: SimulationData, selection: Bounds, boundary_vtx: any) {

    this.warp_scene = new THREE.Group();
    this.warp_scene.name = 'warp-scene'
    this.weft_scene = new THREE.Group();
    this.weft_scene.name = 'weft-scene'

    const vtxs = simdata.vtxs;
    const draft = simdata.draft;


    //DRAW THE WARPS
    for (let j = selection.topleft.x; j < selection.width + selection.topleft.x; j++) {
      const pts = [];


      if (vtxs.warps[j] !== undefined && vtxs.warps[j].length > 0 && vtxs.warps[j] !== undefined) {
        const material_id = draft.colShuttleMapping[j];
        let diameter = this.ms.getDiameter(material_id);
        let color = this.ms.getColorForSim(material_id);


        let in_bounds_vxts = simdata.vtxs.warps[j].filter(el => el.i >= selection.topleft.y && el.i < selection.topleft.y + selection.height);

        let start_vtx = this.getClosestVtx(simdata, selection, true, selection.topleft.y, j);
        let end_vtx = this.getClosestVtx(simdata, selection, true, selection.topleft.y + selection.height, j);


        if (start_vtx !== null) pts.push(new THREE.Vector3(start_vtx.x, boundary_vtx.min_y - 10, -start_vtx.z));
        in_bounds_vxts.slice().forEach(vtx => {
          if (vtx.x !== undefined) pts.push(new THREE.Vector3(vtx.x, vtx.y, -vtx.z));
        });
        if (end_vtx !== null) pts.push(new THREE.Vector3(end_vtx.x, boundary_vtx.max_y + 10, -end_vtx.z));


        if (pts.length !== 0) {

          const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .1);
          const geometry = new THREE.TubeGeometry(curve, 100, diameter / 2, 8, false);
          const material = new THREE.MeshPhysicalMaterial({
            color: color,
            depthTest: true,
            emissive: 0x000000,
            metalness: 0,
            roughness: 0.5,
            clearcoat: 1.0,
            clearcoatRoughness: 1.0,
            reflectivity: 0.0
          });

          let curveObject = new THREE.Mesh(geometry, material);
          curveObject.name = 'warp-' + (j - selection.topleft.x);

          this.warp_scene.add(curveObject);
        }
      }
    };

    this.warp_scene = this.applyOrientationConversion(this.warp_scene, boundary_vtx);
    scene.add(this.warp_scene);




    //draw wefts
    for (let i = selection.topleft.y; i < selection.height + selection.topleft.y; i++) {

      let weft_vtx_list = vtxs.wefts[i];

      let in_bound_vtxs = weft_vtx_list.filter(el => el.j >= selection.topleft.x && el.j < selection.width + selection.topleft.x);

      const pts = [];
      let start_vtx = this.getClosestVtx(simdata, selection, false, i, selection.topleft.x);
      let end_vtx = this.getClosestVtx(simdata, selection, false, i, selection.topleft.x + selection.width);


      if (start_vtx !== null) pts.push(new THREE.Vector3(boundary_vtx.min_x - 10, start_vtx.y, -start_vtx.z));

      in_bound_vtxs.forEach(vtx => {
        if (vtx.x !== undefined) {
          pts.push(new THREE.Vector3(vtx.x, vtx.y, -vtx.z));
        }
      });

      if (end_vtx !== null) pts.push(new THREE.Vector3(boundary_vtx.max_x + 10, end_vtx.y, -end_vtx.z));


      if (pts.length !== 0) {

        const material_id = draft.rowShuttleMapping[i];
        let diameter = this.ms.getDiameter(material_id);
        let color = this.ms.getColorForSim(material_id)

        const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .1);
        const geometry = new THREE.TubeGeometry(curve, 100, diameter / 2, 8, false);
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
        curveObject.name = 'weft-' + (i - selection.topleft.y);

        this.weft_scene.add(curveObject);
      }

    }

    this.weft_scene = this.applyOrientationConversion(this.weft_scene, boundary_vtx);
    scene.add(this.weft_scene);

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

  drawEndCaps(scene, simdata: SimulationData, selection: Bounds, boundary_vtx: any) {

    const vtxs = simdata.vtxs;
    const draft = simdata.draft;
    const bounds = selection;
    const ms = simdata.sim.ms;



    if (vtxs.warps.length <= 0) return;


    //DRAW WARP ENDS
    let in_bounds_warps = vtxs.warps.filter(el => el.length > 0 && el[0].j >= bounds.topleft.x && el[0].j < bounds.topleft.x + bounds.width);

    in_bounds_warps.forEach((warp, ndx) => {

      let j = ndx + bounds.topleft.x;


      if (warp.length > 0) {

        let start_vtx = this.getClosestVtx(simdata, bounds, true, bounds.topleft.y, j);
        let end_vtx = this.getClosestVtx(simdata, bounds, true, bounds.topleft.y + bounds.height, j);


        const material_id = draft.colShuttleMapping[j];
        let diameter = ms.getDiameter(material_id);
        const color = this.ms.getColorForSim(material_id)


        const top_geometry = new THREE.CircleGeometry(diameter / 2, 32);
        top_geometry.rotateX(Math.PI / 2);



        if (start_vtx !== null) top_geometry.translate(start_vtx.x, boundary_vtx.min_y - 10, -start_vtx.z);
        const material = new THREE.MeshBasicMaterial({ color: color });
        let end_circle = new THREE.Mesh(top_geometry, material);
        this.warp_scene.add(end_circle);


        const bot_geometry = new THREE.CircleGeometry(diameter / 2, 32);
        bot_geometry.rotateX(3 * Math.PI / 2);
        if (end_vtx !== null) bot_geometry.translate(end_vtx.x, boundary_vtx.max_y + 10, -end_vtx.z);
        let top_circle = new THREE.Mesh(bot_geometry, material);
        // top_circle.tranlsateY(-top/2);
        // top_circle.tranlsateX(-right/2);
        this.warp_scene.add(top_circle);
      }

    })


    let in_bounds_wefts = vtxs.wefts.filter((el, ndx) => ndx >= bounds.topleft.y && ndx < bounds.topleft.y + bounds.height);


    in_bounds_wefts.forEach((weft, ndx) => {

      let in_range = weft.filter(el => el.j >= bounds.topleft.x && el.j < bounds.topleft.x + bounds.width);

      let i = ndx + bounds.topleft.y;

      if (weft.length > 0) {
        let start_vtx = this.getClosestVtx(simdata, bounds, false, i, bounds.topleft.x);
        let end_vtx = this.getClosestVtx(simdata, bounds, false, i, bounds.topleft.x + bounds.width);

        const material_id = draft.rowShuttleMapping[i];
        let diameter = ms.getDiameter(material_id);
        const color = this.ms.getColorForSim(material_id)

        const top_geometry = new THREE.CircleGeometry(diameter / 2, 32);
        top_geometry.rotateY(3 * Math.PI / 2);
        if (start_vtx !== null) top_geometry.translate(boundary_vtx.min_x - 10, start_vtx.y, -start_vtx.z);
        const material = new THREE.MeshBasicMaterial({ color: color });
        let end_circle = new THREE.Mesh(top_geometry, material);

        this.weft_scene.add(end_circle);

        const bot_geometry = new THREE.CircleGeometry(diameter / 2, 32);
        bot_geometry.rotateY(Math.PI / 2);
        if (end_vtx !== null) bot_geometry.translate(boundary_vtx.max_x + 10, end_vtx.y, -end_vtx.z);
        let top_circle = new THREE.Mesh(bot_geometry, material);
        this.weft_scene.add(top_circle);

      }

    })


  }




}

