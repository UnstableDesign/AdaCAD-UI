import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Bounds, ZoomProxy } from '../model/datatypes';
import { defaults } from '../model/defaults';

@Injectable({
  providedIn: 'root'
})
export class ZoomService {
  //current zoom scale


  num_steps: number = 30;
  zoom_min: number = .015;
  zoom_step: number = .002;
  zoom_table: Array<number> = [];

  zoom_table_ndx_mixer: number = defaults.zoom_ndx_mixer;
  zoom_table_ndx_editor: number = defaults.zoom_ndx_editor;
  zoom_table_ndx_viewer: number = defaults.zoom_ndx_viewer;

  //broadcast chanegs to the main footer zoom
  zoomChange$ = new BehaviorSubject<{ source: string, ndx: number }>({ source: 'editor', ndx: defaults.zoom_ndx_editor });


  constructor() {


    for (let i = 0; i < this.num_steps; i++) {
      const raw = this.zoom_min + this.zoom_step * (i * i);
      this.zoom_table.push(this.manageZoomRounding(raw));
    }
  }

  /**
   * exports the current vale used to scale the designated workspace: 
   * NOTE: this does not return the index value of the zoom table, but the resulting value itself
   * @returns 
   */
  export(): ZoomProxy {
    return {
      editor: this.getEditorZoom(),
      mixer: this.getMixerZoom()
    }

  }

  import(zp: ZoomProxy) {

    this.setEditorIndexFromZoomValue(zp.editor);
    this.setMixerIndexFromZoomValue(zp.mixer);

  }

  getZoomMax(): number {
    return this.zoom_table[this.zoom_table.length - 1];
  }

  getZoomMin(): number {
    return this.zoom_table[0];
  }

  manageZoomRounding(val: number): number {
    // if(val >= 1) return Math.floor(val);
    return Math.round(val * 1000) / 1000;
  }


  /**
   * this function takes a bounding box and the total size of the palette and updates the zoom such that the bounding box fits within the view box. 
   * @param objs 
   * @param viewable (the size of the current view portal) 
   */
  zoomToFitMixer(bounds: Bounds, viewable: { width: number, height: number }) {

    const w_factor = viewable.width / bounds.width;
    const h_factor = viewable.height / bounds.height;
    const smaller = Math.min(w_factor, h_factor)
    this.setMixerIndexFromZoomValue(smaller);


  }

  zoomToFitEditor() {

  }

  zoomToVitViewer() {

  }


  zoomInMixer(emitEvent: boolean = true) {
    this.zoom_table_ndx_mixer++;
    if (this.zoom_table_ndx_mixer >= this.zoom_table.length) {
      this.zoom_table_ndx_mixer = this.zoom_table.length;
    }
    if (emitEvent) this.zoomChange$.next({ source: 'mixer', ndx: this.zoom_table_ndx_mixer });
  }

  zoomInEditor(emitEvent: boolean = true) {
    this.zoom_table_ndx_editor++;
    if (this.zoom_table_ndx_editor >= this.zoom_table.length) {
      this.zoom_table_ndx_editor = this.zoom_table.length;
    }
    if (emitEvent) this.zoomChange$.next({ source: 'editor', ndx: this.zoom_table_ndx_editor });
  }

  zoomInViewer() {
    this.zoom_table_ndx_viewer++;
    if (this.zoom_table_ndx_viewer >= this.zoom_table.length) {
      this.zoom_table_ndx_viewer = this.zoom_table.length;
    }
  }



  zoomOutMixer(emitEvent: boolean = true) {
    this.zoom_table_ndx_mixer--;
    if (this.zoom_table_ndx_mixer < 0) {
      this.zoom_table_ndx_mixer = 0;
    }
    if (emitEvent) this.zoomChange$.next({ source: 'mixer', ndx: this.zoom_table_ndx_mixer });
  }

  zoomOutEditor(emitEvent: boolean = true) {
    this.zoom_table_ndx_editor--;
    if (this.zoom_table_ndx_editor < 0) {
      this.zoom_table_ndx_editor = 0;
    }
    if (emitEvent) this.zoomChange$.next({ source: 'editor', ndx: this.zoom_table_ndx_editor });
  }

  zoomOutViewer() {
    this.zoom_table_ndx_viewer--;
    if (this.zoom_table_ndx_viewer < 0) {
      this.zoom_table_ndx_viewer = 0;
    }
  }


  /**
   * set zoom takes a number representing the scale of the content to the window and matches it to the 
   * closest value in the predefined sets of values
   * @param val 
   */
  setEditorIndexFromZoomValue(zoom: number, emitEvent: boolean = true) {

    let closest = this.zoom_table.reduce((acc, val, ndx) => {
      let diff = zoom - val;
      if (diff >= 0 && diff < acc.min) return { min: diff, ndx: ndx }
      else return acc;

    }, { min: 1000000, ndx: 0 })


    this.zoom_table_ndx_editor = closest.ndx;
    if (emitEvent) this.zoomChange$.next({ source: 'editor', ndx: this.zoom_table_ndx_editor });
  }

  setMixerIndexFromZoomValue(zoom: number, emitEvent: boolean = true) {
    let closest = this.zoom_table.reduce((acc, val, ndx) => {
      let diff = zoom - val;
      if (diff >= 0 && diff < acc.min) return { min: diff, ndx: ndx }
      else return acc;

    }, { min: 1000000, ndx: 0 })

    this.zoom_table_ndx_mixer = closest.ndx;
    if (emitEvent) this.zoomChange$.next({ source: 'mixer', ndx: this.zoom_table_ndx_mixer });
    // console.log("SET TO ", this.zoom_table_ndx_mixer, this.zoom_table[this.zoom_table_ndx_mixer])

  }

  setZoomIndexOnMixer(ndx: number, emitEvent: boolean = true) {
    if (ndx >= 0 && ndx < this.zoom_table.length)
      this.zoom_table_ndx_mixer = ndx;
    if (emitEvent) this.zoomChange$.next({ source: 'mixer', ndx: this.zoom_table_ndx_mixer });
  }

  setZoomIndexOnEditor(ndx: number, emitEvent: boolean = true) {
    if (ndx >= 0 && ndx < this.zoom_table.length)
      this.zoom_table_ndx_editor = ndx;
    if (emitEvent) this.zoomChange$.next({ source: 'editor', ndx: this.zoom_table_ndx_editor });
  }

  setZoomIndexOnViewer(ndx: number, emitEvent: boolean = true) {
    if (ndx >= 0 && ndx < this.zoom_table.length)
      this.zoom_table_ndx_viewer = ndx;
  }

  getMixerZoom() {
    return this.zoom_table[this.zoom_table_ndx_mixer];
  }

  getEditorZoom() {
    return this.zoom_table[this.zoom_table_ndx_editor];
  }

  getViewerZoom() {
    return this.zoom_table[this.zoom_table_ndx_viewer];
  }







}
