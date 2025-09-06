import { AfterViewInit, Component, EventEmitter, Input, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { DraftNode } from '../../../core/model/datatypes';
import { Draft, getDraftName, warps, wefts } from 'adacad-drafting-lib';
import { DesignmodesService } from '../../../core/provider/designmodes.service';
import { FileService } from '../../../core/provider/file.service';
import { MaterialsService } from '../../../core/provider/materials.service';
import { RenderService } from '../../../core/provider/render.service';
import { SystemsService } from '../../../core/provider/systems.service';
import { TreeService } from '../../../core/provider/tree.service';
import { WorkspaceService } from '../../../core/provider/workspace.service';
import { DraftRenderingComponent } from '../../../core/ui/draft-rendering/draft-rendering.component';
import { ViewerService } from '../../../core/provider/viewer.service';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { RenameComponent } from '../../../core/ui/rename/rename.component';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatSlider, MatSliderThumb } from '@angular/material/slider';
import { MatTooltip } from '@angular/material/tooltip';
import { saveAsBmp, saveAsPrint, saveAsWif } from '../../../core/helpers';

@Component({
    selector: 'app-draftcontainer',
    templateUrl: './draftcontainer.component.html',
    styleUrls: ['./draftcontainer.component.scss'],
    imports: [MatButton, MatSlider, MatSliderThumb, MatMenu, MatMenuItem, MatTooltip, MatIconButton, MatMenuTrigger, DraftRenderingComponent]
})
export class DraftContainerComponent implements AfterViewInit{
  private dialog = inject(MatDialog);
  private dm = inject(DesignmodesService);
  private ms = inject(MaterialsService);
  private fs = inject(FileService);
  tree = inject(TreeService);
  render = inject(RenderService);
  private ss = inject(SystemsService);
  private vs = inject(ViewerService);
  ws = inject(WorkspaceService);


  @Input() id;
  @Input() dirty;
  @Input() hasParent;
  @Input() selecting_connection;
  @Output() connectionSelected = new EventEmitter();
  @Output() onDuplicateCalled = new EventEmitter();
  @Output() onDeleteCalled = new EventEmitter();
  @Output() onOpenInEditor = new EventEmitter();
  @Output() onRecomputeChildren = new EventEmitter();
  @Output() onDrawdownSizeChanged = new EventEmitter();
  @Output() onNameChanged = new EventEmitter();
 
  @ViewChild('bitmapImage') bitmap: any;
  @ViewChild('draft_rendering') draft_rendering: 
  DraftRenderingComponent;
  @ViewChild(MatMenuTrigger) trigger: MatMenuTrigger;



  draft_cell_size: number = 40;

  exceeds_size: boolean = false;

  warps: number; 

  wefts: number;

  draft_visible: boolean = true;

  use_colors: boolean = true;

  outlet_connected: boolean = true;

  draft_name: string = "";

  local_zoom: number = 1;

  current_view: string = 'draft';

  size_observer: any;



  constructor(){

    //subscribe to id changes on the view service to update view if this is current selected
    this.vs.showing_id_change$.subscribe(data => {
      this.updateStyle(data);

    })

  }

  ngOnInit(){
  }

  ngAfterViewInit() {


    const draft = this.tree.getDraft(this.id);
    this.warps = warps(draft.drawdown);
    this.wefts = wefts(draft.drawdown);

    this.outlet_connected = (this.tree.getNonCxnOutputs(this.id).length > 0);
    this.draft_name = this.tree.getDraftName(this.id);
    this.local_zoom = this.tree.getDraftScale(this.id);
    this.draft_visible = this.tree.getDraftVisible(this.id);
    
    this.draft_rendering.onNewDraftLoaded(this.id);
    this.drawDraft(draft);  
   
    this.startSizeObserver();

  }

  rename(event){
    const dialogRef = this.dialog.open(RenameComponent, {data: {id: this.id}
    });

  dialogRef.afterClosed().subscribe(obj => {
    this.draft_name = this.tree.getDraftName(this.id);
    this.onNameChanged.emit(this.id);
 });
  }

  onDoubleClick(){
    this.trigger.openMenu();
  }

  updateStyle(viewer_id: number){
    const targetNode = document.getElementById("subdraft-container-"+this.id);
    if(targetNode == null) return;

    if(this.id == viewer_id){
      targetNode.classList.add('on_view');
    }else{
      targetNode.classList.remove('on_view');
    }

    if(this.id == this.vs.getPin()){
      targetNode.classList.add('has_pin');
    }else{
      targetNode.classList.remove('has_pin');
    }

  }


  ngOnDestroy(){
    this.closeSizeObserver();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['dirty']) {



      let draft = this.tree.getDraft(this.id);
      this.draft_visible = this.tree.getDraftVisible(this.id);

      if(draft == undefined || draft == null){
        this.draft_name = 'this operation did not create a draft, check to make sure it has all the inputs it needs';
        this.warps = 0;
        this.wefts = 0;
      }else{
        this.draft_name = getDraftName(draft);
        this.warps = warps(draft.drawdown);
        this.wefts = wefts(draft.drawdown);
      }
    
      


      if(!changes['dirty'].firstChange){
        if(this.draft_rendering !== undefined && draft !== undefined && draft !== null){

          this.draft_name = getDraftName(draft);
          this.draft_rendering.onNewDraftLoaded(this.id);
          this.drawDraft(draft);
          
        } else{
          this.draft_rendering.clear();
        }
       
      }     
    }
}


  startSizeObserver(){

    const targetNode = document.getElementById("drawdown-mixer-"+this.id);
    const config = { attributes: true,characterData: true, childList: false, subtree: false };
    const callback = (mutationList, observer) => {
      for (const mutation of mutationList) {
      if (mutation.type === "attributes") {
          // console.log(`The ${mutation.attributeName} attribute was modified.`);
          this.onDrawdownSizeChanged.emit(this.id);
        }
      }
    };

    this.size_observer = new MutationObserver(callback);
    this.size_observer.observe(targetNode, config);


  }

  closeSizeObserver(){
    this.size_observer.disconnect();
  }

  toggleVisibility(){
   // console.log("VIS TOGGLED", this.id,  this.draft_visible, this.ws.hide_mixer_drafts)
    this.draft_visible = !this.draft_visible;
    this.tree.setDraftVisiblity(this.id, this.draft_visible);
    this.updateDraftRendering();
    
  }

  updateDraftRendering(){
    const draft = this.tree.getDraft(this.id);

        if(this.draft_rendering !== undefined && draft !== undefined && draft !== null){
          this.draft_rendering.onNewDraftLoaded(this.id);
          this.drawDraft(draft);
        } else{
          this.draft_rendering.clear();
        }
  }



  nameFocusOut(event){
  }

  connectionStarted(event){
    this.connectionSelected.emit({event: event, id: this.id});
  }

  hasPin() : boolean{
    if(!this.vs.hasPin()) return false;
    return this.id === this.vs.getPin()
  }


  pinToView(){
      this.vs.setPin(this.id);
    
  }



  unpinFromView(){
    this.vs.clearPin();
  }


  openInEditor(){
    this.onOpenInEditor.emit(this.id)
  }



  drawDraft(draft: Draft) : Promise<boolean>{



    if(!this.tree.getDraftVisible(this.id)) return Promise.resolve(false);
    if(this.draft_rendering == null || this.draft_rendering == undefined)return Promise.resolve(false);

    const loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);


    let flags = {
      drawdown: true,
      warp_materials: true, 
      warp_systems: true,
      weft_materials: true, 
      weft_systems: true
    }


    return this.draft_rendering.redraw(draft, loom, loom_settings, flags ).then(el => {
      this.tree.setDraftClean(this.id);
      this.onDrawdownSizeChanged.emit(this.id);
      return Promise.resolve(true);
    })

    

  }


  updateName(){
    let name = this.tree.getDraftName(this.id);
    this.draft_name = name;
  }
 
  

  async saveAsWif() {

    let draft = this.tree.getDraft(this.id);
    let loom = this.tree.getLoom(this.id);
    let loom_settings = this.tree.getLoomSettings(this.id);
    saveAsWif(this.fs, draft, loom, loom_settings)

  
  }

  async saveAsPrint() {
    let draft = this.tree.getDraft(this.id);

    let floats = (this.current_view == 'draft') ? false : true;
    let color = (this.current_view == 'visual') ? true : false;

    saveAsPrint(
      this.bitmap.nativeElement,
      draft,
      color,
      floats,
      this.ws.selected_origin_option, 
      this.ms,
      this.ss,
      this.fs
    )
  }

  drawdownUpdated(){
    if(!this.tree.hasParent(this.id)){
     this.vs.updateViewer();
     this.onRecomputeChildren.emit({event: 'edit', id: this.id});
    }
  }
    /**
   * Draws to hidden bitmap canvas a file in which each draft cell is represented as a single pixel. 
   * @returns 
   */
    async saveAsBmp() : Promise<any> {

      let b = this.bitmap.nativeElement;
      let draft = this.tree.getDraft(this.id);

      saveAsBmp(b, draft, this.ws.selected_origin_option, this.ms, this.fs)
        
    }

    async designActionChange(e){
  
      switch(e){
        case 'duplicate':   
        this.onDuplicateCalled.emit({event: e, id: this.id});
        break;
  
        case 'delete': 
          this.onDeleteCalled.emit({event: e,id: this.id});
        break;
  

  
      }
    }


    localZoomChange(event: any){
        this.local_zoom = event;
        const dn = <DraftNode> this.tree.getNode(this.id);
        dn.scale = this.local_zoom;
        this.draft_rendering.rescale(dn.scale);
    }
  

    toggleDraftRendering(){
      const dn = <DraftNode> this.tree.getNode(this.id);
      dn.render_colors = !dn.render_colors;
      this.use_colors = dn.render_colors;
      this.drawDraft(this.tree.getDraft(this.id));
    }
  
  


}
