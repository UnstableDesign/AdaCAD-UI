
import { getCellValue, setCellValue } from "./cell";
import { Draft, Drawdown, Interlacement, InterlacementVal, Loom, LoomSettings, LoomUtil } from "./datatypes";
import { createBlankDrawdown, warps, wefts } from "./drafts";
import { Sequence } from "./sequence";
import utilInstance from "./util";


/*********** GENERIC FUNCTIONS RELATING TO LOOMS AND LOOM UTILS ************/

export const initLoom = (warps: number, wefts: number) : Loom => {
  
  const loom: Loom = {
    threading: [],
    treadling: [],
    tieup: []
  }

  for(let i = 0; i < wefts; i++){
    loom.treadling.push([]);
  }

  for(let j = 0; j < warps; j++){
    loom.threading.push(-1);
  }

  for(let i = 0; i < wefts; i++){
    loom.tieup[i] = [];
    for(let j = 0; j < warps; j++){
      loom.tieup[i].push(false);
    }  
  }
  return loom;

}


export const copyLoom = (l:Loom) : Loom => {
  console.log("LOOM BEING COPIED ", l)
  if(l === undefined || l == null || l.threading == undefined || l.tieup == undefined || l.treadling == undefined) return null;
  const copy_loom  = {
    threading: l.threading.slice(),
    treadling: l.treadling.slice(),
    tieup: l.tieup.slice(),
  } 
  return copy_loom;
}

export const copyLoomSettings = (ls:LoomSettings) : LoomSettings => {
  const copy_loomsettings  = {
      type: ls.type,
      epi: ls.epi,
      units: ls.units,
      frames: ls.frames,
      treadles: ls.treadles
  };
  return copy_loomsettings;
}


export const convertEPItoMM = (ls: LoomSettings) : number => {



  if(ls.units == 'cm'){

    return (100/ls.epi);
  }else{

    return (25.4/ls.epi);
  }

}



/*********** ESTABLISH SPECIFIC TYPES OF LOOMS and A CORE SET OF FUNCTIONS FOR EACH ************/

const jacquard_utils: LoomUtil = {
    type: 'jacquard', 
    displayname: 'jacquard loom',
    dx: "draft exclusively from drawdown, disregarding any frame and treadle information",
    computeLoomFromDrawdown: (d: Drawdown, l: Loom, loom_settings: LoomSettings) : Promise<Loom>  => {
      return Promise.resolve(null);
    },
    computeDrawdownFromLoom: (l: Loom) : Promise<Drawdown> => {
      return Promise.resolve(null);
    },
    // recomputeLoomFromThreadingAndDrawdown:(l:Loom, loom_settings: LoomSettings, d: Drawdown): Promise<Loom> =>{
    //   return Promise.resolve(null);
    // },
    updateThreading: (loom: Loom, ndx:InterlacementVal) => {
      return loom;
    },
    updateTieup: (loom: Loom,ndx:InterlacementVal) => {
      return loom;
    },
    updateTreadling : (loom: Loom,ndx:InterlacementVal) => {
      return loom;
    },
    insertIntoThreading: (loom: Loom, j: number, val: number) : Loom => {
      return loom;
    },
    insertIntoTreadling: (loom: Loom, i: number, val: Array<number>) : Loom => {
      return loom;
    },
    pasteThreading: (loom:Loom, drawdown: Drawdown,ndx: InterlacementVal, width: number, height: number) : Loom => {
      return loom;
    },
    pasteTreadling: (loom:Loom, drawdown: Drawdown,ndx: InterlacementVal, width: number, height: number) : Loom => {
      return loom;
    },
    pasteTieup: (loom:Loom, drawdown: Drawdown,ndx: InterlacementVal, width: number, height: number) : Loom => {
      return loom;
    },
    deleteFromThreading: (loom: Loom, j: number) : Loom => {
      return loom;
    },
    deleteFromTreadling: (loom: Loom, i: number) : Loom => {
      return loom;
    }

  }

  /**
   * contains the set of functions to be used when working on a direct tieup or dobby loom
   */
  const direct_utils: LoomUtil = {
    type: 'direct', 
    displayname: 'direct-tie or dobby loom',
    dx: "draft from drawdown or threading/tieup/treadling. Assumes you are using a direct tie and mutiple treadle assignments",
    computeLoomFromDrawdown: (d: Drawdown, l: Loom,  loom_settings: LoomSettings) : Promise<Loom>  => {
        
        if(l == null){
          l = initLoom(warps(d), wefts(d));
        }


            //now calculate threading 
            return generateThreading(d, l.threading)
            .then(obj => {

            l.threading = obj.threading.slice();

            //add treadling
            for(let i = 0; i < wefts(d); i++){
              let active_ts = [];
              let i_pattern = d[i].slice();
              i_pattern.forEach((cell, j) => {
                if(getCellValue(cell) == true){
                  const frame_assignment = obj.threading[j];
                  if(frame_assignment !== -1){
                    active_ts.push(frame_assignment);
                  }
                }
              });
              l.treadling[i] = utilInstance.filterToUniqueValues(active_ts);
            }

            const num_frames = Math.max(numFrames(l), loom_settings.frames);
            const num_treadles = Math.max(numTreadles(l), loom_settings.treadles);
            const dim = Math.max(num_frames, num_treadles)


            l.tieup = generateDirectTieup(dim);

             return l;

            });

    },
    computeDrawdownFromLoom: (l: Loom) : Promise<Drawdown> => {
      return computeDrawdown(l);
    },
    // recomputeLoomFromThreadingAndDrawdown:(l:Loom, loom_settings: LoomSettings, d: Drawdown): Promise<Loom> =>{
    //   const new_loom: Loom = {
    //     threading: l.threading.slice(),
    //     tieup: [],
    //     treadling: []
    // }

  
    //   //add treadling
    //   for(let i = 0; i < wefts(d); i++){
    //     let active_ts = [];
    //     let i_pattern = d[i].slice();
    //     i_pattern.forEach((cell, j) => {
    //       if(getCellValue(cell) == true){
    //         const frame_assignment = new_loom.threading[j];
    //         if(frame_assignment !== -1){
    //           active_ts.push(frame_assignment);
    //         }
    //       }
    //     });
    //     new_loom.treadling[i] = utilInstance.filterToUniqueValues(active_ts);
    //   }

    //   const num_frames = Math.max(numFrames(l), loom_settings.frames);
    //   const num_treadles = Math.max(numTreadles(l), loom_settings.treadles);
    //   const dim = Math.max(num_frames, num_treadles)


    //   new_loom.tieup = generateDirectTieup(dim);
    //   return Promise.resolve(new_loom)

    // },
    updateThreading: (loom: Loom, ndx:InterlacementVal) => {


        if(ndx.val) loom.threading[ndx.j] = ndx.i;
        else loom.threading[ndx.j] = -1;

   

        return loom;
    },
    updateTieup: (loom: Loom, ndx:InterlacementVal) => {
      return loom;
    },
    updateTreadling : (loom: Loom, ndx:InterlacementVal) => {
      if(ndx.val){
          if(loom.treadling[ndx.i].find(el => el === ndx.j) === undefined) loom.treadling[ndx.i].push(ndx.j);
      }else{
          loom.treadling[ndx.i] = loom.treadling[ndx.i].filter(el => el !== ndx.j);
      }
    return loom;
    },
    insertIntoThreading: (loom: Loom, j: number, val: number) : Loom => {
      loom.threading.splice(j,0, val);
      return loom;
    },
    insertIntoTreadling: (loom: Loom, i: number, val: Array<number>) : Loom => {
      loom.treadling.splice(i,0, val);
      return loom;
    },
    pasteThreading: (loom:Loom, drawdown: Drawdown, ndx: InterlacementVal, width: number, height: number) : Loom => {
      
     return pasteDirectAndFrameThreading(loom, drawdown, ndx, width, height);
    },
    pasteTreadling: (loom:Loom, drawdown: Drawdown, ndx: InterlacementVal, width: number, height: number) : Loom => {

      //a direct loom can have multiple values per pic and can accept selections that do not span the full width of the treadling list. Therefore, we have to splice in the selected pattern into treadling rows. 
      for(let i = 0; i < height; i++){
        const pattern_ndx_i = i % wefts(drawdown);
        //clears out treadles within the paste region
        const treadle_list =  loom.treadling[ndx.i + i].filter(el => el < ndx.j || el > ndx.j+width-1);
      

        for(let j = 0; j < width; j++){
          const pattern_ndx_j = j % warps(drawdown);
          if(getCellValue(drawdown[pattern_ndx_i][pattern_ndx_j]) == true) treadle_list.push(j + ndx.j);
        }
        //
        loom.treadling[ndx.i + i] = treadle_list.slice(); //this will overwrite whatever was there 
    }
    return loom;

    },
    pasteTieup: (loom:Loom, drawdown: Drawdown,  ndx: InterlacementVal, width: number, height: number) : Loom => {
      return loom;
    },
    deleteFromThreading: (loom: Loom, j: number) : Loom => {
      loom.threading.splice(j, 1);
      return loom;
    },
    deleteFromTreadling: (loom: Loom, i: number) : Loom => {
      loom.treadling.splice(i, 1);
      return loom;
    }
  }

  /**
   * contains the set of functions to be used when working on a frame loom
   */
  const frame_utils: LoomUtil = {
    type: 'frame', 
    displayname: 'shaft/treadle loom',
    dx: "draft from drawdown or threading/tieup/treadling. Assumes you are assigning treadles to specific frame via tieup",
    computeLoomFromDrawdown: (d: Drawdown, l: Loom, loom_settings: LoomSettings) : Promise<Loom>  => {
        console.log("COMPUTE HARNESS FORM DRAWDOWN")

        if(l == null){
            l = initLoom(warps(d), wefts(d));
        }

         
        return generateThreading(d, l.threading)
          .then(threading => {
            l.threading = threading.threading;
            return generateTreadlingforFrameLoom(d)
          })
          .then(treadling => {
            l.treadling = treadling.treadling;
        
            l.tieup = [];
            const num_frames = Math.max(numFrames(l), loom_settings.frames);
            const num_treadles = Math.max(numTreadles(l), loom_settings.treadles);

            for(let frames = 0; frames < num_frames; frames++){
              l.tieup.push([]);
              for(let treadles = 0; treadles < num_treadles; treadles++){
                l.tieup[frames].push(false);
              }
            }

            for(let i = 0; i < l.treadling.length; i++){
              if(l.treadling[i].length > 0){
                const active_treadle_id = l.treadling[i][0];
                const row = d[i];
                row.forEach((cell, j) => {
                  if(getCellValue(cell) == true){
                    const active_frame_id = l.threading[j];
                    l.tieup[active_frame_id][active_treadle_id] = true;
                  } 
                });
              }
            }

            return l;
          })

      
    
    },
    
    computeDrawdownFromLoom: (l: Loom) : Promise<Drawdown> => {
      return computeDrawdown(l);
    },
    // recomputeLoomFromThreadingAndDrawdown:(l:Loom, loom_settings: LoomSettings, d: Drawdown): Promise<Loom> =>{
    //   const new_loom: Loom = {
    //     threading: l.threading.slice(),
    //     tieup: [],
    //     treadling: []
    //   }
     
    //   return  generateTreadlingforFrameLoom(d)
    //   .then(treadling => {
    //     new_loom.treadling = treadling.treadling;
    
    //     new_loom.tieup = [];
    //     const num_frames = Math.max(numFrames(l), loom_settings.frames);
    //     const num_treadles = Math.max(numTreadles(l), loom_settings.treadles);

    //     for(let frames = 0; frames < num_frames; frames++){
    //       new_loom.tieup.push([]);
    //       for(let treadles = 0; treadles < num_treadles; treadles++){
    //         new_loom.tieup[frames].push(false);
    //       }
    //     }

    //     for(let i = 0; i < new_loom.treadling.length; i++){
    //       if(new_loom.treadling[i].length > 0){
    //         const active_treadle_id = new_loom.treadling[i][0];
    //         const row = d[i];
    //         row.forEach((cell, j) => {
    //           if(getCellValue(cell) == true){
    //             const active_frame_id = new_loom.threading[j];
    //             new_loom.tieup[active_frame_id][active_treadle_id] = true;
    //           } 
    //         });
    //       }
    //     }

    //     return Promise.resolve(new_loom);
    //   })
    // },
    updateThreading: (loom:Loom, ndx: InterlacementVal) : Loom => {
        if(ndx.val) loom.threading[ndx.j] = ndx.i;
        else loom.threading[ndx.j] = -1;

        //in this case, we need to expand the size of the tieup to include a row for this threading
        // if(ndx.i >= loom.tieup.length){
        //   const treadles = numTreadles(loom);
        //   const difference = ndx.i - loom.tieup.length;
        //   console.log(difference);
        //   for(let x = 0; x <= difference; x++){
        //     let row = [];
        //     for(let j = 0; j < treadles; j++){
        //       row.push(false);
        //     }
        //     loom.tieup.push(row);
        //   }
        // }
        return loom;
    },
    updateTieup: (loom:Loom, ndx: InterlacementVal) : Loom => {
       //based on the way that the draft viewer renders based on user specified frames and treadles (and not neccessarily how many frames and treadles are being used, we have to manually resize the tieup to fit the input)

       let frames = loom.tieup.length;
        let treadles = loom.tieup[0].length;
        if(ndx.i > frames){
            const difference = ndx.i - loom.tieup.length;
            for(let x = 0; x <= difference; x++){
              let row = [];
              for(let j = 0; j < treadles; j++){
                row.push(false);
              }
              loom.tieup.push(row);
            }
        }

        if(ndx.j > treadles){
          const difference = ndx.j - loom.tieup[0].length;
          for(let i = 0; i < loom.tieup.length;i++){
            for(let x = 0; x <= difference; x++){
              loom.tieup[i].push(false);
            }
          }
        }
      

        loom.tieup[ndx.i][ndx.j] = ndx.val;
        return loom;

    },
    updateTreadling: (loom:Loom, ndx: InterlacementVal) : Loom => {
        if(ndx.val){
            if(loom.treadling[ndx.i].length > 0) loom.treadling[ndx.i] = [];
            loom.treadling[ndx.i].push(ndx.j);
        }else{
            loom.treadling[ndx.i] = loom.treadling[ndx.i].filter(el => el !== ndx.j);
        }
      return loom;
    },
    insertIntoThreading: (loom: Loom, j: number, val: number) : Loom => {
      loom.threading.splice(j,0, val);
      return loom;
    },
    insertIntoTreadling: (loom: Loom, i: number, val: Array<number>) : Loom => {
      loom.treadling.splice(i,0, val);
      return loom;
    },
    pasteThreading: (loom:Loom, drawdown: Drawdown, ndx: InterlacementVal, width: number, height: number) : Loom => {
      return pasteDirectAndFrameThreading(loom, drawdown, ndx, width, height);
    },
    pasteTreadling: (loom:Loom,drawdown: Drawdown, ndx: InterlacementVal, width: number, height: number) : Loom => {
      //this acknowledges that there can only be one selected treadle per pic so it overwrites whatever is already present with the pasted option 
     
      for(let i = 0; i < height; i++){
        const pattern_ndx_i = i % wefts(drawdown);
        const treadle_list = [];
        for(let j = 0; j < width; j++){
          const pattern_ndx_j = j % warps(drawdown);
          if(getCellValue(drawdown[pattern_ndx_i][pattern_ndx_j]) == true) treadle_list.push(ndx.j + j);
        }
        //ensures every row only has one value
        if(treadle_list.length > 0) loom.treadling[ndx.i + i] = treadle_list.slice(0, 1);
        else  loom.treadling[ndx.i + i] = [];
      }
    
      return loom;
     
    },
    
    pasteTieup: (loom:Loom,drawdown: Drawdown, ndx: InterlacementVal, width: number, height: number) : Loom => {
    
        const rows = wefts(drawdown);
        const cols = warps(drawdown);

        //expand the size of tieups to make sure it can hold the new values
        const select_width = width + ndx.i;
        const select_height = height + ndx.j;

        for(let i = loom.tieup.length; i < select_height; i++){
          loom.tieup.push([]);
          for(let j = loom.tieup[0].length; j < select_width; j++){
            loom.tieup[i].push(false);
          }
        }

        for(let i = 0; i < height; i++){
          for(let j = 0; j < width; j++){
            loom.tieup[ndx.i + i][ndx.j + j] = getCellValue(drawdown[i % rows][j % cols]);
          }
        }
          
      return loom;
    },
    deleteFromThreading: (loom: Loom, j: number) : Loom => {
      loom.threading.splice(j, 1);
      return loom;
    },
    deleteFromTreadling: (loom: Loom, i: number) : Loom => {
      console.log("SPLICING FROM ", i)
      loom.treadling.splice(i, 1);
      return loom;
    }

  
  }


/*** SHARED FUNCTIONS USED WHEN COMPUTING LOOM STATESs ********/


export const pasteDirectAndFrameThreading = (loom:Loom, drawdown: Drawdown, ndx: InterlacementVal, width: number, height: number) : Loom => {
    
  //update this function so that it doesn't assume the selection has been the full frame threading

  for(let j = 0; j < width; j++){
    const pattern_ndx_j = j % warps(drawdown);
    const col: Array<number> = [];
    for(let i = 0; i < height; i++){
      const pattern_ndx_i = i % wefts(drawdown);
      if(getCellValue(drawdown[pattern_ndx_i][pattern_ndx_j]) == true) col.push(ndx.i + i);
    }

    if(col.length == 0) loom.threading[ndx.j + j] = -1;
    else loom.threading[ndx.j + j] = col.shift();
  }

  return loom;

}

  
  /**
   * computes the drawdown based on a given loom configuration
   * @param loom 
   * @returns the resulting drawdown
   */
  export const computeDrawdown = (loom: Loom) : Promise<Drawdown> => {

    let pattern = createBlankDrawdown(loom.treadling.length, loom.threading.length);
    for (var i = 0; i < loom.treadling.length;i++) {
      const active_treadles: Array<number> = loom.treadling[i].slice();
      if (active_treadles.length > 0) {
        active_treadles.forEach((treadle) => {


          for (var j = 0; j < loom.tieup.length; j++) {
            if (loom.tieup[j][treadle]) {
              for (var k = 0; k < loom.threading.length;k++) {
                if (loom.threading[k] == j) {
                  pattern[i][k] = setCellValue(pattern[i][k], true);
                }
              }
            }
          }
        });
      }
    }

    return Promise.resolve(pattern);
  
  }


  /**
  * generates a threading based on the provided drawdown and the current threading. 
   * @param drawdown the drawdown to use 
   * @param threading you can think of the threading as an already sparce representation of the draft. You only need to search for matches within columns that already exist in the threading. 
   * @returns an object containing the threading pattern and the number of frames used
   */
  export const generateThreading = (drawdown: Drawdown, threading: Array<number>) : Promise<{threading: Array<number>, num: number}> => {

    console.log("THREADING TO START ", threading)
    
    let unique_threading_vals = [];

    const sparce = utilInstance.makeSparceWeftDrawdown(drawdown.slice());


    // Using the threading as a guide, go through an place the columns cooresponding to unique frame ids into an array
    for(let j = 0; j < threading.length; j++){
      if(threading[j] !== -1 && unique_threading_vals.findIndex(el => el.frame === threading[j]) == -1){
        unique_threading_vals.push(
          {  
            frame: threading[j], 
            col: sparce.map(row => row[j]) 
        })
      }
    }
    console.log("UNIQUE THREADINGS ", unique_threading_vals);

    
    let max_frame: number = unique_threading_vals.reduce((acc, val) => {
      if(val.frame > acc) acc = val.frame;
      return;
    }, -1)


    //progressively add new frames in the order they appear
    for(let j = 0; j < warps(sparce); j++){
      const blank = utilInstance.colIsBlank(j, unique_threading_vals);
      if(blank) threading[j] = -1;
      else{
      const match = utilInstance.hasMatchingColumn(j, sparce, unique_threading_vals);
        if(match === -1){
          //add it to the next available frame
          max_frame++;
          threading[j] = max_frame;

          //add this to the list of unique threadings
          unique_threading_vals.push({
            frame: max_frame,
            col: sparce.map(row => row[j]) 
          })

        }else{
          threading[j] = threading[match];
        }
      }
    }

    return Promise.resolve({threading:threading, num:max_frame});

  }


  /**
   * TODO: Update this to FOLLOW THE SAME LOGIC AS THE THREADING
   * This function sets the treadling based on a adjusted pattern (e.g. a pattern that has been flipped based on the users selected origin point)
   * @param pattern the drawdown to use to generate the treadling
   * @returns an object containing the treadling and the total number of treadles used
   */
   export const generateTreadlingforFrameLoom = (pattern: Drawdown) : Promise<{treadling:Array<Array<number>>, num:number}> =>{
    let treadle = -1;
    let treadling = [];

    //make it sparce first
     const sparce = utilInstance.makeSparceWarpDrawdown(pattern.slice());

     let unique_treadling_vals = [];
 
 
     // Using the threading as a guide, go through an place the columns cooresponding to unique frame ids into an array
     for(let i = 0; i < treadling.length; i++){
       if(treadling[i] !== -1 && unique_treadling_vals.findIndex(el => el.treadle === treadling[i]) == -1){
         unique_treadling_vals.push(
           {  treadle: treadling[i], 
              row: sparce[i] 
         })
       }
     }
     console.log("UNIQUE TREADLINGS ", unique_treadling_vals);
 
     
     let max_treadle: number = unique_treadling_vals.reduce((acc, val) => {
       if(val.treadle > acc) acc = val.treadle;
       return;
     }, -1)
 


    //progressively add new treadles in the order they appear
    for(let i = 0; i < sparce.length; i++){
      if(sparce[i] !== undefined){
      const has_up = sparce[i].find(el => getCellValue(el) == true);
        if(has_up === undefined) treadling[i] = [];
        else{
        const match = utilInstance.hasMatchingRow(i, sparce, unique_treadling_vals);
          if(match === -1){
          max_treadle++;
            treadling[i] = [max_treadle];
            //push this to the unique rows list; 
            unique_treadling_vals.push({
              treadle: max_treadle, 
              row: sparce[i]
            })
          }else{
            treadling[i] = treadling[match];
          }   
        }
      }else{
        treadling[i] = [];
      }
    }
    return Promise.resolve({treadling: treadling, num: max_treadle});

  }


  /**
   * generates a direct tieup for the give size
   * @param size the number of frames and treadles
   * @returns a tieup pattern of the specified size
   */
  export const generateDirectTieup = (size:number) : Array<Array<boolean>> => {
 //add tieup
    const tieup = [];
    for(let i = 0; i < size; i++){
      tieup.push([]);
      for(let j = 0; j < size; j++){
        if(i == j) tieup[i][j] = true;
        else tieup[i][j] = false;
      }
    }
    return tieup.slice();
  }

  /**
   * flips the draft horizontally and/or vertically. Used to flip the draft so that (0,0) is in the top left, no matter which origin point is selected
   * @param d the pattern to flip
   * @param horiz do horizontal flip?
   * @param vert do vertical flip?
   * @returns the flipped pattern
   */
  export const flipPattern = (d: Drawdown, horiz: boolean, vert: boolean) : Promise<Drawdown> => {


    const d_flip = d.slice();
    // for(let i = 0; i < d.length; i++){
    //   d_flip.push([]);
    //   for(let j = 0; j < d[i].length; j++){
    //     if(horiz && vert) d_flip[i][j] = new Cell(d[d.length -1 - i][d[i].length - 1 - j].getHeddle());
    //     if(horiz && !vert) d_flip[i][j] = new Cell(d[i][(d[i].length - 1 - j)].getHeddle());
    //     if(!horiz && vert) d_flip[i][j] = new Cell(d[d.length -1 - i][j].getHeddle());
    //     if(!horiz && !vert) d_flip[i][j] = new Cell(d[i][j].getHeddle());
    //   }
    // }

    return Promise.resolve(d_flip);

  }

  /**
   * calls the series of functions required to flip the looms to common origin based of user selected origin.
   * @param loom the original loom
   * @returns the flipped loom
   */
  export const flipLoom = (loom:Loom, horiz: boolean, vert: boolean) : Promise<Loom> => {
   
    return Promise.resolve(loom);
    if(loom === null || loom == undefined) return Promise.resolve(null);

    const refs = [];
    let new_loom = {
      threading: loom.threading.slice(), 
      tieup: loom.tieup.slice(),
      treadling: loom.treadling.slice()
    }


    let fns = [];
      if (vert){
        refs.push('treadling')
        fns.push(flipTreadling(loom.treadling));
      }
      if(horiz){
        refs.push('threading')
        fns.push(flipThreading(loom.threading))
      }

      return Promise.all(fns).then(res => {
        for(let i = 0; i < refs.length; i++){
          if(refs[i] === 'treadling') new_loom.treadling = res[i];
          if(refs[i] === 'threading') new_loom.threading = res[i];
        }

        return Promise.resolve(new_loom);

      });
}


  /**
   * flips the threading order so that what was leftmost becomes rightmost
   * @param threading 
   * @returns the flipped threading order
   */
  export const flipThreading = (threading: Array<number>) : Promise<Array<number>> => {


    const t_flip = [];
    for(let i = 0; i < threading.length; i++){
      t_flip[i] = threading[threading.length -1 - i];
    }
    return Promise.resolve(t_flip);
  }

    /**
   * flips the threading order so that what was leftmost becomes rightmost
   * @param treadling 
   * @returns the flipped threading order
   */
  export const flipTreadling = (treadling: Array<Array<number>>) : Promise<Array<Array<number>>> =>{

      const t_flip = [];
      for(let i = 0; i < treadling.length; i++){
        t_flip[i] = treadling[treadling.length -1 - i].slice();
      }
      return Promise.resolve(t_flip);
  }

  /**
   * flips the threading order so that what was leftmost becomes rightmost
   * @param treadling 
   * @returns the flipped threading order
   */
  export const flipTieUp = (tieup: Array<Array<boolean>>, horiz: boolean, vert: boolean) : Promise<Array<Array<boolean>>> => {

    const t_flip:Array<Array<boolean>> = [];
    for(let i = 0; i < tieup.length; i++){
      t_flip.push([]);
      for(let j = 0; j < tieup[i].length; j++){
        if(horiz && vert) t_flip[i][j] = tieup[tieup.length -1 - i][tieup[i].length - 1 - j];
        if(horiz && !vert) t_flip[i][j] = tieup[i][(tieup[i].length - 1 - j)];
        if(!horiz && vert) t_flip[i][j] = tieup[tieup.length -1 - i][j];
        if(!horiz && !vert) t_flip[i][j] = tieup[i][j];
      }
    }

    return Promise.resolve(t_flip);
}

/**
 * returns the correct loom util object by string
 * @param type the type of loom you are using
 * @returns 
 */
export const getLoomUtilByType = (type: 'frame' | 'direct' | 'jacquard' | string) : LoomUtil =>{

    switch(type){
        case 'frame': return frame_utils;
        case 'direct': return direct_utils;
        case 'jacquard': return jacquard_utils;
    }

}

/**
 * calculates the total number of frames used in this loom
 * since its called frequently, keep an eye on this to make sure it isn't hanging page loading 
 * and/or call it once per needed function (instead of multiple times in one function)
 * @param loom 
 * @returns the highest number found in the array
 */
export const numFrames = (loom: Loom) : number => {

  if(loom === null || loom === undefined) return 0;

  let max = loom.threading.reduce((acc, el) => {
    if(el > acc){
      acc = el;
    }
    return acc;
  }, 0);
  return max+1;
}

/**
 * calculates the total number of frames used in this loom
 * since its called frequently, keep an eye on this to make sure it isn't hanging page loading 
 * @param loom 
 * @returns the highest number found in the array
 */
 export const numTreadles = (loom: Loom) : number => {

  if(loom == null) return 0;

  let max =  loom.treadling.reduce((acc, el) => {
    
    let max_in_list = el.reduce((sub_acc, sub_el) => {
      if(sub_el > acc) sub_acc = sub_el;
      return sub_acc;
    }, 0) ;
    
    if(max_in_list > acc){
      acc = max_in_list;
    }
    return acc;
  }, 0);

  return max+1;
}

/**
 * checks if a given interlacement is within the range of the threading
 * @param loom the loom to check with
 * @param ndx the interlacement to check
 * @returns true or false to determine if in or out of range
 */
export const isInThreadingRange = (loom: Loom, ndx: Interlacement) : boolean => {
  if(ndx.i < 0) return false;
  if(ndx.i > numFrames(loom)) return false;
  if(ndx.j < 0) return false;
  if(ndx.j >= loom.threading.length) return false;
  return true;
}


/**
 * checks if a given interlacement is within the range of the threading specified by the user
 * @param loom the loom to check with
 * @param ndx the interlacement to check
 * @returns true or false to determine if in or out of range
 */
 export const isInUserThreadingRange = (loom: Loom, loom_settings: LoomSettings, ndx: Interlacement) : boolean => {
  
  const frames = Math.max(loom_settings.frames, numFrames(loom));
  
  if(ndx.i < 0) return false;
  if(ndx.i > frames) return false;
  if(ndx.j < 0) return false;
  if(ndx.j >= loom.threading.length) return false;
  return true;
}



/**
 * checks if a given interlacement is within the range of the threading
 * @param loom the loom to check with
 * @param ndx the interlacement to check
 * @returns true or false to determine if in or out of range
 */
 export const isInTreadlingRange = (loom: Loom, ndx: Interlacement) : boolean => {
  if(ndx.j < 0) return false;
  if(ndx.j > numTreadles(loom)) return false;
  if(ndx.i < 0) return false;
  if(ndx.i >= loom.treadling.length) return false;
  return true;
}

/**
 * checks if a given interlacement is within the range of the threading
 * @param loom the loom to check with
 * @param ndx the interlacement to check
 * @returns true or false to determine if in or out of range
 */
 export const isInUserTreadlingRange = (loom: Loom, loom_settings: LoomSettings, ndx: Interlacement) : boolean => {
  
  const treadling = Math.max(loom_settings.treadles, numTreadles(loom));

  if(ndx.j < 0) return false;
  if(ndx.j > treadling) return false;
  if(ndx.i < 0) return false;
  if(ndx.i >= loom.treadling.length) return false;
  return true;
}



/**
 * checks if a given interlacement is within the range of the threading
 * @param loom the loom to check with
 * @param ndx the interlacement to check
 * @returns true or false to determine if in or out of range
 */
 export const isInTieupRange = (loom: Loom, ndx: Interlacement) : boolean => {
  if(ndx.i < 0) return false;
  if(ndx.i > loom.tieup.length) return false;
  if(ndx.i < 0) return false;
  if(ndx.i >= loom.tieup[0].length) return false;
  return true;
}

/**
 * checks if a given interlacement is within the range of the threading including the user defined settings
 * @param loom the loom to check with
 * @param ndx the interlacement to check
 * @returns true or false to determine if in or out of range
 */
 export const isInUserTieupRange = (loom: Loom, loom_settings: LoomSettings, ndx: Interlacement) : boolean => {
  const frames = Math.max(loom_settings.frames, numFrames(loom));
  const treadling = Math.max(loom_settings.treadles, numTreadles(loom));

  if(ndx.i < 0) return false;
  if(ndx.i >= frames) return false;
  if(ndx.i < 0) return false;
  if(ndx.i >= treadling) return false;
  return true;
}


/** 
 * returns true if this loom typically requires a view of threading and tieup
 */

export const isFrame = (loom_settings: LoomSettings) : boolean => {
  if(loom_settings.type !== 'jacquard') return true;
  return false;
}


   /**
   * sets up the draft from the information saved in a .ada file
   * returns the loom as well as the draft_id that this loom is linked with 
   * @param data 
   */
  export const loadLoomFromFile = (loom: any, version: string, id: number, warps: number) : Promise<{loom:Loom, id:number}> => {

    if(loom == null) return Promise.resolve(null);

    if(!utilInstance.sameOrNewerVersion(version, '3.4.5')){
      //tranfer the old treadling style on looms to the new style updated in 3.4.5
       loom.treadling = loom.treadling.map(treadle_id => {
        if(treadle_id == -1) return [];
        else return [treadle_id];
      });
    
    }else{
      //handle case where firebase does not save empty treadles
      //console.log("IN LOAD LOOM", loom.treadling);
      if(loom.treadling == null || loom.treadling == undefined) loom.treadling = [];

      for(let i = 0; i < warps; i++){
        if(loom.treadling[i] == null || loom.treadling[i] == undefined) loom.treadling[i] = [];
        else if(loom.treadling[i].length == 1 && loom.treadling[i][0] == -1) loom.treadling[i] = [];
      }
    }

    return Promise.resolve({loom, id});
    
      
    }

    /**
     * assumes the input to the function is a loom of type that uses a tieup and treadling and converts it to a loom that uses a direct tie and lift plan. 
     */
    export const convertTieupToLiftPlan = (loom: Loom) : Loom => {

      let size = Math.max(numFrames(loom), numTreadles(loom));

      let converted: Loom = {
        threading: loom.threading.slice(),
        tieup: generateDirectTieup(size),
        treadling: []
      }

      converted.treadling = loom.treadling.map(treadle_vals => {

        if(treadle_vals.length == 0) return [];
          let active_treadle = treadle_vals[0];
          let tieupcol: Array<boolean> = loom.tieup.reduce((acc, el, ndx) => {
            return acc.concat(el[active_treadle])
          }, [] );
          return tieupcol.map((el, ndx)=> (el === true) ? ndx : -1).filter(el => el !== -1);
        });
        

      return converted;
    }

        /**
     * assumes the input to the function is a loom of type that uses a direct tie and lift plan and converts it to a loom that uses a tieup and treadling. 
     */
    export const convertLiftPlanToTieup = (loom: Loom) : Loom => {

      let tieup_ndx = 0;
      let shafts = numFrames(loom);
      let converted: Loom = {
        threading: loom.threading.slice(),
        tieup: [],
        treadling: []
      }

      let tieup_col = [];
      for(let i = 0; i < shafts; i++){
        tieup_col.push(false);
        converted.tieup.push([]);
      }

      let seen = [];

      //look at each pick
      loom.treadling.forEach(pick => {
        let pick_as_int: number = 0;
       
        if(pick.length != 0) {

          pick_as_int = parseInt(pick.reduce((acc, el, ndx) => {
            return acc + ((el) ? 1 : 0);
          }, ''), 2);
        

          console.log("SEEN ", seen, pick_as_int)
          let ndx = seen.findIndex(el => el == pick_as_int);
          if(ndx !== -1){
            //this pick will be assigned to an existing tieup column
            converted.treadling.push([ndx]);
          }else{
            //make a black tieup column
            let col = tieup_col.slice();
            //assign each selected left to the associated shaft
            pick.forEach(el => col[el] = true);

            converted.treadling.push([tieup_ndx]);
            //push this into the tieup
            for(let i = 0; i < shafts; i++){
              converted.tieup[i][tieup_ndx] = col[i];
            }
            seen.push(pick_as_int)
            tieup_ndx++;
          }
        }else{
          converted.treadling.push([]);
        }
    
      })

    

      return converted;
    }
