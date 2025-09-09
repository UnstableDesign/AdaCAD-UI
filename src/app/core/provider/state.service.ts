import { Injectable, inject } from '@angular/core';
import { getAuth } from '@angular/fire/auth';
import { Draft } from 'adacad-drafting-lib';
import { Observable } from 'rxjs';
import { SaveObj } from '../model/datatypes';
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
  private files = inject(FilesystemService);


  public readonly testDocValue$: Observable<any>;



  active_id = 0;
  max_size = 10;
  last_saved_time: string = "";
  undo_disabled: boolean;
  redo_disabled: boolean;
  timeline: Array<HistoryState>; //new states are always pushed to front of draft
  currently_opened_file_id: number;



  constructor() {


    this.active_id = 0;
    this.timeline = [];
    this.undo_disabled = true;
    this.redo_disabled = true;

  }



  clearTimeline() {
    this.active_id = 0;
    this.undo_disabled = true;
    this.redo_disabled = true;
    this.timeline = [];

  }


  printValue(value: any) {
    console.log("printing", value);
  }


  validateWriteData(cur_state: any): any {
    return cur_state;
  }


  public getFileSize(name: string, obj: any): number {
    const str = JSON.stringify(obj);
    const size = new Blob([str]).size;
    console.log(name + " is ", size);
    return size;

  }

  public hasTimeline() {
    if (this.timeline.length > 0) return true;
    return false;
  }



  /**
   * this is called every-time there is an action that needs saving on the stack. 
   * this includes the creation of a new file
   */
  public addMixerHistoryState(ada: { json: string, file: SaveObj }) {
    let err = 0;


    // this.getFileSize("version", ada.file.version);
    // this.getFileSize("workspace", ada.file.workspace);
    // this.getFileSize("type", ada.file.type);
    // this.getFileSize("nodes", ada.file.nodes);
    // this.getFileSize("tree", ada.file.tree);
    // this.getFileSize("draft nodes", ada.file.draft_nodes);
    // this.getFileSize("ops", ada.file.ops);
    // this.getFileSize("notes", ada.file.notes);
    // this.getFileSize("materials", ada.file.materials);
    // this.getFileSize("indexed_image_data", ada.file.indexed_image_data);

    // console.log('DRAFT NODES # ', ada.file.draft_nodes.length);
    // console.log('DRAFT NODES Values', ada.file.draft_nodes);



    if (this.files.connected) {


      const auth = getAuth();
      const user = auth.currentUser;

      if (user !== null) {
        //do a quick correction for any undefined loom settings
        ada.file.draft_nodes.forEach(dn => {
          if (dn.loom_settings == undefined) {
            dn.loom_settings = null;
          }
        })



        if (this.getFileSize("file", ada.file) < 16000000) {
          this.files.writeFileData(this.files.getCurrentFileId(), ada.file);
          this.files.writeFileMetaData(user.uid, this.files.getCurrentFileId(), this.files.getCurrentFileName(), this.files.getCurrentFileDesc(), this.files.getCurrentFileFromShare());
        }
        else {
          console.error("WRITE TOO LARGE");
          err = 1;

        }
      }
    }
    return err;
  }


  public writeStateToTimeline(ada: { json: string, file: SaveObj }) {
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
    if (this.active_id > 0) {

      this.timeline.splice(0, this.active_id);
      this.active_id = 0;
      this.redo_disabled = true;

    }

    //add the new element to position 0
    var len = this.timeline.unshift(state);
    if (len > this.max_size) this.timeline.pop();
    if (this.timeline.length > 1) this.undo_disabled = false;

  }


  /**
   * called on redo in mixer
   * @returns returns the ada file to reload
   */
  public restoreNextMixerHistoryState(): SaveObj {

    if (this.active_id == 0) return;

    this.active_id--;

    if (this.active_id == 0) this.redo_disabled = true;

    return this.timeline[this.active_id].ada;


  }


  /**
 * called on undo in mixer
 * @returns returns the draft to load
 */
  public restorePreviousMixerHistoryState(): SaveObj {

    this.active_id++;

    //you've hit the end of available states to restore
    if (this.active_id >= this.timeline.length) {
      this.active_id--;
      this.undo_disabled = true;
      return null;
    }

    this.redo_disabled = false;
    return this.timeline[this.active_id].ada;

  }


}



