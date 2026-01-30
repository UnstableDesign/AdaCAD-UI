import { Injectable } from '@angular/core';
import { Draft, System, createSystem } from 'adacad-drafting-lib/draft';

@Injectable({
  providedIn: 'root'
})

/**
 * stores global information about the number of warp systems in use. 
 */
export class SystemsService {


  weft_systems: Array<System> = [];
  warp_systems: Array<System> = [];

  constructor() {

    for (let i = 0; i < 26; i++) {
      const weft = createSystem({});
      weft.id = i;
      weft.name = String.fromCharCode(i + 97);
      this.weft_systems.push(weft);

      const warp = createSystem({});
      warp.id = i;
      warp.name = "" + (i + 1);
      this.warp_systems.push(warp);
    }

    this.weft_systems[0].in_use = true;
    this.warp_systems[0].in_use = true;

  }

  reset() {

    this.weft_systems.forEach(el => {
      el.in_use = false;
      el.visible = true;
    })

    this.warp_systems.forEach(el => {
      el.in_use = false;
      el.visible = true;
    })

    this.weft_systems[0].in_use = true;
    this.warp_systems[0].in_use = true;

  }

  getWeftSystem(id: number): System {
    return this.weft_systems[id];
  }

  getWarpSystem(id: number): System {
    return this.warp_systems[id];
  }

  getFirstWarpSystem(): System {
    return this.warp_systems[0];
  }

  getFirstWeftSystem(): System {
    return this.weft_systems[0];
  }

  addWeftSystemFromId(id: number) {
    this.weft_systems[id].in_use = true;

  }

  addWarpSystemFromId(id: number) {
    this.warp_systems[id].in_use = true;

  }

  weftSystemIsVisible(id: number) {
    return this.weft_systems[id].visible;
  }

  warpSystemIsVisible(id: number) {
    return this.warp_systems[id].visible;
  }

  /**
 * looks for the next in use system after the ndx submitted.
 * @param ndx 
 */
  getNextWarpSystemFrom(ndx: number): number {
    return ndx + 1;
    // const in_use = this.warp_systems.filter(el => el.in_use);
    // let use_ndx = in_use.findIndex(el => el.id === ndx);
    // use_ndx++;

    // if(use_ndx < in_use.length){
    //   return in_use[use_ndx].id;
    // }else{
    //   //get the last used number an dincrement one
    //   this.warp_systems[use_ndx].in_use = true;
    //   return use_ndx;
    // }

  }


  /**
   * looks for the next in use system after the ndx submitted.
   * @param ndx 
   */
  getNextWeftSystemFrom(ndx: number): number {
    return ndx + 1;
    // const in_use = this.weft_systems.filter(el => el.in_use);
    // let use_ndx = in_use.findIndex(el => el.id == ndx);
    // use_ndx++;

    // if(use_ndx < in_use.length){
    //   return in_use[use_ndx].id;
    // }else{
    //   //get the last used number an dincrement one
    //   this.weft_systems[use_ndx].in_use = true;
    //   return use_ndx;
    // }
  }

  /**
   * checks if we should move to the next system id or create a new empty system.
   * @returns the id of the created or empty system to add to
  */
  getNextWarpSystem(ndx: number, draft: Draft): number {

    var system_id = draft.colSystemMapping[ndx];
    // //are any other rows assigned to this system or is this the first
    const count: number = draft.colSystemMapping.reduce((acc, val) => {
      if (val === system_id) {
        acc = acc + 1;
      }
      return acc;
    }, 0);

    //this is the only one assigned
    if (count === 1) {
      return 0; // return the starting index
    } else {
      return this.getNextWarpSystemFrom(system_id);
    }

  }

  /**
   * checks if we should move to the next system id or create a new empty system.
   * @returns the id of the created or empty system to add to
  */
  getNextWeftSystem(ndx: number, draft: Draft): number {

    var system_id = draft.rowSystemMapping[ndx];
    //are any other rows assigned to this system or is this the first
    const count: number = draft.rowSystemMapping.reduce((acc, val) => {
      if (val === system_id) {
        acc = acc + 1;
      }
      return acc;
    }, 0);


    //this is the only one assigned
    if (count === 1) {
      return 0; // return the starting index
    } else {
      return this.getNextWeftSystemFrom(system_id);
    }

  }

  getWeftSystemCode(id: number): string {
    var system = this.getWeftSystem(id);
    if (system === undefined) return "err";
    return system.name;
  }

  getWarpSystemCode(id: number) {

    var system = this.getWarpSystem(id);
    if (system === undefined) return "err";
    return system.name;
  }



}
