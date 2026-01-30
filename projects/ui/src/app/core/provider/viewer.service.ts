import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { TreeService } from './tree.service';

@Injectable({
  providedIn: 'root'
})

/**
 * this service manages information about the draft that is currently being shown in the viewer. 
 */
export class ViewerService {
  private tree = inject(TreeService);


  hasPin: boolean = false;
  showing: number = -1;
  current_view: 'draft' | 'structure' | 'visual' | 'sim' = 'visual';
  view_face: 'front' | 'back' = 'front';
  use_sizes: 'actual' | 'standard' = 'actual';


  showing_id_change$ = new Subject<any>(); //broadcasts changes to the current draft intended for viewing
  update_viewer$ = new Subject<any>();
  clear_viewer$ = new Subject<any>();


  /**
   * sets a pin on a draft, forcing it to remain in viewer even when other items on the mixer are selected
   * it sets the pinned id, as well as the showing id, to the pinned id value
   * it broadcasts that a change in ID took place
   * @param id 
   */
  setPin(id: number) {

    if (this.tree.getType(id) !== "draft") {
      console.error("attempting to set viewer to a non-draft id");
      this.setShowingId(-1)
      return;
    }

    this.hasPin = true;
    if (this.showing !== id) this.setShowingId(id);

  }

  private setShowingId(id: number) {
    this.showing = id;
    this.showing_id_change$.next(this.showing);

  }

  getPin(): boolean {
    return this.hasPin;
  }


  clearPin() {
    this.hasPin = false;
  }


  /**
   * attempts to update the viewer to focus on a given id. If the viewer has a pin, it will not update. 
   * Otherwise, it will set the viewing id to the value of id and broadcasts to the viewer that a change has been made
   * @param id 
   */
  setViewer(id: number) {
    if (this.tree.getType(id) !== "draft") {
      console.error("attempting to set viewer to a non-draft id");
      this.setShowingId(-1);
      return;
    }

    if (this.hasPin) return;

    if (this.showing !== id) {
      this.setShowingId(id);
    }
  }

  getViewerId(): number {
    return this.showing;
  }

  // hasViewer(): boolean {
  //   return (this.showing_id !== -1);
  // }

  clearViewer() {
    this.setShowingId(-1);
    this.hasPin = false;
  }

  /**
   * this is called from the palette when a delete command has been emitted. 
   * it checks to see if any of the deleted values are currently on display in the viewer
   * and updates the viewer accordingly
   * @param id 
   */
  checkOnDelete(id: number) {
    if (this.showing == id) {
      this.clearViewer();
    }

  }


  /**
   * called from the palette or from the editor when a draft has been changed and should be redrawn. 
   */
  updateViewer() {
    this.update_viewer$.next(true);

  }

}
