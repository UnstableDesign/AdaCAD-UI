
import { electronMassDependencies } from "mathjs";
import { first } from "rxjs/operators";
import { createCellFromSequenceVal, getCellValue } from "./cell";
import { Cell, Drawdown } from "./datatypes";
import utilInstance from "./util";

export module Sequence{

  export class OneD{

    private state: Array<number> = [];


    constructor(initSequence:Array<number> = []){
      if(initSequence){
        this.state = initSequence.slice();
      }
      return this;
    }

       /**
     * adds a new value to the front of current sequence state
     * @param val can accept a number or boolean. 
     */
       unshift(val: number | boolean){
        if(typeof val == 'number'){
          this.state.unshift(val)
        }else{
          switch(val){
            case null:
              this.state.unshift(2);
              break;
            case false: 
              this.state.unshift(0);
              break;
            case true: 
              this.state.unshift(1);
              break;
          }
        }
  
        return this;
      }

    /**
     * pushes a new value to the current sequence state
     * @param val can accept a number or boolean. 
     */
    push(val: number | boolean){
      if(typeof val == 'number'){
        this.state.push(val)
      }else{
        switch(val){
          case null:
            this.state.push(2);
            break;
          case false: 
            this.state.push(0);
            break;
          case true: 
            this.state.push(1);
            break;
        }
      }

      return this;
    }

 

     pushMultiple(push_val: number | boolean, multiple: number){

      for(let i = 0; i < multiple; i++){
        this.push(push_val);
      }
      return this;

    }

    unshiftMultiple(push_val: number | boolean, multiple: number){

      for(let i = 0; i < multiple; i++){
        this.unshift(push_val);
      }
      return this;

    }
    
  

    /**
     * repeats or cuts the current sequence so that it is of length n.
     * @param n the length of the sequence 
     */
    resize(n: number){


      if(this.state.length == 0) return;
      let len = this.state.length;

      if(n < len){
        this.state = this.state.slice(0, n);
      }else{

        let remainder = n - len;

        for(let j = 0; j < remainder; j++){
          this.state.push(this.state[j%len]); 
        };
      }

      return this;
    }

        /**
     * adds unset cells so that it is of length n.
     * @param n the length of the sequence 
     */
      padTo(n: number){

        if(this.state.length == 0) return;
  
        let len = this.state.length;
        let remainder = n - len;
  
        for(let j = 0; j < remainder; j++){
          this.state.push(2); 
        };
  
        return this;
      }
    


    /**
     * inverts all of the values of the current state
     * @returns 
     */
    invert(){
      this.state = this.state.map(el => {
        if(el == 2) return 2;
        else return (el == 0) ? 1: 0;
      });
      return this;
    }

     /**
     * slices a portion of the sequence
     * @returns 
     */
      slice(start: number, end: number){
        this.state = this.state.slice(start, end);
        return this;
      }
    

    /**
     * clears the current state and pushes a new row into the state value
     * @param row 
     * @returns 
     */
    import(row: Array<Cell> | Array<number>){
      this.state = [];
      row.forEach(cell => {
        if(typeof cell == 'number') this.push(cell);

        else this.push(getCellValue(cell));
      })
      return this;

    }

      /**
     *  pushes a new row into the state value without clearing the state
     * @param row 
     * @returns 
     */
      pushRow(row: Array<Cell> | Array<number>){
        row.forEach(cell => {
          if(typeof cell == 'number') this.push(cell);
  
          else this.push(getCellValue(cell));
        })
        return this;
  
      }

    deleteAndDrawIn(val: number){

      if(val < 1 || val >= this.state.length) return this;
      
      let deleted = this.state[val];

      this.state = this.state.filter((el, ndx) => ndx !== val);
      this.state.unshift(deleted);
      // this.state.push(deleted);
      return this;
    }

    /**
     * given a sequence as input. It makes sure the current state and the sequence submitted to the function are modified to be the same length. They are made the same length by appending unset values to the sequence.  
     * @param seq 
     * @returns 
     */
    matchSize(seq: Sequence.OneD) {
      if(this.state.length < seq.length()){
        let diff = seq.length() - this.state.length;
        this.pushMultiple(2, diff);
      }else if(this.state.length > seq.length()){
        let diff = seq.length() - this.state.length;
        seq.pushMultiple(2, diff)
      }
      return this;
    }

    computeFilter(filter: string, seq: Sequence.OneD){

      this.matchSize(seq);

      for(let i = 0; i < this.length(); i++){
        let bool_a = null;
        if(this.state[i] == 0) bool_a = false;
        if(this.state[i] == 1) bool_a = true;

        let bool_b = null;
        if(seq.get(i) == 0) bool_b = false;
        if(seq.get(i) == 1) bool_b = true;
        let res:boolean = utilInstance.computeFilter(filter, bool_a, bool_b);

        switch (res){
          case null:
            this.state[i] = 2;
            break;
          case false:
            this.state[i] = 0;
            break;
          case true:
            this.state[i] = 1;
            break;
        }
      }

      return this;

    }


    /**
     * shifts the sequence in the amount of val
     * @param val a positive or negative number that controls the direction of the shift
     * @returns 
     */
    shift(val: number){
      this.state = this.state.map((el, ndx) => {     
        let shift_ndx = (ndx - val)%this.state.length;
        if(shift_ndx < 0) shift_ndx+= this.state.length;
        return this.state[shift_ndx];
      });
      return this;
    }

    /**
     * repeats the sequence val times returning a sequence of size val * original sequence
     * @param val the number of times you would like to repeat. 1 returns itself. 0 returns nothing
     * @returns 
     */
    repeat(val: number){
      if(val <= 0) return;
      for(let j = 0; j < val-1; j++){
        this.state = this.state.concat(this.state);
      }
      return this;
    }


    reverse(){
      this.state = this.state.reverse();
      return this;
    }


    /**
     * provides the value of the state at this given moment of computation. 
     * @returns the sequence as a numeric array
     */
    val():Array<number>{
      return this.state.slice();
    }

    /**
     * gets the value at a specified position
     * @returns the value at this location, or -1 if the location was invalid
     */
    get(i: number):number{
      if(i >= 0 && i < this.length()) return this.state[i];
      return -1;
    }

       /**
     * gets the value at a specified position
     * @returns the value at this location, or -1 if the location was invalid
     */
    set(i: number, val: number |boolean){
        if(i < 0 || i > this.length()) return this;

        let insert_val = <number> val;
        if(typeof val != 'number'){
         
          switch(val){
            case null:
              insert_val = 2;
              break;
            case false: 
            insert_val = 0;
            break;
            case true: 
            insert_val = 1;
            break;
          }
        }

        this.state[i] = insert_val
        return this;
    }
        
    

    /**
     * returns the length of the given state
     * @returns a number 0 or above
     */
    length():number{
      return this.state.length;
    }

  

  }

  export class TwoD{

    private state: Array<Array<number>> = [];


    constructor(){
      return this;
    }


    deleteWeft(i: number){
      this.state = this.state.filter((el, ndx)=> ndx != i);
      return this;
   }

   deleteWarp(j: number){
     this.state.forEach((row, i) => {
      this.state[i] = row.filter((el, ndx)=> ndx != j);
     });
     return this;
  }

  /**
   * uses the current state to populate a new space, but only upon a certain set of warps and wefts. 
   * @param weftsys - the weft system upon which to map this draft
   * @param warpsys - the warp system upon which to map this draft
   * @param weft_system_map - the pattern of weft systems along the wefts
   * @param warp_system_draft - the pattern of warp systems along the warps
   * @param ends - the number of ends required in the output structure (based on the lcm of input warps)
   * @param pics - the number of picks required in the output structure (based on the lcm of input wefts)
   */
  mapToSystems(weftsys: Array<number>, warpsys: Array<number>, weft_system_map: Sequence.OneD, warp_system_map: Sequence.OneD, ends: number, pics: number){

    //create a blank draft of the size needed that we'll copy into 
    let mapped_seq = new Sequence.TwoD().setBlank(2).fill(ends, pics);

    //now map the new values within that space
    let within_sequence_i = 0; 
    let within_sequence_j = 0;

    for(let i = 0; i < pics; i++){
     
      let active_weft_system = weft_system_map.get(i%weft_system_map.length());

      if(weftsys.find(el => el == active_weft_system) !== undefined){
       
        within_sequence_j = 0;
       
        for(let j = 0; j < ends; j++){
          let active_warp_system = warp_system_map.get(j%warp_system_map.length());
          if(warpsys.length == 0){
            // mapped_seq.set(i, j, this.get(within_sequence_i, within_sequence_j), false)
            // within_sequence_j = (within_sequence_j + 1) % this.warps();
          }else if(warpsys.find(el => el == active_warp_system) !== undefined){
            mapped_seq.set(i, j, this.get(within_sequence_i, within_sequence_j), false)
            within_sequence_j = (within_sequence_j + 1) % this.warps();
          }
        }
        within_sequence_i = (within_sequence_i + 1) % this.wefts();
      }
    }

    this.state = mapped_seq.state.slice();
    return this;

  }



  /**
   * used to assign a structure to every weft system associated with a given warp system
   * @param warpsys 
   * @param weft_system_map 
   * @param warp_system_map 
   * @returns 
   */
  mapToWarpSystems(warpsys: Array<number>, weft_system_map: Sequence.OneD, warp_system_map: Sequence.OneD, ends: number, pics:number){

    //create a blank draft of the size needed that we'll copy into 
    let mapped_seq = new Sequence.TwoD().setBlank(2).fill(ends, pics);

    //now map the new values within that space
    let within_sequence_i = 0; 
    let within_sequence_j = 0;

    for(let j = 0; j < ends; j++){
      let active_warp_system = warp_system_map.get(j%warp_system_map.length());
  
      if(warpsys.find(el => el == active_warp_system) !== undefined){
       
        within_sequence_i = 0;
        
        for(let i = 0; i < pics; i++){

            mapped_seq.set(i, j, this.get(within_sequence_i, within_sequence_j), false)
            within_sequence_i = (within_sequence_i + 1) % this.wefts();
  
        }
        within_sequence_j = (within_sequence_j + 1) % this.warps();
      }
    }

    this.state = mapped_seq.state.slice();
    return this;

  }


  /**
   * used to handle layers that are composed only of floats, this function writes this stored sequence accross all warp systems 
   * @param weftsys 
   * @param weft_system_map 
   * @param warp_system_map 
   * @returns 
   */
  mapToWeftSystems(weftsys: Array<number>, weft_system_map: Sequence.OneD, warp_system_map: Sequence.OneD, ends: number, pics: number){

    //create a blank draft of the size needed that we'll copy into 
    let mapped_seq = new Sequence.TwoD().setBlank(2).fill(ends, pics);

    //now map the new values within that space
    let within_sequence_i = 0; 
    let within_sequence_j = 0;

    for(let i = 0; i < pics; i++){
      let active_weft_system = weft_system_map.get(i%weft_system_map.length());
      if(weftsys.find(el => el == active_weft_system) !== undefined){
        within_sequence_j = 0;
        for(let j = 0; j < ends; j++){

            mapped_seq.set(i, j, this.get(within_sequence_i, within_sequence_j), false)
            within_sequence_j = (within_sequence_j + 1) % this.warps();
          
        }
        within_sequence_i = (within_sequence_i + 1) % this.wefts();
      }
    }

    this.state = mapped_seq.state.slice();
    return this;

  }




  /**
   * places the non unset values from seq atop any unset values in the current state. It will also make the two sequences compatable sizes by repeating their original values. 
   * @param seq 
   * @returns 
   */
  overlay(seq: Sequence.TwoD, consider_heddle_down_as_unset: boolean) {

    //first, make the seqences of compatible sizes
    let total_wefts: number = 0;
    total_wefts = utilInstance.lcm([this.wefts(), seq.wefts()]);

    let total_warps: number = 0;
    total_warps = utilInstance.lcm([this.warps(), seq.warps()]);

    this.fill(total_warps, total_wefts);
    seq.fill(total_warps, total_wefts);


    this.state.forEach((row, i) => {
      row.forEach((cell, j) => {
        if(seq.get(i, j) !== 2 && cell == 2){
          this.set(i, j, seq.get(i, j), false);
        }else if(seq.get(i, j) !== 2 && cell != 2){
          if(consider_heddle_down_as_unset){
            if(seq.get(i, j) == 1){
              this.set(i,j, 1, true);
            }
          }else{
              console.error("Sequence 2D, overlay is attempting to overwrite a set value");
          }
        }
      })
    })

    




    return this;
  }

  /**
   * looks at the given weft. Sets any unset value in this weft to the value provided to the function
   * @param i 
   * @param val 
   */
  setUnsetOnWeft(i: number, val: number) {

    let weft:Array<number> = this.getWeft(i);
    weft.forEach((el, j) => {
      if(el == 2) this.set(i, j, val, false);
    });

    return this;
  }

    /**
   * looks at the given warp. Sets any unset value in this warp to the value provided to the function
   * @param j 
   * @param val 
   */
    setUnsetOnWarp(j: number, val: number) {

      let warp:Array<number> = this.getWarp(j);
      warp.forEach((el, i) => {
        if(el == 2){
          this.set(i, j, val, false);
        }
      });

      return this;
    }
  

  /**
   * given a current warp and weft system, as well as a list of the weft and warp systems that have been assigned to layers "above" the current warp and weft system, this function will ensure that structures are assigned such that they fall just under the previous layers in the layer stack
   * @param cur_warp_sys  the current warp systems we are considering
   * @param warp_sys_above the warp systems that have been used in previous layers above this layer
   * @param cur_weft_sys  the current weft systems we are considering
   * @param weft_sys_above the weft systems that have been used in previous layers above this layer
   * @param weft_system_map a map of the weft systems used in this draft
   * @param warp_system_map a map of the warp systems used in this draft
   * @returns 
   */
  placeInLayerStack(cur_warp_sys: Array<number>, warp_sys_above: Array<number>, cur_weft_sys: Array<number>,weft_sys_above:Array<number>, weft_system_map: Sequence.OneD, warp_system_map: Sequence.OneD ){


    //associate the warp system with the layer by moving all other weft systems on the current warp systems out of the way (raise)
    warp_sys_above.forEach(warp_above => {
      cur_weft_sys.forEach(cur_weft => {
          for(let i = 0; i < this.state.length; i++){
            for(let j = 0; j < this.state[0].length; j++){

              let weft_sys = weft_system_map.get(i % weft_system_map.length());
              let warp_sys = warp_system_map.get(j % warp_system_map.length());

              if(weft_sys == cur_weft && warp_sys == warp_above){
                this.set(i, j, 1, true);
              }
            }
          }
      })
    })

     //associate the warp system with the layer by moving all other weft systems on the current warp systems out of the way (raise)
     weft_sys_above.forEach(weft_above => {
      cur_warp_sys.forEach(cur_warp => {

          for(let i = 0; i < this.state.length; i++){
            for(let j = 0; j < this.state[0].length; j++){
              let weft_sys = weft_system_map.get(i % weft_system_map.length());
              let warp_sys = warp_system_map.get(j % warp_system_map.length());
              if(warp_sys == cur_warp && weft_sys == weft_above){
                this.set(i, j, 0, true);
              }
            }
          }
      })
    })

    return this;
  }



  /**
   * this function uses a mapping of warp systems to layers to calculate teh relationships between lifted and lowered weft systems based on layer order. 
   * it assumes that the draft has already been mapped to systems and then, starting from the top layer, assigns the remaining weft systems to down and reamining warp system to lift. It progresses down the layer stack in this order. 
   * @param warp_system_to_layers 
   * @param warp_system_map 
   * @returns 
   */
  // layerSystems(warp_system_to_layers: Array<{ws: number, layer: number}>, warp_system_map: Sequence.OneD){


  //   console.log("warp system layer map ", warp_system_to_layers)
  //   console.log("warp system map ", warp_system_map)


  //   let before_layering: Sequence.TwoD = this.copy();

  //   //get the actual layers we are dealing with
  //   let layers = utilInstance.filterToUniqueValues(warp_system_to_layers.map(el => el.layer));

  //   for(let l = 0; l < layers.length; l++){

  //     //get the warp systems associated with this layer
  //     let warp_systems: Array<number> = warp_system_to_layers.filter(el => el.layer == l+1).map(el => el.ws);

  //     //now go through the wefts, do they interlace on this warp? If yes, 
  //     //set all the unset values on this weft to down
  //     before_layering.state.forEach((row, i) => {
        
  //       //get the first set value
  //       let first_set = row.findIndex(el => el !== 2);

  //       if(first_set !== -1){
  //         //is it on this warp system? 
  //         let interlacing_ws = warp_system_map.get(first_set);
  //         // console.log("First set value on  ", i, " is ", first_set, "interlacing on ", interlacing_ws, " current warp system is ", warp_systems);

  //         if(warp_systems.find(el => el == interlacing_ws) !== undefined){
  //           //this warp system is interlacing on this layer!
  //           this.setUnsetOnWeft(i, 0);
  //         }
  //       }

  //     });

  //     //now, set all the unset values on the warps associated with this 
  //     for(let j = 0; j < this.warps(); j++){
  //       let warp_syst = warp_system_map.get(j % warp_system_map.length());
  //       if(warp_systems.find(el => el == warp_syst) !== undefined){
  //         this.setUnsetOnWarp(j, 1); //TODO needs to verify system here, 
  //       }
  //     }


  //   } // end for each layer
    

  //   return this;


  // }

/**
 * this sets the value at a given location specified by i and j
 * This function will only succesfully set a value if the current value in that place is "unset", otherwise it returns an error that it is attempting to overwrite a value
 * @param i 
 * @param j 
 * @param val 
 * @returns 
 */
  set(i: number, j: number, val: number, can_overwrite_set: boolean) {
    if(i < 0 || i >= this.wefts()){
      console.error("Sequence2D - attempting to set an out of range weft value");
      return this;
    }
    if(j < 0 || j >= this.warps()){
      console.error("Sequence2D - attempting to set an out of range warp value");
      return this;
    }

    if(this.state[i][j] !== 2 && !can_overwrite_set){

        console.error("overriding set value at ", i, j, this.state[i][j]);
      return this;
    }

    this.state[i][j] = val;
    return this;
  }

  get(i: number, j: number) : number {


    if(i < 0 || i >= this.wefts()){
      console.error("Sequence2D - attempting to get an out of range weft value");
      return -1;
    }
    if(j < 0 || j >= this.warps()){
      console.error("Sequence2D - attempting to get an out of range warp value");
      return -1;
    }

    return  this.state[i][j];
  }

  getWeft(i: number )  : Array<number>{
    if(i < 0 || i >= this.wefts()){
      console.error("Sequence2D - attempting to get an out of range weft value");
      return [];
    }

    return this.state[i];

  }

  getWarp(j: number )  : Array<number>{
    if(j < 0 || j >= this.warps()){
      console.error("Sequence2D - attempting to get an out of range warp value");
      return [];
    }
    return this.state.reduce((acc, val) => {
      return acc.concat(val[j]);
    }, []);

  }



  /**
   * adds a row to the first (or subsequent row) of the 2D sequence
   * @param seq the 1D sequence value to add 
   * @returns 
   */
  pushWarpSequence(seq: Array<number>){

    let height = this.state.length;
    if(height > 0 && height != seq.length){
     
      let lcm = utilInstance.lcm([height, seq.length]);
      let width = this.state[0].length;

      let difference = lcm - height;
      if(difference > 0){
        for(let i = 0; i < difference; i++){
          this.state.push([]);
        }
      }



      for(let j = 0; j < width; j++){
        let col = this.state.map(el => el[j]);
        let col_seq = new OneD(col).resize(lcm).val();
        for(let i = 0; i < lcm; i++){
          this.state[i][j] = col_seq[i];
        }
      }
    }

    if(this.state.length == 0){
      seq.forEach((num, ndx) => {
        this.state.push([]);
      })
    }

    seq.forEach((num, ndx) => {
      this.state[ndx].push(num);
    })
    
    return this;
  }

    /**
   * adds this weft to the front of the pattern
   * @param seq the 1D sequence value to add 
   * @returns 
   */
    unshiftWarpSequence(seq: Array<number>){
      let height = this.state.length;
      if(this.state.length > 0 && height != seq.length){
        let lcm = utilInstance.lcm([height, seq.length]);
        let width = this.state[0].length;
  
        for(let j = 0; j < width; j++){
          let col = this.state.map(el => el[j]);
          let col_seq = new OneD(col).resize(lcm).val();
          for(let i = 0; i < lcm; i++){
            this.state[i][j] = col_seq[i];
          }
        }
      }
  
      if(this.state.length == 0){
        seq.forEach((num, ndx) => {
          this.state.push([]);
        })
      }
  
      seq.forEach((num, ndx) => {
        this.state[ndx].unshift(num);
      })
      
      return this;

    
  }

    /**
   * adds a col to the first (or subsequent col) of the 2D sequence
   * @param seq the 1D sequence value to add 
   * @returns 
   */
    pushWeftSequence(seq: Array<number>){


    
    if(this.state.length > 0 && this.state[0].length !== seq.length){
        let width = this.state[0].length;     

        let lcm = utilInstance.lcm([width, seq.length]);
        
        this.state.forEach((row, ndx) => {
          this.state[ndx] = new OneD(row).resize(lcm).val();
        })
      }
      this.state.push(seq);

    
    return this;
  }

   /**
   * adds this weft to the front of the pattern
   * @param seq the 1D sequence value to add 
   * @returns 
   */
    unshiftWeftSequence(seq: Array<number>){


    
        if(this.state.length > 0 && this.state[0].length !== seq.length){
            let width = this.state[0].length;     
  
            let lcm = utilInstance.lcm([width, seq.length]);
            
            this.state.forEach((row, ndx) => {
              this.state[ndx] = new OneD(row).resize(lcm).val();
            })
          }
          this.state.unshift(seq);
  
        
        return this;
    }

    setBlank(val: number | boolean = 2){

      let res = new OneD().push(val).val();
      this.state = [res];
      return this;
    }

    wefts(): number{
      return this.state.length;
    }

    warps(): number{
      if(this.state.length == 0) return 0;
      return this.state[0].length;
    }


    /**
     * fills a rectangle of given size with the current state. If the rectangle specified is smaller than state, it crops the current state
     * @param w the width
     * @param h the hieght
     */
    fill(w: number, h: number) {
      if(w < 0 || h < 0) return this;
      if(this.state.length == 0) return;

      let len_h = this.state.length;

      for(let i = 0; i < h; i++){
        let row;
        let len_w = this.state[i%len_h].length;

        if(w >= len_w){ 
          row = new OneD(this.state[i%len_h]).resize(w).val();
        }else{
          row = new OneD(this.state[i%len_h].slice(0, w)).val()
        }
        this.state[i] = row;
      }

      if(h < len_h){
        this.state = this.state.slice(0, h);
      }


      return this;
    }

    copy() : Sequence.TwoD {

      let dd = this.export();
      let copy = new Sequence.TwoD();
      copy.import(dd);

      return copy;
    }


    /**
     * clears the current state (if any)
     * and creates a new 2D Sequence Object from a DD
     * @param dd 
     */
    import(dd: Drawdown) {
      this.state = [];
      dd.forEach((row, i) => {
        this.state.push([]);
        row.forEach((cell, j)=> {
          switch(getCellValue(cell)){
            case null:
              this.state[i][j] = 2;
              break;
            case false:
              this.state[i][j] = 0;
              break;
            case true:
              this.state[i][j] = 1;
              break;
          }
        })
      });
      return this;
    }

    /**
     * converts the current state to a drawdown format
     * @returns 
     */
    export() : Drawdown {

      const dd: Drawdown = [];
      this.state.forEach((row, i) =>{
        dd.push([]);
        row.forEach((cell_val, j) => {
          dd[i][j] = createCellFromSequenceVal(cell_val);
        });
      })
      return dd;

    }

  }

  
}


