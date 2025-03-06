/**
 * A collection of functions that are heplful within many areas of the tool
 * @class
 */

import { SubdraftComponent } from "../../mixer/palette/subdraft/subdraft.component";
import { FileService } from "../provider/file.service";
import { MaterialMap, MaterialsService } from "../provider/materials.service";
import { SystemsService } from "../provider/systems.service";
import { getCellValue, setCellValue } from "./cell";
import { Point, Interlacement, Bounds, Draft, Loom, LoomSettings, Material, Cell } from "./datatypes";
import { flipDraft, getDraftAsImage, getDraftName, hasCell, initDraftWithParams, isSet, warps, wefts } from "./drafts";
import { createMaterial, setMaterialID } from "./material";


class Util {

    /*Input: two arrays
    Result: a boolean value for if they are equal or not
    */
    equals(array1, array2) {
      if (array1.length != array2.length){
        return false;
      } 
      else {
        for (var i =0; i < array1.length; i++) {
          if(array1[i] != array2[i]) {
            return false;
          }
        }
        return true;
      }
    }

   /**
    * given a drawdown and a column index, return the column number of the first matching column
    * @param j 
    * @param drawdown 
    * @returns the col id of the match or -1;
    */
    hasMatchingColumn(j: number, drawdown: Array<Array<Cell>>) : number {
        
      let unmatch = false;
      for(let j_comp = 0; j_comp < drawdown[0].length; j_comp++){
        unmatch = false;
        if(j_comp != j){
          for(let i = 0; i < drawdown.length && !unmatch; i++){
            if(getCellValue(drawdown[i][j]) !== getCellValue(drawdown[i][j_comp])){
              unmatch = true;
            }
          }
          if(!unmatch){
            return j_comp;
          }
        }
      }

      return -1;


    }

      /**
       * a blank draft is one where the drawdown is set to all heddle down 
       * the row and column info is all set to a uniform value.
       * @param d 
       */
      isBlankDraft = (d: Draft, loom: Loom) : boolean => {

        let has_value = false;
        d.drawdown.forEach((row) => {
          row.forEach((cell) => {
            if(cell.is_up) has_value = true;
          })
        })

        if(has_value) return false;
        
        let row_shuttle_unique = this.filterToUniqueValues(d.rowShuttleMapping);
        let col_shuttle_unique = this.filterToUniqueValues(d.colShuttleMapping);
        let row_system_unique = this.filterToUniqueValues(d.rowSystemMapping);
        let col_system_unique = this.filterToUniqueValues(d.colSystemMapping);

        if(row_shuttle_unique.length > 1) return false;
        if(col_shuttle_unique.length > 1) return false;
        if(row_system_unique.length > 1) return false;
        if(col_system_unique.length > 1) return false;

        if(loom == null) return true;

        loom.threading.forEach(frame => {
          if(frame !== -1) return false;
        });

        loom.treadling.forEach(pick => {
          if(pick.length !== 0) return false;
        });

        has_value = false;
        loom.tieup.forEach((row) => {
          row.forEach((cell) => {
            if(cell === true) has_value = true;
          })
        })
        
        return !has_value;
    

      }
     /**
    * given a drawdown and a column index, return if the column is blank
    * @param j 
    * @param drawdown 
    * @returns true or false;
    */
      colIsBlank(j: number, drawdown: Array<Array<Cell>>) : boolean {
        
       
        let blank = true;
        drawdown.forEach((row, i) => {
          if(getCellValue(row[j]) == true) blank = false;
        });
  
        return blank;
  
      }
  

    /**
    * given a drawdown and a row index, return the row number of the first matching row
    * @param j 
    * @param drawdown 
    * @returns the row id of the match or -1;
    */
    hasMatchingRow(i: number, drawdown: Array<Array<Cell>>) : number {
    
    let unmatch = false;
    for(let i_comp = 0; i_comp < drawdown.length; i_comp++){
      unmatch = false;
      if(i_comp != i){
        for(let j = 0; j < drawdown[i_comp].length && !unmatch; j++){
          if(getCellValue(drawdown[i][j]) !== getCellValue(drawdown[i_comp][j])){
            unmatch = true;
          }
        }
        if(!unmatch){
          return i_comp;
        }
      }
    }

    return -1;


  }

    /**
     * A function to count the number of occurances of a give value within an array
     * @param arr the 1D array to search
     * @param val the value we are seeking
     * @returns number of occurances
     */
    countOccurrences(arr, val){
      return arr.reduce((a, v) => (v === val ? a + 1 : a), 0)
    }
      
    /*Input: an array of booleans
    Result: the number of "ones" in the "bitstring" (in this context, returns the number of true valued booleans in the array of booleans)
    */
    countOnes(array) {
      var counter = 0;
      for (var i = 0; i < array.length; i++) {
        if(array[i] == true) {
          counter+=1;
        }
      }
      return counter;
    }
    /*Input: two arrays of booleans
    Result: a new array of length equal to the length of array1 that has combined array1 with array2 under the "exclusive or" operation
    */
    xor(array1, array2) {
      var returnedList = [];
      for (var i = 0; i < array1.length; i++) {
        if (array1[i] && array2[i]) {
          returnedList.push(false);
        } else if (array1[i] || array2[i]) {
          returnedList.push(true);
        } else {
          returnedList.push(false);
        }
      }
      return returnedList;
    }

    maxOfPositiveList(array) {
      var max = -1;
      for (var i = 0; i < array.length; i++){
        if (array[i] > max) {
          max = array[i];
        }
      }
      return max;
    }

    minOfList(array) {
      var min = array[0]
      for (var i = 0; i < array.length; i++) {
        if (array[i] < min) {
          min = array[i]
        }
      }
      return min;
    }

    findSmallestElmtBiggerThan(n, array) {
      var minElmtBiggerThanN = this.maxOfPositiveList(array) + 1;
      for (var i =0; i < array.length; i++) {
        if (array[i] > n && minElmtBiggerThanN[i] > array[i]) {
          minElmtBiggerThanN = array[i];
        }
      }
      return minElmtBiggerThanN;
    }

    findSmallestGap(array) {
      var min = this.minOfList(array);
      var smallestElmtBiggerThan = this.findSmallestElmtBiggerThan(min,array);
      var max = this.maxOfPositiveList(array);
      while (smallestElmtBiggerThan-min < 2 && smallestElmtBiggerThan != (max+1)) {
        min = min+1;
        smallestElmtBiggerThan = this.findSmallestElmtBiggerThan(min,array);
      }
      return smallestElmtBiggerThan;
    }


  /**
   * finds the left-most component, used to create bounding box 
   * @param main the component we are comparing to
   * @param isects all intersecting components
   * @returns the leftmost component
   */
  getLeftMost(main:SubdraftComponent,  isects:Array<SubdraftComponent>):SubdraftComponent{

    return isects.reduce((acc, isect) => {
      if(isect.getTopleft().x < acc.getTopleft().x) {
        acc = isect;
      }
      return acc;
    }, main);    
  }


  /**
   * finds the top-most component, used to create bounding box 
   * @param main the component we are comparing to
   * @param isects all intersecting components
   * @returns the top component
   */
  getTopMost(main:SubdraftComponent,  isects:Array<SubdraftComponent>):SubdraftComponent{

    return isects.reduce((acc, isect) => {
      if(isect.getTopleft().y < acc.getTopleft().y) {
        acc = isect;
      }
      return acc;
    }, main);    
  }



  /**
   * given a list of Bounds objects, this function will merge the bounds such that the top left point represents the top-most and left-most of the values and the width and height contain all values
   * @param list 
   * @returns 
   */
  mergeBounds(list: Array<Bounds>) : Bounds | null {

    list = list.filter(el => el !== null && el !== undefined);
    if(list.length == 0) return null;

    const first = list.pop();

    const tlbr = list.reduce((acc, val) => {

      if(val.topleft.x < acc.topleft.x) acc.topleft.x = val.topleft.x;
      if(val.topleft.y < acc.topleft.y) acc.topleft.y = val.topleft.y;
      if(val.topleft.x+val.width > acc.botright.x) acc.botright.x = val.topleft.x + val.width;
      if(val.topleft.y+val.height > acc.botright.y) acc.botright.y = val.topleft.y + val.height;
      return acc;
    }, {topleft: first.topleft, botright: {x: first.topleft.x + first.width, y: first.topleft.y + first.height}})


    return {
      topleft: {x: tlbr.topleft.x, y: tlbr.topleft.y},
      width: (tlbr.botright.x - tlbr.topleft.x),
      height: (tlbr.botright.y - tlbr.topleft.y),
    }

  }


  /**
   * finds the right-most component, used to create bounding box 
   * @param main the component we are comparing to
   * @param isects all intersecting components
   * @returns the rightmost component
   */
  // getRightMost(main:SubdraftComponent,  isects:Array<SubdraftComponent>):SubdraftComponent{

  //   return isects.reduce((acc, isect) => {
  //     if((isect.getTopleft().x + isect.bounds.width) > (acc.getTopleft().x + acc.bounds.width)) {
  //       acc = isect;
  //     }
  //     return acc;
  //   }, main);    
  // }

  /**
   * finds the bottom-most component, used to create bounding box 
   * @param main the component we are comparing to
   * @param isects all intersecting components
   * @returns the bottom-most component
   */
  // getBottomMost(main:SubdraftComponent,  isects:Array<SubdraftComponent>):SubdraftComponent{

  //   return isects.reduce((acc, isect) => {
  //     if((isect.getTopleft().y + isect.bounds.height)> (acc.getTopleft().y + acc.bounds.height)) {
  //       acc = isect;
  //     }
  //     return acc;
  //   }, main);    
  // }

  /**
   * takes absolute screen coordinates and returns the i, j position if a cell were to exist at that point
   * considers the top banner of 62 pixels to offset
   * @param p the point
   * @param scale the scale of the view we are using
   * @returns an Interlacement
   */
  // resolveCoordsToNdx(p: Point, scale:number) : Interlacement {  
  //   const i = Math.floor((p.y) / scale);
  //   const j = Math.floor((p.x) / scale);
  //   return {i: i, j: j, si: i};
  // }

  /**
   * takes two interlacements and sees if they are the same
   * @param p1 the point
   * @param p2 the point
   */
  isSameNdx(p1: Interlacement, p2:Interlacement) : boolean {    
    if(p1.i != p2.i ) return false;
    if(p1.j != p2.j) return false;
    return true;
  }

   /**
   * takes two booleans and returns their result based on the ink assigned
   * @param ink the name of the ink in question 
   * @param a the first (top) value 
   * @param b the second (under) value
   * @returns boolean result
   */
  computeFilter(ink: string, a: boolean, b: boolean):boolean{
      switch(ink){
        case 'neq':
          if(a == null) return b;
          if(b == null) return a;
          return (a !== b);
        break;
  
        case 'up':
          if(a === null) return b;
          if(b === null) return a;
          return b;
        break;
  
        case 'down':
          if(a === null) return b;
          if(b === null) return a;
          if(a === false) return false;
          return b;
        break;
  
        case 'unset':
          if(a === null) return b;
          if(b === null) return a;
          if(a === true) return null;
          else return b;
        break;
  
        case 'and':
        if(a === null || b === null) return null;
        return (a && b)
        break;

        case 'cut':
          if(a == null) return a;
          if(b === null) return a;
          if(a == true && b == true) return false;
          return a;
          break;
  
        case 'or':
          if(a === null) return b;
          if(b === null) return a;
          return (a || b);
        break;
  
      }
    }

/**
 * check if the rectangles defined by the points overlap
 * @param l1 top left point of rectangle 1
 * @param r1 bottom right point of rectangle 1
 * @param l2 top left point of rectangle 2
 * @param r2 bottom right point of rectanble 2
 * @returns true or false in accordance to whether or not they overlap
 */
  doOverlap(l1:Point,  r1:Point,  l2:Point,  r2:Point){

    if (l1.x == r1.x || l1.y == r2.y || l2.x == r2.x
        || l2.y == r2.y) {
        // the line cannot have positive overlap
        return false;
    }

    // If one rectangle is on left side of other
    if (l1.x >= r2.x || l2.x >= r1.x){
        return false;
      }

    // If one rectangle is above other
    if (l1.y >= r2.y || l2.y >= r1.y){
        return false;
    }
    return true;
  }

    /**
     * computes the value of a heddle given overlapping drafts
     * @param p the point we are interested in
     * @param main the top draft
     * @param isect the intersecting drafts
     * @returns 
     */
    computeHeddleValue(p:Point, main: SubdraftComponent, isect: Array<SubdraftComponent>):boolean{
      const a:boolean = main.resolveToValue(p);
      //this may return an empty array, because the intersection might not have the point
      const b_array:Array<SubdraftComponent> = isect.filter(el => el.hasPoint(p));
  
      //should never have more than one value in barray
      // if(b_array.length > 1) console.log("WARNING: Intersecting with Two Elements");
  
      const val:boolean = b_array.reduce((acc:boolean, arr) => arr.resolveToValue(p), null);   
      
      return utilInstance.computeFilter(main.ink, a, val);
    }


    /**
   * takes an absolute point and returns the "cell" boundary that is closest. 
   * @param p the absolute point
   * @returns the snapped point 
   */
    snapToGrid(p: Point, scale:number):Point{

      p.x = Math.floor(p.x / scale) * scale;
      p.y = Math.floor(p.y / scale) * scale;
      return p;

    }

  /**
   * returns the number of wefts that is greatest out of all the input drafts
   * 
   */
  public getMaxWefts(inputs: Array<Draft>) : number{

    const max_wefts:number = inputs
    .filter(el => el !== null)
    .reduce((acc, draft)=>{
      if(wefts(draft.drawdown) > acc) return wefts(draft.drawdown);
      return acc;
      }, 0);
      return max_wefts;
  }

  /**
 * returns the number of warps that is greatest out of all the input drafts
 */
    public getMaxWarps(inputs: Array<Draft>) : number{


    const max_warps:number = inputs
    .filter(el => el !== null)
    .reduce((acc, draft)=>{
      if(warps(draft.drawdown) > acc) return warps(draft.drawdown);
      return acc;
      }, 0);
      return max_warps;
  }

  /**
   * given a list of values, return the value that occurs the most
   * @param vals 
   */
  public getMostCommon(vals: Array<any>): any{


    const freq: Array<{i: any,count: any}>  = vals.reduce((acc, el) => {
      const ndx = acc.findIndex(acc_el => acc_el.i === el);  
      if(ndx === -1){
        acc.push({i: el, count: 1});
      }else{
        acc[ndx].count++;
      }
      return acc;
    }, []);

    const common:{i: any,count: any} = freq.reduce((acc, el) => {
      if(el.count > acc.count) return el;
      else return acc;
    }, {i:null, count: 0});

    return common.i;
  }

  getInt(val, e) {
    var index = e.search(val);
    if (index != -1) {
      var substring = e.substring(index, e.length);
      var endOfLineChar = '\n';
      var endIndex = substring.indexOf(endOfLineChar);
      if (endIndex!= -1) {
        return +(substring.substring(val.length+1,endIndex)); //string is converted to int with unary + operator
      } else {
        return -1;
      }
    } else {
      return -1;
    }
  }


  getBool(val, e) {
    var index = e.search(val);
    if (index != -1) {
      var substring = e.substring(index, e.length);
      var endOfLineChar = '\n';
      var endIndex = substring.indexOf(endOfLineChar);
      if (endIndex!= -1 && substring.substring(val.length+1,endIndex) === "yes") {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  getString(val, e) {
    var index = e.search(val);
    if (index != -1) {
      var substring = e.substring(index, e.length);
      var endOfLineChar = '\n';
      var endIndex = substring.indexOf(endOfLineChar);
      if (endIndex != -1) {
        return substring.substring(val.length+1, endIndex);
      } else {
        return "";
      }
    } else {
      return "";
    }
  }

  getSubstringAfter(val, e){
    var index = e.search(val);
    if( index != -1 ){
      return e.substring(index+val.length);
    } else {
      return e;
    }
  }

  getTreadling(e, draft) {
    var treadling = [];
    var treadles = this.getInt("Treadles", e);

    for (var i=0; i  < draft.wefts; i++) {
      treadling.push(-1);
    }

    var indexOfLabel = e.search("TREADLING]");
    var startIndex = indexOfLabel + "TREADLING]".length+1;
    var endOfLineChar = '\n';
    var endIndex = (e.substring(startIndex)).indexOf(endOfLineChar)+startIndex;
    var line = e.substring(startIndex, endIndex);

    while(line.match(/[0-9]*=[0-9]*/) != null) {
      var weft = +(line.match(/[0-9]*/));
      var treadle = +(line.match(/=[0-9]*/)[0].substring(1));
      treadling[weft-1] = treadle-1;
      startIndex = endIndex+1;
      endIndex = e.substring(startIndex).indexOf(endOfLineChar)+startIndex;
      line = e.substring(startIndex,endIndex);
    }

    return treadling;
  }

  getThreading(e, draft) {
    var threading = [];

    for (var i = 0; i < draft.warps; i++) {
      threading.push(-1);
    }

    var indexOfLabel = e.search("THREADING]");
    var startIndex = indexOfLabel + "THREADING]".length+1;
    var endOfLineChar = '\n';
    var endIndex = (e.substring(startIndex)).indexOf(endOfLineChar)+startIndex;
    var line = e.substring(startIndex, endIndex);

    while (line.match(/[0-9]*=[0-9]*/) != null) {
      var warp = +(line.match(/[0-9]*/));
      var frame = +(line.match(/=[0-9]*/)[0].substring(1));
      threading[draft.warps - warp] = frame-1;
      startIndex = endIndex+1;
      endIndex = e.substring(startIndex).indexOf(endOfLineChar)+startIndex;
      line = e.substring(startIndex,endIndex);
    }

    return threading;
  }

  getTieups(e, draft) {
    var tieups = [];
    var frames = this.getInt("Shafts", e);
    var treadles = this.getInt("Treadles", e);

    for (var i = 0; i < frames; i++) {
      tieups.push([]);
      for (var j = 0; j < treadles; j++) {
        tieups[i].push(false);
      }
    }

    var indexOfLabel = e.search("TIEUP]");
    var startIndex = indexOfLabel + "TIEUP]".length+1;
    var endOfLineChar = '\n';
    var endIndex = (e.substring(startIndex)).indexOf(endOfLineChar)+startIndex;
    var line = e.substring(startIndex, endIndex);

    while (line.match(/[0-9]*=[0-9]*/) != null) {
      var treadle = +(line.match(/[0-9]*/));
      var firstFrame = +(line.match(/=[0-9]*/)[0].substring(1));
      tieups[firstFrame-1][treadle-1] = true;
      var restOfFrames = line.match(/,[0-9]/g);
      if(restOfFrames != null) {
        for (var i = 0; i < restOfFrames.length; i++) {
          var currentFrame = +(restOfFrames[i].substring(1));
          tieups[currentFrame-1][treadle-1] = true;
        }
      }
      startIndex = endIndex+1;
      endIndex = e.substring(startIndex).indexOf(endOfLineChar)+startIndex;
      line = e.substring(startIndex,endIndex);
    }
      
    return tieups;
  }

  //can likely simplify this as it is mostlyy like the function above but with different variable names for the respective applications
  getColorTable(e) :Array<Material>  {
    var color_table = [];
    var originalShuttle = createMaterial();
    originalShuttle.color = "#3d3d3d";
    setMaterialID(originalShuttle, 0);
    color_table.push(originalShuttle);

    var indexOfLabel = e.search("COLOR TABLE]");
    var startIndex = indexOfLabel + "COLOR TABLE]".length+1;
    var endOfLineChar = '\n';
    var endIndex = (e.substring(startIndex)).indexOf(endOfLineChar)+startIndex;
    var line = e.substring(startIndex, endIndex);
    var id = 1;

    while (line.match(/[0-9]*=[0-9]*,[0-9]*,[0-9]*/) != null) {
      // var index = +(line.match(/[0-9]*/));
      var redNum = +(line.match(/=[0-9]*/)[0].substring(1));
      var greenAndBlue = line.match(/,[0-9]*/g);
      var greenNum = +(greenAndBlue[0].substring(1));
      var blueNum = +(greenAndBlue[1].substring(1));

      var hex = "#";
      var hexr = redNum.toString(16);
      if(hexr.length ==1 ){
        hex += "0"+hexr;
      } else {
        hex += hexr;
      }
      var hexg= greenNum.toString(16);
      if(hexg.length ==1 ){
        hex += "0"+hexg;
      } else {
        hex += hexg;
      }
      var hexb= blueNum.toString(16);
      if(hexb.length ==1 ){
        hex += "0"+hexb;
      } else {
        hex += hexb;
      }

      var shuttle = createMaterial();
      shuttle.color = hex;
      setMaterialID(shuttle, id);
      id++;

      color_table.push(shuttle);

      startIndex = endIndex+1;
      endIndex = e.substring(startIndex).indexOf(endOfLineChar)+startIndex;
      line = e.substring(startIndex,endIndex);
    }
    return color_table;
  }

  getColToShuttleMapping(e, draft) {
    var colToShuttleMapping = [];

    for (var i = 0; i < draft.warps; i++) {
      colToShuttleMapping.push(0);
    }

    var indexOfLabel = e.search("WARP COLORS]");
    var startIndex = indexOfLabel + "WARP COLORS]".length+1;
    var endOfLineChar = '\n';
    var endIndex = (e.substring(startIndex)).indexOf(endOfLineChar)+startIndex;
    var line = e.substring(startIndex, endIndex);

    while (line.match(/[0-9]*=[0-9]*/) != null) {
      var warp = +(line.match(/[0-9]*/));
      var color = +(line.match(/=[0-9]*/)[0].substring(1));
      colToShuttleMapping[warp-1] = color;
      startIndex = endIndex+1;
      endIndex = e.substring(startIndex).indexOf(endOfLineChar)+startIndex;
      line = e.substring(startIndex,endIndex);
    }

    var reversedMapping = [];
    for (var i = colToShuttleMapping.length-1; i >= 0; i--) {
      reversedMapping.push(colToShuttleMapping[i]);
    }

    return reversedMapping;
  }

  getRowToShuttleMapping(e, draft) {
    var rowToShuttleMapping = [];

    for (var i = 0; i < draft.wefts; i++) {
      rowToShuttleMapping.push(0);
    }

    var indexOfLabel = e.search("WEFT COLORS]");
    var startIndex = indexOfLabel + "WEFT COLORS]".length+1;
    var endOfLineChar = '\n';
    var endIndex = (e.substring(startIndex)).indexOf(endOfLineChar)+startIndex;
    var line = e.substring(startIndex, endIndex);

    while (line.match(/[0-9]*=[0-9]*/) != null) {
      var weft = +(line.match(/[0-9]*/));
      var color = +(line.match(/=[0-9]*/)[0].substring(1));
      rowToShuttleMapping[weft-1] = color;
      startIndex = endIndex+1;
      endIndex = e.substring(startIndex).indexOf(endOfLineChar)+startIndex;
      line = e.substring(startIndex,endIndex);
    }

    return rowToShuttleMapping;
  }

  /**
   * this takes a map of material ideas and updates 
   * @param material_mapping - the mapping of rows of cols to a material 
   * @param index_map - a map from old to new material ids
   * @param replacement_ndx - anything not found in the map will be replaced by this value
   */
  updateMaterialIds(material_mapping: Array<number>, index_map: Array<MaterialMap>, replacement_ndx:number) : Array<number>{

    if(material_mapping === undefined) material_mapping = [];
    //update the existing drafts given the new ids
      const new_map: Array<number> = material_mapping.map(index => {
        const mapping: MaterialMap = index_map.find(el => el.old_id === index);
        if(mapping !== undefined){
          return mapping.new_id;
        }else{
          return replacement_ndx;
        }
   


    });

    return new_map;
  
  }

  /**
   * takes an array of numbers and returns the highest number
   * @param arr 
   * @returns 
   */
  getArrayMax(arr: Array<number>) : number{
    const max: number = arr.reduce((acc, el, ndx)=>{
      if(el > acc) return el;
      else return acc;
    }, 0);
    return max;
  }

  hasOnlyUnsetOrDown(cells: Array<Cell>) : boolean{
    const hasValue = cells.find(el => (getCellValue(el) === true));
    if(hasValue === undefined) return true;
    else return false;
  }
  

  public patternToSize(pattern, warpSize, weftSize) {
    if (pattern[0].length > warpSize) {
        for (var i = 0; i < pattern.length; i++) {
            while(pattern[i].length > warpSize) {
                pattern[i].splice(pattern[i].length-1, 1);
            }
        }
    }
    if (pattern.length > weftSize) {
        while(pattern.length > weftSize) {
            pattern.splice(pattern.length-1, 1);
        }
    }
    var idx = 0;
    while (pattern[0].length < warpSize) {
        for (var j = 0; j < pattern.length; j++) {
            if (idx < pattern[j].length) {
                pattern[j].push(pattern[j][idx]);
            }
        }
        idx += 1;
        if (idx >= pattern[0].length) {
            idx = 0;
        }
    }
    idx = 0;
    while (pattern.length < weftSize) {
        pattern.push(pattern[idx]);
        idx += 1;
        if (idx >= pattern.length) {
            idx = 0;
        }
    }
    return pattern;
}

/**
 * checks two looms settings objects 
 * @param ls1 
 * @param ls2 
 * @returns  true if they have the same value
 */
areLoomSettingsTheSame(ls1: LoomSettings, ls2: LoomSettings) : boolean {
  if(ls1.epi !== ls2.epi) return false;
  if(ls1.frames !== ls2.frames) return false;
  if(ls1.treadles !== ls2.treadles) return false;
  if(ls1.type !== ls2.type) return false;
  if(ls1.units !== ls2.units) return false;
  return true;
}

/**
 * checks two loom objects 
 * @param loom1 
 * @param loom2 
 * @returns  true if they have the same value
 */
areLoomsTheSame(loom1: Loom, loom2: Loom) : boolean {
  if(loom1 === null && loom2 === null) return true;

  for(let ndx = 0; ndx < loom1.threading.length; ndx++){
    if(loom1.threading[ndx] !== loom2.threading[ndx]) return false;
  }


  for(let p = 0; p < loom1.treadling.length; p++){
    for(let q = 0; q < loom1.treadling[p].length; q++){
      if(loom1.treadling[p][q] !== loom2.treadling[p][q]) return false;
    }
  }

  for(let p = 0; p < loom1.tieup.length; p++){
    for(let q = 0; q < loom1.tieup[p].length; q++){
      if(loom1.tieup[p][q] !== loom2.tieup[p][q]) return false;
    }
  }

  return true;
}

/**
 * compares the states of two drafts
 * @param d1 
 * @param d2 
 * @returns true if they are the exact same in terms of the draft data (ignores names and ids)
 */
areDraftsTheSame(d1: Draft, d2: Draft) : boolean {

  if(d1 === null && d2 === null) return true;

  for(let ndx = 0; ndx <  d1.colShuttleMapping.length; ndx++){
    if( d1.colShuttleMapping[ndx] !==  d2.colShuttleMapping[ndx]) return false;
  }

  for(let ndx = 0; ndx <  d1.colSystemMapping.length; ndx++){
    if( d1.colSystemMapping[ndx] !==  d2.colSystemMapping[ndx]) return false;
  }

  for(let ndx = 0; ndx <  d1.rowShuttleMapping.length; ndx++){
    if( d1.rowShuttleMapping[ndx] !==  d2.rowShuttleMapping[ndx]) return false;
  }

  for(let ndx = 0; ndx <  d1.rowSystemMapping.length; ndx++){
    if( d1.rowSystemMapping[ndx] !==  d2.rowSystemMapping[ndx]) return false;
  }

  for(let p = 0; p < d1.drawdown.length; p++){
    for(let q = 0; q < d1.drawdown[p].length; q++){
      if(getCellValue(d1.drawdown[p][q]) !== getCellValue(d2.drawdown[p][q])) return false;
    }
  }

  return true;



}


hexToRgb(hex: string){
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : {
    r: 0, 
    g: 0, 
    b: 0
  };
}

/**
 * in connection with lcm, the gcd (greatest common divisor) determines the largest number that can divide into both inputs
 * I used Eulers algorithm with Euclidan Divison for determining this. 
 * assumes non-zero inputs
 */
gcd(a: number, b: number) : number {

  if(b === 0) return a;

  const max = (a > b) ? a : b;
  const min = (a <= b) ? a : b;

  return this.gcd(min, max % min);


}


/**
 * this is an algorithm for finding the least common multiple of a give set of input numbers 
 * it works based on the formula lcd (a,b) = a*b / gcd(a,b), and then calculates in a pairwise fashion.
 * this has the risk of breaking with very large sets of inputs and/or prime numbers of a large size
 */
lcm(original: Array<number>) : number{

  const set = original.slice();

  if(set.length === 0) return 0;
  if(set.length === 1) return set[0];

  const a: number = set.shift();
  const b: number = set.shift();

  let mult: number = a * b; 
  let gcd = this.gcd(a, b);

  let lcd = mult / gcd; 


  while(set.length > 0){
    const c = set.shift();
    mult = c * lcd;
    gcd = this.gcd(c, lcd);
    lcd = mult/gcd;
  }

  return lcd;

}

/**
 * take any input array and return an array of only the unique elements
 * @param arr 
 * @returns 
 */
filterToUniqueValues(arr: Array<any>) : Array<any>{

  const unique: Array<any> = [];
  arr.forEach(el => {
    const ndx = unique.findIndex(uel => uel === el);
    if(ndx === -1) unique.push(el);
  });
  return unique;
}

/**
 * takes an input string and a regex and returns each match as an array
 * @param input 
 */
parseRegex(input:string, regex: RegExp) : Array<any> {
  if(input == undefined || regex == undefined) return [];
  input = input.toString();
  const global_regex = new RegExp(regex, 'g');
  const matches = input.match(global_regex);
  return matches;
}

/**
 * compares two lists of values and returns a list of the elements from newInlets that need to be added to the current list, 
 * as well as the elements in currentInlets that no longer need to exist. 
 * @param newInlets 
 * @returns the list of elements that needed to be added to or removed from current Inlets to make it match the list in newInlets
 */
getInletsToUpdate(newInlets: Array<any>, currentInlets: Array<any>) : {toadd: Array<any>, toremove: Array<any>} {

  const toadd = newInlets.reduce((acc, inlet) => {
    if(currentInlets.find(el => el == inlet) === undefined) acc.push(inlet);
    return acc;
  }, []);
  const toremove = currentInlets.reduce((acc, inlet) => {
    if(newInlets.find(el => el == inlet) === undefined) acc.push(inlet);
    return acc;
  }, []);

  return {toadd, toremove};
}

  /**
   * takes two versions and compares them
   * returns true if versions are same or version a is greater than b, returns false if a older than b
   * @param compare 
   */
   sameOrNewerVersion(a: string, b: string ) : boolean {

    if(a === undefined || b===undefined){
      console.error("checking undefined version", a, b);
      return false;
    }

    const a_spl = a.split('.');
    const b_spl = b.split('.');
    let flag_end = false;
    let return_val = true;

    for(let i = 0; i < a_spl.length && !flag_end; i++){
      if(i < b_spl.length){
        if(parseInt(a_spl[i]) < parseInt(b_spl[i])){
          return_val = false;
          flag_end = true;
        }else  if(parseInt(a_spl[i]) > parseInt(b_spl[i])){
          return_val = true;
          flag_end = true;
        } 
      }
    }

    if(flag_end) return return_val;
    return true;

  }
                                                                          
                                                                                                                   
// generateId :: Integer -> String                                                                                                  
generateId = (len:number) : number => {                              
  const arr = new Uint8Array((len || 40) / 2)                                                                  
  window.crypto.getRandomValues(arr)            
  return parseInt(arr.join(''))                                                                                  
}  


//print the draft to console
printDraft(d: Draft){
  console.log('draft ', d.id);
  for(let i = 0; i < wefts(d.drawdown);i++){
    const row: string = d.drawdown[i].reduce((acc, el) => {
      if(getCellValue(el) === true) acc = acc.concat('x')
      else acc = acc.concat('o')
      return acc;
    }, '');
    console.log(row)
  }
}


/**
 * this function determines how one can flip the draft between two origin states
 * @param draft 
 * @param loom 
 * @param from 
 * @param to 
 */
getFlips(from:number, to: number) : {horiz: boolean, vert: boolean} {

  // console.log("flipping from/to", from, to);


  let horiz = false;
  let vert = false;

  if(from === to) return {horiz, vert};

  if((from === 0 && to === 1) || (from === 1 && to === 0)){
    vert = true;
  }else if((from === 0 && to === 2) || (from === 2 && to === 0)){
    vert = true;
    horiz = true;
  }else if((from === 0 && to === 3) || (from === 3 && to === 0)){
    horiz = true;
  }else if((from === 1 && to == 2) || (from === 2 && to === 1)){
    horiz = true;
  }else if((from === 1 && to == 3) || (from === 3 && to === 1)){
    vert = true;
    horiz = true;
  }else if((from === 2 && to == 3) || (from === 3 && to === 2)){
    vert = true;
  }else{
    console.error("to/from origin flip options not found", to, from)
  }

  // console.log("horiz/vert", horiz, vert);

  return {horiz, vert};

}

async saveAsWif(fs: FileService, draft: Draft, loom:Loom, loom_settings:LoomSettings) {

  const a = document.createElement('a')
  return fs.saver.wif(draft, loom,loom_settings)
  .then(href => {
    a.href =  href;
    a.download = getDraftName(draft) + ".wif";
    a.click();  
  });
  
}

async saveAsPrint(el: any, draft: Draft, floats: boolean, use_colors: boolean, selected_origin_option: number, ms: MaterialsService, ss: SystemsService, fs: FileService ) {

  let b = el;
  let context = b.getContext('2d');
  b.width = (warps(draft.drawdown)+3)*10;
  b.height =(wefts(draft.drawdown)+7)*10;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, b.width, b.height);

  switch(selected_origin_option){
    case 0:
      draft = await flipDraft(draft, true, false);
    break;

    case 1:
      draft = await flipDraft(draft, true, true);
      break;

    case 2:
      draft = await flipDraft(draft, false, true);

    break;

  }


let system = null;

  for (let j = 0; j < draft.colShuttleMapping.length; j++) {
    let color = ms.getColor(draft.colShuttleMapping[j]);
    switch(selected_origin_option){
      case 0:
      case 1: 
      system = ss.getWarpSystemCode(draft.colSystemMapping[draft.colSystemMapping.length-1 - j]);

      break;
      case 2: 
      case 3: 
      system = ss.getWarpSystemCode(draft.colSystemMapping[j]);

      break;
    }
  
    context.fillStyle = color;
    context.strokeStyle = "#666666";
    context.fillRect(30+(j*10), 16,  8,  8);
    context.strokeRect(30+(j*10), 16,  8,  8);

    context.font = "10px Arial";
    context.fillStyle = "#666666";
    context.fillText(system, j*10+32, 10)

  
  }


    for (let j = 0; j < draft.rowShuttleMapping.length; j++) {

      switch(selected_origin_option){
        case 1:
        case 2: 
        system = ss.getWeftSystemCode(draft.rowSystemMapping[draft.rowSystemMapping.length-1 - j]);

        break;
        case 0: 
        case 3: 
        system = ss.getWeftSystemCode(draft.rowSystemMapping[j]);

        break;
      }

      let color = ms.getColor(draft.rowShuttleMapping[j]);
      context.fillStyle = color;
      context.strokeStyle = "#666666";
      context.fillRect(16, j*10+31,  8,  8);
      context.strokeRect(16, j*10+31,  8,  8);
      
      context.font = "10px Arial";
      context.fillStyle = "#666666";
      context.fillText(system, 0, 28+(j+1)*10)


    }
  let img = getDraftAsImage(draft, 10, floats, use_colors, ms.getShuttles());  
  context.putImageData(img, 30, 30);

  context.font = "12px Arial";
  context.fillStyle = "#000000";
  let textstring = getDraftName(draft)+" // "+warps(draft.drawdown)+" x "+wefts(draft.drawdown);
  context.fillText(textstring, 30, 50+wefts(draft.drawdown)*10)

  const a = document.createElement('a')
  return fs.saver.jpg(b)
  .then(href => {
    a.href =  href;
    a.download = getDraftName(draft) + ".png";
    a.click();  
  });
  
}

async saveAsBmp(el: any, draft: Draft, selected_origin_option:number, ms :MaterialsService, fs: FileService){
    let context = el.getContext('2d');

    switch(selected_origin_option){
      case 0:
        draft = await flipDraft(draft, true, false);
      break;

      case 1:
        draft = await flipDraft(draft, true, true);
        break;

      case 2:
        draft = await flipDraft(draft, false, true);

      break;

    }

    el.width = warps(draft.drawdown);
    el.height = wefts(draft.drawdown);
    let img = getDraftAsImage(draft, 1, false, false, ms.getShuttles());

    // console.log("IMAGE ", img.colorSpace)
    // for(let i = 0; i < img.data.length; i+=4){
    //   console.log(img.data[i], img.data[i+1],img.data[i+2],img.data[i+3])
    // }



    context.putImageData(img, 0, 0);

    const a = document.createElement('a')
    return fs.saver.bmp(el)
    .then(href => {
      a.href =  href;
      a.download = getDraftName(draft) + "_bitmap.jpg";
      a.click();
    });
  
  }

}
  
  //makes it so that we are using this util class as a singleton (referenced: https://www.digitalocean.com/community/tutorials/js-js-singletons)
  const utilInstance = new Util();
  Object.freeze(utilInstance);
  export default utilInstance;