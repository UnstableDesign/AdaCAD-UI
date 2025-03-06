import { Component, EventEmitter, Inject, Input, Output, SimpleChanges } from '@angular/core';
import { NgForm } from '@angular/forms';
import { DesignmodesService } from '../../core/provider/designmodes.service';
import { defaults, density_units, loom_types } from '../../core/model/defaults';
import { deleteDrawdownCol, deleteDrawdownRow, deleteMappingCol, deleteMappingRow, insertDrawdownCol, insertDrawdownRow, insertMappingCol, insertMappingRow, warps, wefts } from '../../core/model/drafts';
import { TreeService } from '../../core/provider/tree.service';
import { LoomSettings, LoomUtil } from '../../core/model/datatypes';
import { convertLiftPlanToTieup, convertTieupToLiftPlan, generateDirectTieup, getLoomUtilByType, isFrame, numFrames, numTreadles } from '../../core/model/looms';
import { WorkspaceService } from '../../core/provider/workspace.service';

@Component({
  selector: 'app-loom',
  templateUrl: './loom.component.html',
  styleUrls: ['./loom.component.scss']
})
export class LoomComponent {

  @Input('id') id; 

  @Output() unsetSelection: any = new EventEmitter();
  // @Output() drawdownUpdated: any = new EventEmitter();
  @Output() loomSettingsUpdated: any = new EventEmitter();


  units: any = defaults.loom_settings.units;
  warps: number = defaults.warps;
  wefts: number = defaults.wefts;
  epi: number = defaults.loom_settings.epi;
  frames: number = defaults.loom_settings.frames;
  treadles: number = defaults.loom_settings.treadles;
  type:string = defaults.loom_settings.type;
  width: number = 0;
  density_units;
  loomtypes;


  constructor(
    private tree: TreeService, 
    public dm: DesignmodesService,
    public ws: WorkspaceService){

       this.density_units = density_units;
       this.loomtypes = loom_types;
    
  }

  ngOnChanges(changes: SimpleChanges){

    this.id = changes['id'].currentValue;
    if(this.id !== -1){

      const draft = this.tree.getDraft(this.id);
      const loom = this.tree.getLoom(this.id);
      const loom_settings = this.tree.getLoomSettings(this.id);

      this.units = loom_settings.units;
      this.type = loom_settings.type;
      this.epi = loom_settings.epi;
      if(loom !== null) this.frames = Math.max(loom_settings.frames, numFrames(loom));
      if(loom !== null) this.treadles = Math.max(loom_settings.treadles, numTreadles(loom));
      this.warps = warps(draft.drawdown);
      this.wefts = wefts(draft.drawdown);

      this.updateWidth();
    }
  }

  updateLoom(){
    const loom_settings = this.tree.getLoomSettings(this.id);
    const loom = this.tree.getLoom(this.id);

    if(loom !== null) this.frames = Math.max(loom_settings.frames, numFrames(loom));
    if(loom !== null) this.treadles = Math.max(loom_settings.treadles, numTreadles(loom));
  }

  updateWidth(){

    if(this.id == -1) return;
    const loom_settings = this.tree.getLoomSettings(this.id);

    if(loom_settings.units === "in"){
      this.width = this.warps / this.epi;
    }else{
      this.width = this.warps / this.epi * 10;
    }

    
  }


  public warpNumChange(e:any) {
  


  
    const draft = this.tree.getDraft(this.id);
    let loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);
  
  
    if(e.warps > warps(draft.drawdown)){
      var diff = e.warps -  warps(draft.drawdown);
      for(var i = 0; i < diff; i++){  
  
        let ndx = warps(draft.drawdown);
        const utils = getLoomUtilByType(loom_settings.type);
        loom = utils.insertIntoThreading(loom, ndx, -1);
  
        draft.drawdown = insertDrawdownCol(draft.drawdown,ndx, null);
        draft.colShuttleMapping = insertMappingCol(draft.colShuttleMapping,ndx, 0);
        draft.colSystemMapping = insertMappingCol(draft.colSystemMapping,ndx, 0);
        
      }
    }else{
  
      var diff = warps(draft.drawdown) - e.warps;
      for(var i = 0; i < diff; i++){  
        let ndx = warps(draft.drawdown)-1;
  
        const utils = getLoomUtilByType(loom_settings.type);
        loom = utils.deleteFromThreading(loom, ndx);
        draft.drawdown = deleteDrawdownCol(draft.drawdown, ndx);
        draft.colShuttleMapping = deleteMappingCol(draft.colShuttleMapping,ndx);
        draft.colSystemMapping = deleteMappingCol(draft.colSystemMapping,ndx);
  
      }
  
    }
  
    if(this.dm.isSelectedDraftEditSource('drawdown')){
      this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
      .then(loom => {
        this.loomSettingsUpdated.emit();
      })
  
    }else{
      this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
      .then(draft => {

        this.loomSettingsUpdated.emit();

      })
  
    }
  
  
  }
  
  
  warpChange(f: NgForm) {
  
    if(this.tree.hasParent(this.id)) return;

    if(!f.value.warps){
     f.value.warps = 2;
     this.warps = f.value.warps;
    }

    // if(f.value.warps > 40){
    //   this.warps = 40;
    //   return;
    // }

    this.warpNumChange({warps: f.value.warps})
    this.updateWidth();

    f.value.width = this.width;
  
  }

  weftChange(f: NgForm) {

    if(this.tree.hasParent(this.id)) return;

    if(!f.value.wefts){
      f.value.wefts = 2;
      this.wefts = 2;
    } 

    // if(f.value.wefts > 40){
    //   this.wefts = 40;
    //   return;
    // } 

    this.weftNumChange({wefts: f.value.wefts})
  
  }
  
  public weftNumChange(e:any) {
    console.log("WEFT CHANGE ", e)

    if(e.wefts === "" || e.wefts =="null") return;
  
  
    const draft = this.tree.getDraft(this.id);
    let loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);
  
    //console.log("Draft", draft.drawdown.slice(), e.wefts)
  
    if(e.wefts > wefts(draft.drawdown)){
      var diff = e.wefts - wefts(draft.drawdown);
  
      for(var i = 0; i < diff; i++){  
        let ndx = wefts(draft.drawdown);
  
        draft.drawdown = insertDrawdownRow(draft.drawdown,ndx, null);
        draft.rowShuttleMapping = insertMappingRow(draft.rowShuttleMapping,  ndx, 1)
        draft.rowSystemMapping = insertMappingRow(draft.rowSystemMapping,  ndx, 0);
        const utils = getLoomUtilByType(loom_settings.type);
        loom = utils.insertIntoTreadling(loom, ndx, []);
      }
    }else{

      var diff = wefts(draft.drawdown) - e.wefts;
      console.log("DIFF ",diff, draft)
      for(var i = 0; i < diff; i++){  
        let ndx = wefts(draft.drawdown)-1;
        draft.drawdown = deleteDrawdownRow(draft.drawdown, ndx);
        draft.rowShuttleMapping = deleteMappingRow(draft.rowShuttleMapping, ndx)
        draft.rowSystemMapping = deleteMappingRow(draft.rowSystemMapping,  ndx)
        const utils = getLoomUtilByType(loom_settings.type);
        loom =  utils.deleteFromTreadling(loom, ndx);

      }
    
      console.log("LOOM AFTER ", loom)
    }
  
    if(this.dm.isSelectedDraftEditSource('drawdown')){
  
      this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
      .then(loom => {
        this.loomSettingsUpdated.emit();

      })
    }else{

      this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
      .then(draft => {
        this.tree.setDraftOnly(this.id, draft);
        this.loomSettingsUpdated.emit();
      })
    }
   
  }

  
    loomChange(f:NgForm){
      console.log("LOOM CHANGE")
      if(this.id == -1) return;

      const draft = this.tree.getDraft(this.id);
      const loom = this.tree.getLoom(this.id);
      const loom_settings = this.tree.getLoomSettings(this.id);
      this.type =  f.value.loomtype;

      if (loom_settings.type === 'jacquard') this.dm.selectDraftEditSource('drawdown');
      else{
        this.dm.selectDraftEditSource('loom');
      }
   
      let utils:LoomUtil = null;
    
        const new_settings:LoomSettings = {
          type: f.value.loomtype,
          epi: loom_settings.epi,
          units: loom_settings.units,
          frames: loom_settings.frames,
          treadles: loom_settings.treadles
        }
    
  
        //make null effectively function as though it was jacquard
        if(loom_settings.type === null) loom_settings.type == 'jacquard';
  
        //there are several combinations that could take place
  
        //from jacquard to direct tie loom
        utils = getLoomUtilByType(new_settings.type);
  
        if(loom_settings.type === 'jacquard' && new_settings.type === 'direct'){
  
          this.tree.setLoomSettings(this.id, new_settings);      
         
          utils.computeLoomFromDrawdown(draft.drawdown, new_settings)
          .then(loom => {
            this.tree.setLoom(this.id, loom);
            const treadles = Math.max(numTreadles(loom), loom_settings.treadles);  
            const frames = Math.max(numFrames(loom), loom_settings.frames);
            this.treadles = Math.max(treadles, frames);
            this.frames = Math.max(treadles, frames);
            // this.redraw(draft, loom, new_settings, {loom: true});
  
          
            this.loomSettingsUpdated.emit();
  
  
  
          });
  
        }else if(loom_settings.type === 'jacquard' && new_settings.type === 'frame'){
            //from jacquard to floor loom (shaft/treadle) 'frame'
            this.tree.setLoomSettings(this.id, new_settings);      
            utils.computeLoomFromDrawdown(draft.drawdown, new_settings)
            .then(loom => {
              this.tree.setLoom(this.id, loom);
              this.treadles = Math.max(numTreadles(loom), loom_settings.treadles);
              this.frames = Math.max(numFrames(loom), loom_settings.frames);
              this.loomSettingsUpdated.emit();
  
            });
        }else if(loom_settings.type === 'direct' && new_settings.type === 'jacquard'){
          // from direct-tie to jacquard
          //do nothing, we'll just keep the drawdown
          this.tree.setLoom(this.id, null);
          this.tree.setLoomSettings(this.id, new_settings);      
          this.loomSettingsUpdated.emit();
  
        }else if(loom_settings.type === 'frame' && new_settings.type === 'jacquard'){
          // from direct-tie to jacquard
          //do nothing, we'll just keep the drawdown
          this.tree.setLoom(this.id, null);
          this.tree.setLoomSettings(this.id, new_settings);      
          this.loomSettingsUpdated.emit();
  
        }else if(loom_settings.type == 'direct' && new_settings.type == 'frame'){
        // from direct-tie to floor
  
        const converted_loom = convertLiftPlanToTieup(loom);
        this.tree.setLoom(this.id, converted_loom);
        this.frames = numFrames(converted_loom);
        this.treadles = numTreadles(converted_loom);
        this.tree.setLoomSettings(this.id, new_settings);      
        //this.redraw(draft, converted_loom, new_settings, {loom: true});
        this.loomSettingsUpdated.emit();
  
  
  
  
  
        }else if(loom_settings.type == 'frame' && new_settings.type == 'direct'){
          // from floor to direct
          const converted_loom = convertTieupToLiftPlan(loom);
          this.tree.setLoom(this.id, converted_loom);
          this.frames = numFrames(converted_loom);
          this.treadles = numTreadles(converted_loom);
          this.tree.setLoomSettings(this.id, new_settings);      
          //this.redraw(draft, converted_loom, new_settings, {loom: true});
          this.loomSettingsUpdated.emit();
  
  
        }
  
  
    
      } 

      updateMinTreadles(f: NgForm){
        //validate the input
        const loom_settings = this.tree.getLoomSettings(this.id);
        const loom = this.tree.getLoom(this.id);
        const draft = this.tree.getDraft(this.id);
    
        if(!f.value.treadles){
          f.value.treadles = 2; 
          this.treadles = f.value.treadles;
        } 
    
        f.value.treadles = Math.ceil(f.value.treadles);
       
    
          loom_settings.treadles = f.value.treadles;
    
          if(loom_settings.type == 'direct'){
            this.frames = f.value.treadles;
            this.treadles = f.value.treadles;
            loom_settings.frames = this.frames;
            loom_settings.treadles = this.treadles;
            loom.tieup = generateDirectTieup(f.value.treadles);
            this.tree.setLoom(this.id, loom);
    
          }
    
          this.tree.setLoomSettings(this.id, loom_settings);
          this.loomSettingsUpdated.emit();
        
    
      }
    
      updateMinFrames(f: NgForm){
        const loom_settings = this.tree.getLoomSettings(this.id);
        const loom = this.tree.getLoom(this.id);
        const draft = this.tree.getDraft(this.id);
    
        if(!f.value.frames){
          f.value.frames = 2; 
          this.frames = f.value.frames;
    
        }
         
    
        f.value.frames = Math.ceil(f.value.frames);
        
    
          loom_settings.frames = f.value.frames;
    
          if(loom_settings.type == 'direct'){
            this.frames = f.value.frames;
            this.treadles = f.value.frames;
            loom_settings.frames = this.frames;
            loom_settings.treadles = this.treadles;
            loom.tieup = generateDirectTieup(f.value.frames);
            this.tree.setLoom(this.id, loom);
          }
    
          this.tree.setLoomSettings(this.id, loom_settings); 
          this.loomSettingsUpdated.emit();
        
      }
    
    
      public unitChange(){

        const loom_settings = this.tree.getLoomSettings(this.id);
        loom_settings.units = this.units;
        this.tree.setLoomSettings(this.id, loom_settings);
        this.loomSettingsUpdated.emit();
      }

       /**
   * recomputes warps and epi if the width of the loom is changed
   * @param f 
   */
  widthChange(f: NgForm) {
    const loom_settings = this.tree.getLoomSettings(this.id);
  
    if(!f.value.width){
      f.value.width = 1;
      this.width = f.value.width;

    } 

 
      var new_warps = (loom_settings.units === "in") 
      ? Math.ceil(f.value.width * f.value.epi) : 
      Math.ceil((10 * f.value.warps / f.value.width));
  
      this.warps = new_warps;
      this.warpNumChange({warps: new_warps});
      this.loomSettingsUpdated.emit();


  }
  
      

  epiChange(f: NgForm) {

    if(this.id == -1) return;
  
    const loom_settings = this.tree.getLoomSettings(this.id);
  
    if(!f.value.epi){
      f.value.epi = 1;
      loom_settings.epi = f.value.epi;
      this.tree.setLoomSettings(this.id, loom_settings);
    } 
    
    loom_settings.epi = f.value.epi;
    this.epi = f.value.epi;
    this.updateWidth();
    this.loomSettingsUpdated.emit();



  
  
  }
      


  }






