import { Injectable } from '@angular/core';
import { Interlacement } from 'adacad-drafting-lib';
import { Subject } from 'rxjs';
import { Bounds, Point } from '../../core/model/datatypes';


@Injectable({
  providedIn: 'root'
})
export class ViewportService {

  vpchanged$ = new Subject<any>();



  /**
   * the total size of scrollable space
   */
  absolute: Bounds;

  /**
   * the bounds of the viewport within that space
   */
  vp: Bounds;

  /**
   * a reference to the topleft interlalcement of objects being rendered
   * number references the unique id of this element 
   */
  objs: Array<{ id: number, i: Interlacement }>;

  constructor() {

    this.vp = {
      topleft: { x: 0, y: 0 },
      width: 0,
      height: 0
    };

    this.absolute = {
      topleft: { x: 0, y: 0 },
      width: 0,
      height: 0
    };

    this.objs = [];

  }

  clear() {
    this.objs = [];
  }

  /**
   * called when a new subdraft is added
   * @param id the id of the subdraft
   * @param i the topleft corner as interlacement
   */
  addObj(id: number, i: Interlacement) {
    this.objs.push({ id: id, i: i });
  }

  /**
   * calledd when subdraft is deleted
   * @param id - the subdraft id
   */
  removeObj(id: number) {
    this.objs = this.objs.filter(el => el.id != id);
  }

  /**
   * called when a subdraft is moved and we need to update its location
   * @param id - the subdraft id to move
   * @param i - the new position to set to
   */
  updatePoint(id: number, i: Interlacement) {
    this.objs = this.objs.map(el => {
      if (el.id === id) el.i = i;
      return el;
    });
  }

  setAbsolute(w: number, h: number) {
    this.absolute.width = w;
    this.absolute.height = h;
  }

  /**
   * called when the local view is scrolled to a new part of the page
   * @param x 
   * @param y 
   */
  move(x: number, y: number) {

    if (x === undefined || y == undefined) return;

    const bleh = {
      x: this.vp.topleft.x + x,
      y: this.vp.topleft.y + y
    }

    this.set(bleh.x, bleh.y, this.vp.width, this.vp.height);



  }

  set(x: number, y: number, width: number, height: number) {
    this.vp.topleft = { x: x, y: y };
    this.vp.width = width;
    this.vp.height = height;
    this.vpchanged$.next(this.vp.topleft);

  }

  setWidth(w: number) {
    this.vp.width = w;
  }

  getWidth(): number {
    return this.vp.width;
  }

  getAbsoluteWidth(): number {
    return this.absolute.width;
  }

  setHeight(h: number) {
    this.vp.height = h;
  }

  getHeight(): number {
    return this.vp.height;
  }

  getAbsoluteHeight(): number {
    return this.absolute.height;
  }

  setTopLeft(p: Point) {
    this.vp.topleft = { x: p.x, y: p.y };

  }

  getTopLeft(): Point {
    return this.vp.topleft;
  }

  getTopRight(): Point {
    return { x: this.vp.topleft.x + this.vp.width, y: this.vp.topleft.y }
  }

  getBounds(): Bounds {
    return this.vp;
  }

  /**
   * this gets the center point of the current viewport in screen terms. 
   * @returns 
   */
  getCenterPoint(): Point {
    const center: Point = {
      x: this.vp.topleft.x + this.vp.width / 2,
      y: this.vp.topleft.y + this.vp.height / 2
    }
    return center;
  }

  /**
  * set the viewport in the center of the screen
  * @returns the point for referencing
   */
  setViewportCenter(): Point {

    const abs_topleft: Point = {
      x: this.absolute.width / 2 - this.vp.width / 2,
      y: this.absolute.height / 2 - this.vp.height / 2
    }

    this.vp.topleft = abs_topleft;
    return abs_topleft;

  }






}
