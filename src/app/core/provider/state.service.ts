import { Injectable } from '@angular/core';
import { getAuth } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { Draft, SaveObj } from '../model/datatypes';
import { FilesystemService } from './filesystem.service';
/**
 * stores a state within the undo/redo timeline
 * weaver uses draft, mixer uses ada
 */
 interface HistoryState {
  draft: Draft;
  ada: SaveObj;
}

@Injectable({
  providedIn: 'root'
})
export class StateService {

  public readonly testDocValue$: Observable<any>;



  active_id = 0;
  max_size = 10;
  last_saved_time: string = "";
  undo_disabled: boolean;
  redo_disabled: boolean;
  timeline: Array<HistoryState>; //new states are always pushed to front of draft
  currently_opened_file_id: number;



  constructor(private files: FilesystemService) {


    this.active_id = 0;
    this.timeline = [];
    this.undo_disabled = true;
    this.redo_disabled = true;

  }



  clearTimeline(){
    this.active_id = 0;
    this.undo_disabled = true;
    this.redo_disabled = true;
    this.timeline = [];

  }


  printValue(value: any){
    console.log("printing", value);
  }


  validateWriteData(cur_state: any) : any {
    return cur_state;
  }

/**
 * this is called every-time there is an action that needs saving on the stack. 
 * this includes the creation of a new file
 */
  public addMixerHistoryState(ada:{json: string, file: SaveObj}){

    // console.log("ADD MIXER HX", ada.file.draft_nodes)

    var state = {
      draft: null,
      ada: {
        version: ada.file.version,
        workspace: ada.file.workspace,
        zoom: ada.file.zoom,
        type: ada.file.type,
        nodes: ada.file.nodes.slice(),
        tree: ada.file.tree.slice(),
        draft_nodes: ada.file.draft_nodes.slice(),
        ops: ada.file.ops.slice(),
        notes: ada.file.notes.slice(),
        materials: ada.file.materials.slice(),
        indexed_image_data: ada.file.indexed_image_data.slice() 
      }
    }

    if(this.files.connected){
  

    const auth = getAuth();
    const user = auth.currentUser;

    if(user !== null){
      //do a quick correction for any undefined loom settings
      ada.file.draft_nodes.forEach(dn => {
        if(dn.loom_settings == undefined){
          dn.loom_settings = null;
        }
      })

      this.files.writeFileData(this.files.getCurrentFileId(), ada.file)
    } 
  }

  if(this.active_id > 0){

    this.timeline.splice(0, this.active_id);
    this.active_id = 0;
    this.redo_disabled = true;

  }

  //add the new element to position 0
  var len = this.timeline.unshift(state);
  if(len > this.max_size) this.timeline.pop();
  if(this.timeline.length > 1) this.undo_disabled = false;

  

}


/**
 * called on redo in mixer
 * @returns returns the ada file to reload
 */  
public restoreNextMixerHistoryState(): SaveObj{

    if(this.active_id == 0) return; 

  	this.active_id--;

    if(this.active_id == 0) this.redo_disabled = true;

    return this.timeline[this.active_id].ada;
    

  }


    /**
   * called on undo in mixer
   * @returns returns the draft to load
   */
     public restorePreviousMixerHistoryState():SaveObj{

      this.active_id++;
 
       //you've hit the end of available states to restore
      if(this.active_id >= this.timeline.length){
         this.active_id--;
         this.undo_disabled = true;
         return null; 
      } 
 
      this.redo_disabled = false;
      return this.timeline[this.active_id].ada;
       
   }


}



