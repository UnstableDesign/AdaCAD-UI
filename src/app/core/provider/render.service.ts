import { Injectable } from '@angular/core';
import {defaults} from '../../core/model/defaults'
import { CanvasList, Draft, Loom, LoomSettings, RenderingFlags } from '../../core/model/datatypes';
import { getDraftAsImage, isSet, isUp, warps, wefts } from '../../core/model/drafts';
import { SystemsService } from '../../core/provider/systems.service';
import { MaterialsService } from './materials.service';
import { WorkspaceService } from './workspace.service';
import { numFrames, numTreadles } from '../model/looms';

@Injectable({
  providedIn: 'root'
})

/**
 * this service manages drawing the draft and looms across the different components including: 
 * editor, viewer, and mixer. 
 */
export class RenderService {
// view_frames: boolean;

current_view: string;
  
view_front: boolean;

// visibleRows: Array<number>; 

zoom: number;

draft_cell_size: number;






  constructor(
    private ss: SystemsService,
    private ms: MaterialsService,
    private ws: WorkspaceService
    ) { 
 //max values
  this.draft_cell_size = defaults.draft_detail_cell_size; 
  this.current_view = 'draft';
  this.view_front = true;

  }


  /**
   * given the ndx, get the next visible row or -1 if there isn't a next
   * @param ndx 
   */
  // getNextVisibleRow(ndx: number) : number {

  //   const next: number = ndx ++;
  //   if(next >= this.visibleRows.length) return -1;

  //   return this.visibleRows[next];

  // }

  

  // updateVisible(draft: Draft) {

  //   this.visibleRows = 
  //     draft.rowSystemMapping.map((val, ndx) => {
  //       return (this.ss.weftSystemIsVisible(val)) ? ndx : -1;  
  //     })
  //     .filter(el => el !== -1);

  // }



   /**
   * the canvas object is limited in how many pixels it can render. Adjust the draft cell size based on the number of cells in the draft
   * @param draft 
   */
   calculateCellSize(draft: Draft): number{

    let max_bound = Math.max(wefts(draft.drawdown), warps(draft.drawdown));
    if(max_bound*this.draft_cell_size < 4096){
      return Math.floor(this.draft_cell_size);
    }else if(max_bound < 4096){
      return  Math.floor(4096/max_bound);
    }else{
      this.draft_cell_size = 1;
      return 1;
    }

  }

 


  private drawWeftData(draft: Draft, cell_size: number, pixel_ratio: number, weft_systems_canvas: HTMLCanvasElement, weft_mats_canvas: HTMLCanvasElement) : Promise<string>{

    if(weft_systems_canvas == null || weft_mats_canvas == null){
      return Promise.resolve('weft materials or systems canvas was null')
    }
    const weft_systems_cx = weft_systems_canvas.getContext("2d");
    const weft_mats_cx = weft_mats_canvas.getContext("2d");

    if(draft == null){
      return Promise.resolve('draft null in drawWeftData')
    }

    if(draft.rowShuttleMapping == null || draft.rowSystemMapping == null){
      return Promise.resolve('rowShuttleMapping or rowSystemMapping null in drawWeftData')
    }else{


      weft_systems_canvas.height = draft.rowSystemMapping.length * cell_size * pixel_ratio;
      weft_systems_canvas.width = defaults.draft_detail_cell_size * pixel_ratio
      weft_systems_canvas.style.height = (draft.rowSystemMapping.length * cell_size)+"px";
      weft_systems_canvas.style.width = defaults.draft_detail_cell_size+"px";
      weft_mats_canvas.height = draft.rowShuttleMapping.length * cell_size * pixel_ratio;
      weft_mats_canvas.width =  defaults.draft_detail_cell_size*pixel_ratio;
      weft_mats_canvas.style.height =(draft.rowShuttleMapping.length * cell_size)+"px";
      weft_mats_canvas.style.width =  defaults.draft_detail_cell_size+"px";
      let system = null;

      for (let j = 0; j < draft.rowShuttleMapping.length; j++) {

        system = this.ss.getWeftSystemCode(draft.rowSystemMapping[j]);
        let color = this.ms.getColor(draft.rowShuttleMapping[j]);
        weft_mats_cx.fillStyle = color;
        weft_mats_cx.strokeStyle = "#666666";
        weft_mats_cx.fillRect(1, j* cell_size*pixel_ratio+1,  defaults.draft_detail_cell_size*pixel_ratio-2,  cell_size*pixel_ratio-2);
        weft_mats_cx.strokeRect(1, j* cell_size*pixel_ratio+1,  defaults.draft_detail_cell_size*pixel_ratio-2,  cell_size*pixel_ratio-2);
        
        weft_systems_cx.font = 1.5*cell_size+"px Arial";
        weft_systems_cx.fillStyle = "#666666";

        weft_systems_cx.save();
        weft_systems_cx.translate(10,  (j+1)*cell_size*pixel_ratio - 10);
        let tx = this.getTransform('weft-systems');
        weft_systems_cx.transform(tx[0], tx[1], tx[2], tx[3], tx[4], tx[5]);
        weft_systems_cx.textAlign = "center";
        weft_systems_cx.fillText(system, 0, 0);
        weft_systems_cx.restore();




       }
      }
    return Promise.resolve('')
    

  }

  private drawWarpData(draft: Draft, cell_size: number, pixel_ratio: number, warp_sys_canvas: HTMLCanvasElement, warp_mats_canvas: HTMLCanvasElement) : Promise<string>{

    if(warp_mats_canvas == null || warp_sys_canvas == null){
      return Promise.resolve('warp materials or systems canvas was null')
    }

    const warp_mats_cx = warp_mats_canvas.getContext("2d");
    const warp_systems_cx = warp_sys_canvas.getContext("2d");

    if(draft == null){
      return Promise.resolve('draft null in drawWarpData')
    }

    if(draft.colShuttleMapping == null || draft.colSystemMapping == null){
      return Promise.resolve('colShuttleMapping or colSystemMapping null in drawWarpData')
    }else{

      warp_mats_canvas.width = draft.colShuttleMapping.length * cell_size * pixel_ratio;
      warp_mats_canvas.height =  defaults.draft_detail_cell_size * pixel_ratio;
      warp_mats_canvas.style.width = (draft.colShuttleMapping.length * cell_size)+"px";
      warp_mats_canvas.style.height =  defaults.draft_detail_cell_size+"px";
  
      warp_sys_canvas.width = draft.colSystemMapping.length * cell_size * pixel_ratio;
      warp_sys_canvas.height =  defaults.draft_detail_cell_size * pixel_ratio;
      warp_sys_canvas.style.width = (draft.colSystemMapping.length * cell_size)+"px";
      warp_sys_canvas.style.height =  defaults.draft_detail_cell_size+"px";

       let system = null;

      for (let j = 0; j < draft.colShuttleMapping.length; j++) {
        let color = this.ms.getColor(draft.colShuttleMapping[j]);
        system = this.ss.getWarpSystemCode(draft.colSystemMapping[j]); 
      
        //cell_size *= this.pixel_ratio
        warp_mats_cx.fillStyle = color;
        warp_mats_cx.strokeStyle = "#666666";
        warp_mats_cx.fillRect(j* cell_size*pixel_ratio+1, 1,  cell_size*pixel_ratio-2,  defaults.draft_detail_cell_size*pixel_ratio-2);
        warp_mats_cx.strokeRect(j* cell_size*pixel_ratio+1, 1,  cell_size*pixel_ratio-2,  defaults.draft_detail_cell_size*pixel_ratio-2);
        //need to flip this on certain origins. 
        warp_systems_cx.font = 1.5*cell_size+"px Arial";
        warp_systems_cx.fillStyle = "#666666";

        warp_systems_cx.save();
        warp_systems_cx.translate(j*cell_size*pixel_ratio+10 ,  defaults.draft_detail_cell_size*pixel_ratio-5);
        let tx = this.getTransform('warp-systems');
        warp_systems_cx.transform(tx[0], tx[1], tx[2], tx[3], tx[4], tx[5]);
        warp_systems_cx.textAlign = "center";
        warp_systems_cx.fillText(system, 0, 0);
        warp_systems_cx.restore();



      
      }
    }

    return Promise.resolve('');
    

  }


/**
 * this function draws a single cell on either the threading, tieup or treadling and also handles the transformation of the type based on the current workspace view
 * @param draft 
 * @param loom 
 * @param loom_settings 
 * @param cell_size 
 * @param cx 
 * @param i 
 * @param j 
 * @param type 
 */
private drawLoomCell(loom: Loom, loom_settings: LoomSettings, cell_size: number, cx:any, i:number, j:number, type:string){
  
      var is_up = false;
  
      switch(type){

        case 'threading':
          var frame = loom.threading[j];
          is_up = (frame == i);
  
        break;
        case 'tieup':
          is_up = (loom.tieup[i][j]);
        break;
        case 'treadling':
          is_up = (loom.treadling[i].find(el => el == j)) !== undefined;  
        break;
  
      }
  
      cx.fillStyle = "#333333";
      cx.fillRect(j*cell_size, i*cell_size,cell_size, cell_size);

      cx.font = cell_size/2+"px Arial";
      cx.fillStyle = "white";

      let number_val = -1;
      if(type == "threading") number_val = i+1;
      else if(type == "treadling") number_val = j+1 ;
      else if(type == "tieup") number_val = i+1 ;


      let y_margin = 0;

      if(type == "threading"){
        y_margin = (this.ws.selected_origin_option == 1 || this.ws.selected_origin_option == 2 ) ? 3/4 : 1/4;
      }

      if(type == "treadling"){
        y_margin = (this.ws.selected_origin_option == 1 || this.ws.selected_origin_option == 2 ) ? 1/4 : 3/4;
      }

      if(type == "tieup"){
        y_margin = (this.ws.selected_origin_option == 1 || this.ws.selected_origin_option == 2 ) ? 3/4 : 1/4;
      }

      cx.save();
      cx.translate(cell_size*(j + 1/2) , cell_size*(i + y_margin));
      let tx = this.getTransform(type);
      cx.transform(tx[0], tx[1], tx[2], tx[3], tx[4], tx[5]);
      cx.textAlign = "center";
      cx.fillText(number_val, 0, 0);
      cx.restore();
        
      
  
    }

  private getTransform(target: string) : Array<number> {
    switch(this.ws.selected_origin_option){
     case 0: 
     if(target == 'threading'){
       return [-1, 0, 0, -1, 0,  0];
     }
     if(target == 'treadling'){
       return [1, 0, 0, 1, 0,  0];
     }
     if(target == 'tieup'){
       return [1, 0, 0, -1, 0,  0];
     }
     if(target == 'warp-systems'){
      return [-1, 0, 0, 1, 0,  0];
    }
    if(target == 'weft-systems'){
      return [1, 0, 0, 1, 0,  0];
    }
     break;
 
     case 1: 
     if(target == 'threading'){
       return [-1, 0, 0, 1, 0,  0];
     }
     if(target == 'treadling'){
       return [1, 0, 0, -1, 0,  0];
     }
     if(target == 'tieup'){
       return [1, 0, 0, 1, 0,  0];
     }
     if(target == 'warp-systems'){
      return [-1, 0, 0, 1, 0,  0];
    }
    if(target == 'weft-systems'){
      return [1, 0, 0, -1, 0,  0];
    }
     break;
 
     case 2: 
     if(target == 'threading'){
       return [1, 0, 0, 1, 0,  0];
     }
     if(target == 'treadling'){
       return [-1, 0, 0, -1, 0,  0];
     }
     if(target == 'tieup'){
       return [-1, 0, 0, 1, 0,  0];
     }
     if(target == 'warp-systems'){
      return [1, 0, 0, 1, 0,  0];
    }
    if(target == 'weft-systems'){
      return [1, 0, 0, -1, 0,  0];
    }
     break;
 
     case 3: 
       if(target == 'threading'){
         return [1, 0, 0,-1, 0, 0];
       }
       if(target == 'treadling'){
         return [-1, 0, 0, 1, 0,  0];
       }
       if(target == 'tieup'){
         return [-1, 0, 0,-1, 0, 0];
       }
       if(target == 'warp-systems'){
        return [1, 0, 0, 1, 0,  0];
      }
      if(target == 'weft-systems'){
        return [1, 0, 0, 1, 0,  0];
      }
       break;
 
    }
   }

    /**
   * Draws the grid lines onto the canvas.
   * @extends WeaveDirective
   * @returns {void}
   */
  private drawGrid(cx: any, canvas:HTMLCanvasElement, cell_size: number, pixel_ratio:number) {

    var dims = {w: 0, h: 0};
    dims.w = cell_size * pixel_ratio;
    dims.h = cell_size * pixel_ratio;

    cx.fillStyle="black";
    cx.lineWidth = 3;
    cx.lineCap = 'round';
    cx.strokeStyle = '#666';


    cx.fillStyle = "white";
    cx.fillRect(0,0,canvas.width,canvas.height);

      
      //draw vertical lines
      for (let i = 0; i <= canvas.width; i += dims.w) {

            cx.beginPath();
            cx.moveTo(i, 0);
            cx.lineTo(i, canvas.height);
            cx.stroke();
       }

      // // draw horizontal lines
      for (let i = 0; i <= canvas.height; i += dims.h) {

          cx.beginPath();
          cx.moveTo(0, i);
          cx.lineTo(canvas.width, i);
          cx.stroke();
        
      }

    
  }


 
   public drawThreading(loom:Loom, loom_settings:LoomSettings, canvas: HTMLCanvasElement, cell_size: number, pixel_ratio: number, show_loom: boolean) : Promise<string>{

    if(canvas == null || canvas == undefined){
      return Promise.resolve('canvas null in drawThreading')
    }
    const threadingCx = canvas.getContext('2d');


    if(loom == null || loom.threading == null){
      threadingCx.clearRect(0,0, threadingCx.canvas.width, threadingCx.canvas.height);
      threadingCx.canvas.width = 0;
      threadingCx.canvas.height = 0;
      threadingCx.canvas.style.width =  "0px"
      threadingCx.canvas.style.height =  "0px"
     
      if(show_loom) return Promise.resolve('loom or threading is null in drawThreading');
      else return Promise.resolve('')

    }


    const frames = Math.max(numFrames(loom), loom_settings.frames);
    threadingCx.canvas.width = cell_size * loom.threading.length * pixel_ratio;
    threadingCx.canvas.height = cell_size * frames * pixel_ratio;
    threadingCx.canvas.style.width =  (cell_size * loom.threading.length)+ "px"
    threadingCx.canvas.style.height =  (cell_size * frames )+ "px"
    threadingCx.clearRect(0,0, threadingCx.canvas.width, threadingCx.canvas.height);

    this.drawGrid(threadingCx, canvas, cell_size, pixel_ratio);

    for (var j = 0; j < loom.threading.length; j++) {
      this.drawLoomCell(loom, loom_settings, cell_size*pixel_ratio, threadingCx, loom.threading[j], j, "threading");
    }

    return Promise.resolve('');

   }

   private drawTreadling(loom:Loom, loom_settings:LoomSettings, canvas: HTMLCanvasElement, cell_size: number, pixel_ratio: number, show_loom: boolean) : Promise<string>{

    if(canvas == null || canvas == undefined){
      return Promise.resolve('canvas null in drawTreadling')
    }


    const treadlingCx = canvas.getContext('2d');
    const treadles = Math.max(numTreadles(loom), loom_settings.treadles);

    if(loom == null || loom.treadling == null){
      treadlingCx.clearRect(0,0, treadlingCx.canvas.width, treadlingCx.canvas.height);
      treadlingCx.canvas.width = 0;
      treadlingCx.canvas.height = 0;
      treadlingCx.canvas.style.width =  "0px"
      treadlingCx.canvas.style.height =  "0px"
      if(show_loom) return Promise.resolve('loom or threading is null in drawTreadling');
      else return Promise.resolve('')
    }

    treadlingCx.canvas.width = cell_size * treadles * pixel_ratio;
    treadlingCx.canvas.height = cell_size * loom.treadling.length  * pixel_ratio;
    treadlingCx.canvas.style.width = (cell_size * treadles) + "px";
    treadlingCx.canvas.style.height = (cell_size * loom.treadling.length) + "px";
    treadlingCx.clearRect(0,0, treadlingCx.canvas.width, treadlingCx.canvas.height);

    this.drawGrid(treadlingCx, canvas, cell_size, pixel_ratio);

    for (var i = 0; i < loom.treadling.length; i++) {
      loom.treadling[i].forEach(cell => {
        this.drawLoomCell(loom, loom_settings, cell_size*pixel_ratio,  treadlingCx, i, cell, "treadling");
      })   
  }

    return Promise.resolve('');


  }

  private drawTieups( loom:Loom, loom_settings:LoomSettings, canvas: HTMLCanvasElement, cell_size: number, pixel_ratio: number, show_loom: boolean) : Promise<string>{

    if(canvas == null || canvas == undefined){
      return Promise.resolve('canvas null in drawTreadling')
    }

    const tieupCx = canvas.getContext('2d');
    const treadles = Math.max(numTreadles(loom), loom_settings.treadles);
    const frames = Math.max(numFrames(loom), loom_settings.frames);
    

    if(loom == null || loom.tieup == null){
      tieupCx.clearRect(0,0, tieupCx.canvas.width, tieupCx.canvas.height);
      tieupCx.canvas.width = 0;
      tieupCx.canvas.height = 0;
      tieupCx.canvas.style.width =  "0px"
      tieupCx.canvas.style.height =  "0px"
      if(show_loom) return Promise.resolve('loom or tieup is null in drawTieup');
      else return Promise.resolve('')
    }


    tieupCx.canvas.width = cell_size * treadles  * pixel_ratio;
    tieupCx.canvas.height = cell_size *frames  * pixel_ratio;
    tieupCx.canvas.style.width = (cell_size * treadles)+ "px";
    tieupCx.canvas.style.height = (cell_size *frames)+ "px";
    tieupCx.clearRect(0,0, tieupCx.canvas.width, tieupCx.canvas.height);
    
    this.drawGrid(tieupCx, canvas, cell_size, pixel_ratio);

   
    for (var i = 0; i < loom.tieup.length; i++) {
      for(var j = 0; j < loom.tieup[i].length; j++){
        if(loom.tieup[i][j]){
          this.drawLoomCell(loom, loom_settings,cell_size*pixel_ratio, tieupCx, i, j, "tieup");
        }
      }
    }

    return Promise.resolve('');

  }

  private drawDrawdown(draft: Draft, canvas: HTMLCanvasElement,  cell_size: number, pixel_ratio: number, rf: RenderingFlags) : Promise<string>{
    

    if(canvas == null || canvas == undefined){
      return Promise.resolve('drawdown canvas was null');
    }

    const draft_cx: any = canvas.getContext("2d");

    if(draft === null || draft.drawdown == null){
      canvas.width = 0;
      canvas.height = 0;
      canvas.style.width = "0px";
      canvas.style.height = "0px";
      return Promise.resolve('draft or drawdown was null');
    }else{

      canvas.width = warps(draft.drawdown)*cell_size * pixel_ratio;
      canvas.height = wefts(draft.drawdown)*cell_size * pixel_ratio;
      canvas.style.width = (warps(draft.drawdown)*cell_size)+"px";
      canvas.style.height = (wefts(draft.drawdown)*cell_size)+"px";
      
      let img = getDraftAsImage(draft, cell_size*pixel_ratio, rf.use_floats, rf.use_colors, this.ms.getShuttles());
      draft_cx.putImageData(img, 0, 0);
      return Promise.resolve('');
    }
  }


  /**
 * gets the default canvas width (before scaling) of rendering this draft in the current context 
 * which is used to make the canvas fit the scaled content
 */
  getBaseDimensions(draft: Draft, canvas: HTMLCanvasElement) : {width: number, height: number} {
    let cell_size = this.calculateCellSize(draft);
    let pixel_ratio = this.getPixelRatio(canvas);

    return {width: warps(draft.drawdown)*cell_size*pixel_ratio, 
        height: wefts(draft.drawdown) * cell_size * pixel_ratio};

  }



  
  getPixelRatio(canvas: HTMLCanvasElement){
    const draft_cx: any = canvas.getContext("2d");
    let dpr = window.devicePixelRatio || 1;
    let bsr =  draft_cx.webkitBackingStorePixelRatio ||
    draft_cx.mozBackingStorePixelRatio ||
    draft_cx.msBackingStorePixelRatio ||
    draft_cx.oBackingStorePixelRatio ||
    draft_cx.backingStorePixelRatio || 1;
    return dpr/bsr;
  }


  clear(canvases: CanvasList) : Promise<boolean> {

  let drawdownCx = canvases.drawdown.getContext('2d');
   drawdownCx.clearRect(0, 0, drawdownCx.canvas.width, drawdownCx.canvas.height );

   let threadingCx = canvases.threading.getContext('2d');
   threadingCx.clearRect(0, 0, threadingCx.canvas.width, threadingCx.canvas.height )

   let tieupCx = canvases.tieup.getContext('2d');
   tieupCx.clearRect(0, 0, tieupCx.canvas.width, tieupCx.canvas.height )

   let treadlingCx = canvases.treadling.getContext('2d');
   treadlingCx.clearRect(0, 0, treadlingCx.canvas.width, treadlingCx.canvas.height )

   let warpMatCx = canvases.warp_mats.getContext('2d');
   warpMatCx.clearRect(0, 0, warpMatCx.canvas.width, warpMatCx.canvas.height )

   let warpSysCx = canvases.warp_systems.getContext('2d');
   warpSysCx.clearRect(0, 0, warpSysCx.canvas.width, warpSysCx.canvas.height )

   let weftMatCx = canvases.weft_mats.getContext('2d');
   weftMatCx.clearRect(0, 0, weftMatCx.canvas.width, weftMatCx.canvas.height )

   let weftSysCx = canvases.weft_systems.getContext('2d');
   weftSysCx.clearRect(0, 0, weftSysCx.canvas.width, weftSysCx.canvas.height )


   return Promise.resolve(true);

  }

  /**
   * draw whatever is stored in the draft object to the screen
   * @returns 
   */
  async drawDraft(draft: Draft,  loom: Loom, loom_settings:LoomSettings, canvases: CanvasList, rf: RenderingFlags) : Promise<boolean> {
    let fns = [];
    // set the width and height
    let pixel_ratio = this.getPixelRatio(canvases.drawdown);
    let cell_size = this.calculateCellSize(draft);
    
    if(draft.drawdown.length == 0) return this.clear(canvases);

    if(rf.u_drawdown){
      fns = fns.concat(this.drawDrawdown(draft, canvases.drawdown, cell_size, pixel_ratio, rf));
    }

    if(rf.u_warp_mats || rf.u_warp_sys){
      fns = fns.concat(this.drawWarpData(draft, cell_size, pixel_ratio, canvases.warp_systems, canvases.warp_mats));
    }

    if(rf.u_weft_mats || rf.u_weft_sys){
      fns = fns.concat(this.drawWeftData(draft, cell_size, pixel_ratio, canvases.weft_systems, canvases.weft_mats));
    }

    if(rf.u_threading){
      fns = fns.concat(this.drawThreading(loom, loom_settings, canvases.threading, cell_size, pixel_ratio, rf.show_loom));
    }

    if(rf.u_treadling){
      fns = fns.concat(this.drawTreadling(loom, loom_settings, canvases.treadling, cell_size, pixel_ratio, rf.show_loom));
    }

    if(rf.u_tieups){
      fns = fns.concat(this.drawTieups(loom, loom_settings, canvases.tieup, cell_size, pixel_ratio, rf.show_loom));
    }

    return Promise.all(fns).then(errs => {

      errs.forEach(el => {
        if(el !== '') console.error(el);
      })

      return Promise.resolve(true);

    });

    
  }


  /**
   * when the parent div is rescaled on zoom in and out, the container does not change size unless the canvases change size as well. 
   * @param draft 
   * @param factor 
   * @param canvases 
   */
  rescale(draft: Draft, loom: Loom, loom_settings: LoomSettings, factor: number, canvases: CanvasList){
    let cell_size = this.calculateCellSize(draft);

    canvases.drawdown.style.width = (warps(draft.drawdown)*cell_size* factor)+"px";
    canvases.drawdown.style.height = (wefts(draft.drawdown)*cell_size* factor)+"px";

    if(loom !== null){
      let frames = Math.max(numFrames(loom), loom_settings.frames);
      let treadles = Math.max(numTreadles(loom), loom_settings.treadles);

      canvases.threading.style.width =  (cell_size * loom.threading.length)*factor+ "px"
      canvases.threading.style.height =  (cell_size * frames )*factor+ "px"

      canvases.treadling.style.width = (cell_size * treadles)*factor + "px";
      canvases.treadling.style.height = (cell_size * loom.treadling.length)*factor + "px";

      canvases.tieup.style.width = (cell_size * treadles)*factor+ "px";
      canvases.tieup.style.height = (cell_size *frames)*factor+ "px";


    }

    canvases.warp_mats.style.width = (draft.colShuttleMapping.length * cell_size)* factor+"px";
    canvases.warp_mats.style.height =  defaults.draft_detail_cell_size* factor+"px";


    canvases.warp_systems.style.width = (draft.colSystemMapping.length * cell_size* factor)+"px";
    canvases.warp_systems.style.height =  defaults.draft_detail_cell_size* factor+"px";

    canvases.weft_mats.style.height = (draft.rowSystemMapping.length * cell_size)*factor+"px";
    canvases.weft_mats.style.width = defaults.draft_detail_cell_size*factor+"px";

    canvases.weft_systems.style.height =(draft.rowShuttleMapping.length * cell_size)*factor+"px";
    canvases.weft_systems.style.width =  defaults.draft_detail_cell_size*factor+"px";

  }

  


  /**
   * given a canvas and a container, this view calculates how much the object should be scaled in order to fit into the canvas. 
   * @param container 
   * @param canvas 
   * @returns 
   */
getInitialTransform(container: HTMLElement,canvas: HTMLCanvasElement) : number{
 /* now recalc the scale based on the draft size: */
//  let div_draftviewer = document.getElementById('static_draft_view');
 let rect_viewer = container.getBoundingClientRect();

   let adj = 1;
   let canvas_width =  canvas.width;
   let canvas_height = canvas.height;


   //get the ration of the view to the item
   let width_adj = rect_viewer.width / canvas_width;
   let height_adj = rect_viewer.height / canvas_height;

   //make the zoom the larger of the width or height
   adj = Math.min(width_adj, height_adj);

   if(adj < 1){
    return adj;
     //canvas.style.transform = 'scale('+adj+')';
     // this.draft_canvas.width = (warps(draft.drawdown)*cell_size*adj);
     // this.draft_canvas.height = (wefts(draft.drawdown)*cell_size*adj);
     // this.draft_canvas.style.width = (warps(draft.drawdown)*cell_size*adj)+"px";
     // this.draft_canvas.style.height = (wefts(draft.drawdown)*cell_size*adj)+"px";
   } 
   else return 1;
 }
}






