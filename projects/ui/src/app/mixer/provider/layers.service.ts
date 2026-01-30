import { Injectable } from '@angular/core';


/**
 * a service that keeps track of how many elements are on the screen so that new 
 * layers can always be drawn in front
 */
@Injectable({
  providedIn: 'root'
})
export class LayersService {

  count: number;

  constructor() {
    this.count = 0;
   }

   createLayer(): number{
     this.count++;
     return this.count;
   }

   clearLayers(){
     this.count = 0;
   }

  getFrontLayer():number{
    return this.count;
  }

}
