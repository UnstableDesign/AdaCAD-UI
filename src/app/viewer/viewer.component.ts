import { Component, Input, ViewChild, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CanvasList, Draft, DraftNode, RenderingFlags } from '../core/model/datatypes';
import { createDraft, getDraftAsImage, getDraftName, initDraft, warps, wefts } from '../core/model/drafts';
import { FilesystemService } from '../core/provider/filesystem.service';
import { MaterialsService } from '../core/provider/materials.service';
import { TreeService } from '../core/provider/tree.service';
import { SimulationComponent } from './simulation/simulation.component';
import { AuthService } from '../core/provider/auth.service';
import { ZoomService } from '../core/provider/zoom.service';
import { RenderService } from '../core/provider/render.service';
import { DraftRenderingComponent } from '../core/ui/draft-rendering/draft-rendering.component';
import { ViewerService } from '../core/provider/viewer.service';

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss']
})
export class ViewerComponent {

  @Output() onOpenEditor: any = new EventEmitter();
  @Output() onDraftRename: any = new EventEmitter();
  @Output() onSave: any = new EventEmitter();
  @Output() onForceFocus: any = new EventEmitter();

  @ViewChild(SimulationComponent) sim;
  @ViewChild('view_rendering') view_rendering: DraftRenderingComponent;

  draft_canvas: HTMLCanvasElement;
  draft_cx: any;
  pixel_ratio: number = 1;
  draft_name: string = '';
  vis_mode: string = 'color'; //sim, draft, structure, color
  view_expanded: boolean = false;
  filename: string = '';

  warps: number = 0;
  wefts: number = 0;
  scale: number = 0;
  id: number = -1;


  constructor(
    public auth: AuthService,
    public files: FilesystemService, 
    private ms: MaterialsService,
    private render: RenderService,
    private tree: TreeService,
    public vs: ViewerService,
    public zs: ZoomService){

      this.vs.showing_id_change$.subscribe(data => {
        this.id = data;
        this.redraw(this.id);
      })

      this.vs.update_viewer$.subscribe(data => {
        this.redraw(this.id);
      })

  }

ngOnInit(){
  this.filename = this.files.getCurrentFileName();
  this.scale = this.zs.getViewerZoom();
}


getVisVariables(){
  switch(this.vis_mode){
    case 'sim':
    case 'draft':
      return {use_colors: false, floats: false};
    case 'structure':
      return {use_colors: false, floats: true};
    case 'color':
      return {use_colors: true, floats: true};
  }
}


  updateDraftName(){
    if(this.id == -1) return;
    const draft = this.tree.getDraft(this.id);
    draft.ud_name = this.draft_name;
    this.onDraftRename.emit(this.id);
    //broadcast that this changed. 
  }

  /**
   * redraws the current draft, usually following an update from the drawdown
   */
  redraw(id: number){
    this.id = id;    
    const draft = this.tree.getDraft(this.id);

    if(draft !== null){
      this.warps = warps(draft.drawdown);
      this.wefts = wefts(draft.drawdown);
    }

    if(this.vis_mode != 'sim') {
      this.drawDraft(this.id);        
      this.centerScrollbars();
  } else this.sim.loadNewDraft(this.id);
 
}


  centerScrollbars(){
    // let div = document.getElementById('static_draft_view');
    // let rect = document.getElementById('viewer-scale-container').getBoundingClientRect();
    // div.scrollTop = div.scrollHeight/2;
    // div.scrollLeft = div.scrollWidth/2;
    // div.scrollTo({
    //   top: rect.height/2,
    //   left: rect.width/2
    // })
  }

  filenameChange(){
    const id = this.files.getCurrentFileId();
    this.files.renameFile(id, this.filename);
  }


  viewAsSimulation(){
    this.vis_mode = 'sim';
    this.sim.loadNewDraft(this.id);

  }

  viewAsDraft(){
    this.vis_mode = 'draft';
    this.redraw(this.id);   
  }

  viewAsStructure(){
    this.vis_mode = 'structure';
    this.redraw(this.id);   
  }

  viewAsColor(){
    this.vis_mode = 'color';
    this.redraw(this.id);   
  }



  openEditor(){
    this.onOpenEditor.emit(this.id);
  }

  togglePin(){
    if(this.vs.hasPin() && this.vs.getPin() == this.id){
      this.vs.clearPin();
    }else{
      this.vs.setPin(this.id);
    }
  }


  clearView(){

    this.view_rendering.clearAll();
    this.draft_name = 'no draft selected';
    this.warps = 0; 
    this.wefts = 0;
  }

  saveAs(format: string){
    this.onSave.emit(format);
  }

  //when expanded, someone can set the zoom from the main zoom bar
  //this is called, then, to rescale the view
  zoomChange(){
    

    if(this.id == -1) return;
    this.scale = this.zs.getViewerZoom();
    this.view_rendering.scale = this.scale;
    this.view_rendering.rescale(this.scale);
    //TO DO re-enable this but figure out where it is being called from
    //this.drawDraft(this.id);
  }

  /**
   * draw whatever is stored in the draft object to the screen
   * @returns 
   */
  async drawDraft(id: number) : Promise<any> {

    if(id === -1){
      this.clearView();
      return Promise.resolve(false);
    }

    const draft:Draft = this.tree.getDraft(id);
    this.draft_name = getDraftName(draft);

    if(draft == null || draft == undefined){
      this.clearView();
      return Promise.resolve(false);
    }


    let flags =  {
      drawdown: true, 
      use_colors: (this.vis_mode == 'color'),
      use_floats: (this.vis_mode !== 'draft'), 
      show_loom: false
    }

    //console.log("REDRAW CALLED FROM VIEW RENDERING")
    return this.view_rendering.redraw(draft, null, null, flags).then(el => {
      return Promise.resolve(true);
    })

   
    
   }

  }




