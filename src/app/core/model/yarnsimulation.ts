
import { Draft, Drawdown, filterToUniqueValues, getCellValue, warps, wefts } from 'adacad-drafting-lib';
import { mod } from 'mathjs';
import * as THREE from 'three';
import { interpolate, strictMod } from '../helpers';
import { CNFloat, CNIndex, CNType, ContactNeighborhood, Particle, SimulationVars, Spring, WarpPath, WeftPath, YarnVertex } from './datatypes';



// CONTACT NEIGHBORHOOD UTILITIES // 

const setIndex = (ndx: CNIndex, warps: number, cns: Array<ContactNeighborhood>): Array<ContactNeighborhood> => {
  let cn = getCN(ndx, warps, cns);
  cn.ndx = ndx;
  return cns;
}

const setFace = (ndx: CNIndex, warps: number, cns: Array<ContactNeighborhood>, value: boolean): Array<ContactNeighborhood> => {
  let cn = getCN(ndx, warps, cns);
  cn.face = value;
  return cns;
}

const getFace = (ndx: CNIndex, warps: number, cns: Array<ContactNeighborhood>): boolean => {
  let cn = getCN(ndx, warps, cns);
  return cn.face
}

const setNodeType = (ndx: CNIndex, warps: number, cns: Array<ContactNeighborhood>, type: CNType): Array<ContactNeighborhood> => {
  let cn = getCN(ndx, warps, cns);
  cn.node_type = type;
  return cns;
}

const getNodeType = (ndx: CNIndex, warps: number, cns: Array<ContactNeighborhood>): CNType => {
  let cn = getCN(ndx, warps, cns);
  return cn.node_type
}

const setMvY = (ndx: CNIndex, warps: number, cns: Array<ContactNeighborhood>, mv_y: number): Array<ContactNeighborhood> => {
  if (ndx.j < 0 || ndx.j >= warps) return cns;
  let cn = getCN(ndx, warps, cns);
  cn.mv.y = mv_y;
  return cns;
}

const getMvY = (ndx: CNIndex, warps: number, cns: Array<ContactNeighborhood>): number => {
  let cn = getCN(ndx, warps, cns);
  return cn.mv.y;
}

const setMvZ = (ndx: CNIndex, warps: number, cns: Array<ContactNeighborhood>, mv_z: number): Array<ContactNeighborhood> => {
  if (ndx.j < 0 || ndx.j >= warps) return cns;
  let cn = getCN(ndx, warps, cns);
  cn.mv.z = mv_z;
  return cns;
}

const getMvZ = (ndx: CNIndex, warps: number, cns: Array<ContactNeighborhood>): number => {
  let cn = getCN(ndx, warps, cns);
  return cn.mv.z;
}


const getCN = (ndx: CNIndex, warps: number, cns: Array<ContactNeighborhood>): ContactNeighborhood => {
  let ndx_flat = 4 * (ndx.i * warps + ndx.j) + ndx.id;
  return cns[ndx_flat];
}

const setAndOppositeFaces = (f1: boolean, f2: boolean): boolean => {
  if (f1 == null || f2 == null) return false;
  return (f1 !== f2);
}

const setAndSameFaces = (f1: boolean, f2: boolean): boolean => {
  if (f1 == null || f2 == null) return false;
  return (f1 == f2);
}

/**
 * uses the contact neighborhoods on this row to get a list of floats. Some floats may be out of range (> warps) in the case where the pattern would repeat and wrap
 * @param i 
 * @param warps 
 * @param cns 
 * @returns 
 */
export const getRowAsFloats = (i: number, warps: number, cns: Array<ContactNeighborhood>): Array<CNFloat> => {


  let floats = [];
  let lefts = cns.filter(el => el.node_type == 'ACN' && el.ndx.i == i && el.ndx.id == 0);
  let rights = cns.filter(el => el.node_type == 'ACN' && el.ndx.i == i && el.ndx.id == 1);
  if (lefts.length !== rights.length) console.error("THIS ROW HAS AN UNEVEN NUMBER OF ACNS")




  lefts.forEach(left => {
    let found = false;

    for (let j = left.ndx.j; j < warps && !found; j++) {
      let right = rights.find(el => el.ndx.j == j);
      if (right !== undefined) {
        found = true;
        floats.push({
          left: left.ndx,
          right: right.ndx,
          edge: false,
          face: left.face
        })
      }
    }

    if (!found) {
      let right = rights.shift();
      floats.push({
        left: left.ndx,
        right: { i: right.ndx.i, j: warps + right.ndx.j, id: 1 }, //get the first in the list
        edge: false,
        face: left.face
      })
    }


  })

  return floats;


}

/**
 * uses the contact neighborhoods on this column to get a list of floats. Some floats may be out of range (> wefts) so that they can readily apply to the edges relationships
 * @param i 
 * @param warps 
 * @param cns 
 * @returns 
 */
export const getColAsFloats = (j: number, wefts: number, warps: number, cns: Array<ContactNeighborhood>): Array<CNFloat> => {

  let floats = [];
  let lefts = cns.filter(el => el.node_type == 'ACN' && el.ndx.j == j && el.ndx.id == 2);
  let rights = cns.filter(el => el.node_type == 'ACN' && el.ndx.j == j && el.ndx.id == 3);
  if (lefts.length !== rights.length) console.error("THIS COL HAS AN UNEVEN NUMBER OF ACNS")


  lefts.forEach(left => {
    let found = false;

    for (let i = left.ndx.i; i < wefts && !found; i++) {
      let right = rights.find(el => el.ndx.i == i);
      if (right !== undefined) {
        found = true;
        floats.push({
          left: left.ndx,
          right: right.ndx,
          edge: false,
          face: left.face
        })
      }
    }

    if (!found) {
      let right = rights.shift();
      floats.push({
        left: left.ndx,
        right: { j: right.ndx.j, i: wefts + right.ndx.i, id: 3 }, //get the first in the list
        edge: false,
        face: left.face
      })
    }


  })

  return floats;


}



/**
 * used in support of determining how floats stack, this function gets a list of id's that are attached to a given float. Since more than one float may be attached, this takes that list of ids and returns the number of floats it represents. 
 * @param i 
 * @param warps 
 * @param face 
 * @param segments the list of indicies
 * @param cns 
 * @returns 
 */
const extractFloat = (i: number, warps: number, face: boolean, segments: Array<number>, cns: Array<ContactNeighborhood>): { float: CNFloat, last: number } => {

  //walk to the first ACN
  let start = null;
  let end = null;

  for (let s = 0; s < segments.length; s++) {

    //check the left side
    let adj_j = mod(segments[s], warps);
    if (getNodeType({ i, j: adj_j, id: 0 }, warps, cns) == 'ACN') {
      if (start == null) {
        start = { i, j: segments[s], id: 0 }
      }
    }
    //check the right side
    if (getNodeType({ i, j: adj_j, id: 1 }, warps, cns) == 'ACN') {
      if (start !== null) {
        end = { i, j: segments[s], id: 1 };
        let edge = (end.j >= warps - 1 || start.j <= 0);
        return { float: { left: start, right: end, face, edge }, last: segments[s] }
      }
    }

  }
  //got to the end and there was no closing this might mean we have reached the end of the row. 
  return { float: null, last: segments.length }
}

/**
 * given a point, this function returns the float upon which this point sits
 * @param i 
 * @param j 
 */
const getWarpFloat = (i: number, j: number, wefts: number, warps: number, cns: Array<ContactNeighborhood>): CNFloat => {
  let left = null;
  let count = 0;

  //confirm this is a weft float and not an unset 
  let face = getFace({ i, j, id: 0 }, warps, cns);
  if (face == null || face == false) return null;


  //walk up
  while (left == null && count < wefts) {
    let type = getNodeType({ i, j, id: 2 }, warps, cns);
    if (type == 'ACN') {
      left = { i, j, id: 2 };
    } else {
      i = strictMod(i - 1, wefts);
    }
    count++;
  }

  //walk down
  let right = null;
  count = 0;
  while (right == null && count < warps) {
    let type = getNodeType({ i, j, id: 3 }, warps, cns);
    if (type == 'ACN') {
      right = { i, j, id: 3 };
    } else {
      i = strictMod(i + 1, wefts);
    }
    count++;
  }

  if (left == null || right == null) return null;

  return {
    left, right, edge: false, face: true
  }

}


/**
 * given a point, this function returns the float upon which this point sits
 * @param i 
 * @param j 
 */
const getWeftFloat = (i: number, j: number, warps: number, cns: Array<ContactNeighborhood>): CNFloat => {
  let left = null;
  let count = 0;
  let j_adj = j;

  //confirm this is a weft float and not an unset 
  let face = getFace({ i, j, id: 0 }, warps, cns);
  if (face == null || face == true) return null;

  //walk left
  while (left == null && count < warps) {
    let type = getNodeType({ i, j: j_adj, id: 0 }, warps, cns);
    if (type == 'ACN') {
      left = { i, j: j_adj, id: 0 };
    } else {
      j_adj = strictMod(j_adj - 1, warps);
    }
    count++;
  }

  //walk right
  let right = null;
  count = 0;
  j_adj = j;
  while (right == null && count < warps) {
    let type = getNodeType({ i, j: j_adj, id: 1 }, warps, cns);
    if (type == 'ACN') {
      right = { i, j: j_adj, id: 1 };
    } else {
      j_adj = strictMod(j_adj + 1, warps);
    }
    count++;
  }

  return {
    left, right, edge: false, face: false
  }

}

const getWeftFloatLength = (f: CNFloat, warps: number): number => {
  if (f.right.j >= f.left.j) return f.right.j - f.left.j;
  else return warps - f.left.j + f.right.j;
}

const getWarpFloatLength = (f: CNFloat, wefts: number): number => {
  if (f.right.i >= f.left.i) return f.right.i - f.left.i;
  else return wefts - f.left.i + f.right.i;
}




/**
 * get all the weft-wise floats with the same face value that share an edge with the input float that reside on the row indicated by i. Given that if we are assuming repeats, some indexes might be beyond or not actually existing in the cn list
 * @param i 
 * @param warps 
 * @param float 
 * @param cns 
 * @returns 
 */
const getAttachedFloats = (i: number, wefts: number, warps: number, float: CNFloat, cns: Array<ContactNeighborhood>): Array<CNFloat> => {
  let attached = [];
  let segments = [];



  if (i < 0) i = strictMod(i, wefts);


  //walk along the input float and push any lower neighbors that match face
  for (let j = float.left.j; j <= float.right.j; j++) {
    let adj_j = strictMod(j, warps); //protect when float ends are out of range
    let face = getFace({ i, j: adj_j, id: 0 }, warps, cns);
    if (float.face !== null && float.face == face) {
      segments.push(j)
    }
  }


  if (segments.length == 0) return [];

  let left_edge = segments[0];
  let right_edge = segments[segments.length - 1]


  //walk left to find attached
  let edge_found = false;
  for (let count = 1; count < warps && !edge_found; count++) {
    let adj_j = strictMod((left_edge - count), warps);
    let face = getFace({ i, j: adj_j, id: 0 }, warps, cns);
    if (float.face !== null && float.face == face) {
      segments.unshift((left_edge - count))
    } else {
      edge_found = true;
    }
  }


  //walk right to find attached
  edge_found = false;
  for (let count = 1; count < warps && !edge_found; count++) {
    let adj_j = strictMod((right_edge + count), warps);
    let face = getFace({ i, j: adj_j, id: 0 }, warps, cns);
    if (float.face !== null && float.face == face) {
      segments.push(right_edge + count);

    } else {
      edge_found = true;
    }
  }

  //SEGMENTS NOW CONTAINS A LIST OF ALL the Cells of the same face color, the left most and right most CNS in these cells should be the edges. This list may be empty if there was only the opposite color attached. 

  let loops = 0;
  while (segments.length > 0 && loops < 20) {
    loops++;
    let extracted = extractFloat(i, warps, float.face, segments, cns);
    if (extracted.float !== null) {
      attached.push(extracted.float)
    }

    segments = segments.filter(el => el > extracted.last);
  }

  return attached;
}

/**
 * Given two floats that lie above each other on the draft, this function determines the relation ship of the float and the floats on previous rows. 
 * @param float 
 * @param attached 
 * @returns 
 */
const getWarpwiseRelationship = (float: CNFloat, attached: Array<CNFloat>): Array<string> => {

  let res: Array<string> = attached.reduce((acc, el) => {
    let top_length = float.right.j - float.left.j;
    let bottom_length = el.right.j - el.left.j;

    if (float.right.j > el.right.j && float.left.j > el.left.j) acc.push("BUILD");
    else if (float.right.j < el.right.j && float.left.j < el.left.j) acc.push("BUILD");
    else if (float.right.j == el.right.j && float.left.j == el.left.j) acc.push("STACK");
    else if (float.left.j == el.left.j || float.right.j == el.right.j) {
      if (top_length > bottom_length) {
        if (float.face == false) acc.push("SLIDE-OVER")
        else acc.push("SLIDE-UNDER")
      } else {
        if (float.face == false) acc.push("SLIDE-UNDER")
        else acc.push("SLIDE-OVER")
      }
    }

    else if (float.left.j < el.left.j && float.right.j > el.right.j) {
      if (float.face == false) acc.push("SLIDE-OVER");
      else acc.push("SLIDE-UNDER");
    }

    else if (float.left.j > el.left.j && float.right.j < el.right.j) {
      if (float.face == false) acc.push("SLIDE-UNDER");
      else acc.push("SLIDE-OVER");
    } else {
      console.error(" UNACCOUNTED FOR RELATIONSHIP FOUND BETWEEN ", float, el)
    }
    return acc;
  }, []);


  return res;







}


/**
 * used when parsing the CN graph, this function looks at the next cell in some direction to determine if it should assign ACNs to any of it's edges. 
 * @param i 
 * @param j 
 * @param wefts 
 * @param warps 
 * @param layer 
 * @param direction 
 * @param cns 
 * @returns 
 */
const getNextCellOnLayer = (i: number, j: number, wefts: number, warps: number, layer: number, direction: string, cns: Array<ContactNeighborhood>): { i: number, j: number } => {
  let i_base = i;
  let j_base = j;

  switch (direction) {
    case "above":
      for (let i_offset = 0; i_offset < wefts; i_offset++) {
        let i_adj = strictMod(i_base - i_offset, wefts);
        if (getMvZ({ i: i_adj, j, id: 0 }, warps, cns) == layer) {
          return { i: i_adj, j }
        }
      }
      return null;

    case "below":
      for (let i_offset = 0; i_offset < wefts; i_offset++) {
        let i_adj = strictMod(i_base + i_offset, wefts);
        if (getMvZ({ i: i_adj, j, id: 0 }, warps, cns) == layer) {
          return { i: i_adj, j }
        }
      }
      return null;


    case "left":
      for (let j_offset = 0; j_offset < warps; j_offset++) {
        let j_adj = strictMod(j_base - j_offset, warps);
        if (getMvZ({ i, j: j_adj, id: 0 }, warps, cns) == layer) {
          return { i, j: j_adj }
        }
      }
      return null;


    case "right":
      for (let j_offset = 0; j_offset < warps; j_offset++) {
        let j_adj = strictMod(j_base + j_offset, warps);
        if (getMvZ({ i, j: j_adj, id: 0 }, warps, cns) == layer) {
          return { i, j: j_adj }
        }
      }
      return null;
  }

  console.error("DIRECTION ", direction, "NOT FOUND")

}


/**
 * given two faces (assuming two neighboring faces), this function determines what kind of node type should be assigned
 * @param f1 
 * @param f2 
 * @param ndx 
 * @param warps 
 * @param cns 
 * @returns 
 */
const classifyNodeTypeBasedOnFaces = (f1: boolean, f2: boolean, ndx: CNIndex, warps: number, cns: Array<ContactNeighborhood>): Array<ContactNeighborhood> => {
  if (setAndOppositeFaces(f1, f2)) {
    cns = setNodeType(ndx, warps, cns, 'ACN');
  } else if (setAndSameFaces(f1, f2)) {
    cns = setNodeType(ndx, warps, cns, 'PCN')
  } else if (f1 !== null && f2 == null) {
    cns = setNodeType(ndx, warps, cns, 'ACN')
  } else {
    cns = setNodeType(ndx, warps, cns, 'ECN')
  }
  return cns;
}



// LAYER PARSING

/**
 * given a range in i and/or j this returns any float that has at least part of it within the boundary formed by i and j. 
 * @param i  //the l can be less than 0 and r can be greater than wefts
 * @param j 
 * @param fs 
 */
const getUntouchedFloatsInRange = (i: { l: number, r: number }, j: { l: number, r: number }, all_floats: Array<{ id: number, float: CNFloat; touched: boolean }>, wefts: number, warps: number, cns): Array<number> => {


  let candidates: Array<CNFloat> = [];
  let in_range: Array<number> = [];

  //unwrap the range
  if (i.l > i.r) {
    i.r = wefts + i.r;
  }

  //unwrap the range
  if (j.l > j.r) {
    j.r = warps + j.r;
  }

  for (let x = i.l; x <= i.r; x++) {
    for (let y = j.l; y <= j.r; y++) {
      let adj_i = strictMod(x, wefts);
      let adj_j = strictMod(y, warps);

      let weft = getWeftFloat(adj_i, adj_j, warps, cns);
      if (weft !== null) candidates.push(weft);

      let warp = getWarpFloat(adj_i, adj_j, wefts, warps, cns);
      if (warp !== null) candidates.push(warp);

    }
  }

  in_range = candidates.map(el => getFloatIndex(el, all_floats)).filter(el => el !== -1 && !all_floats[el].touched);

  return in_range;


}

const rowHasActiveCNs = (i: number, warps: number, cns: Array<ContactNeighborhood>): boolean => {

  let active = cns.filter(el => el.ndx.i == i && el.node_type !== 'ECN' && el.ndx.id < 2);
  return active.length > 0;

}

/**
 * This function will virtually "lift" the float specified. If this is a warp float, it will find any other warp floats or weft floats that cross over this warp in the range of limit (to the top/bottom) and mark them to be lifted. If it is a weft float, it will find any other weft floats or warp floats that cross over this weft and mark them to be lifted.
 * @param float 
 * @param wefts 
 * @param warps 
 * @param cns 
 * @returns 
 */
const getFloatsAffectedByLifting = (float: CNFloat, all_floats: Array<{ id: number, float: CNFloat; touched: boolean }>, wefts: number, warps: number, limit: number, cns: Array<ContactNeighborhood>) => {

  let attached: Array<number> = [];

  let i_range, j_range = null;

  if (float.face) {
    //this is warp facing.

    if ((getWarpFloatLength(float, wefts) + limit * 2) >= wefts) {
      i_range = { l: 0, r: wefts - 1 };

    } else {
      i_range = { l: strictMod(float.left.i - limit, wefts), r: strictMod(float.right.i + limit, wefts) };

    }

    j_range = { l: float.left.j, r: float.right.j };
  } else {
    //this is weft facing. 

    if (getWeftFloatLength(float, warps) + limit * 2 >= warps) {
      j_range = { l: 0, r: warps - 1 };

    } else {
      j_range = { l: strictMod(float.left.j - limit, warps), r: strictMod(float.right.j + limit, warps) };
    }

    i_range = { l: float.left.i, r: float.right.i };

  }


  attached = getUntouchedFloatsInRange(i_range, j_range, all_floats, wefts, warps, cns);
  attached = <Array<number>>filterToUniqueValues(attached);
  return attached;

}

//sets this entire node to ECN and the face to null
const unsetNodesAtIJ = (i: number, j: number, warps: number, cns: Array<ContactNeighborhood>): Array<ContactNeighborhood> => {
  cns = setFace({ i, j, id: 0 }, warps, cns, null);
  cns = setFace({ i, j, id: 1 }, warps, cns, null);
  cns = setFace({ i, j, id: 2 }, warps, cns, null);
  cns = setFace({ i, j, id: 3 }, warps, cns, null);

  //SET LEFT AND RIGHT TO EMPTY
  cns = setNodeType({ i, j, id: 0 }, warps, cns, 'ECN');
  cns = setNodeType({ i, j, id: 1 }, warps, cns, 'ECN');

  //SET TOP AND BOTTOM to POTENTIAL, 
  cns = setNodeType({ i, j, id: 2 }, warps, cns, 'PCN');
  cns = setNodeType({ i, j, id: 3 }, warps, cns, 'PCN');

  return cns;

}

const determineEdgeBehavior = (pick_id: number, j: number, valid_picks: Array<number>, warps: number, right: boolean, cns: Array<ContactNeighborhood>): { cns: Array<ContactNeighborhood>, next_j: number } => {

  console.log("TOP IS ", pick_id)

  let directions = { left: { inc: 1, id: 0 }, right: { inc: -1, id: 1 } };
  let dir = (right) ? directions.right : directions.left;

  if (valid_picks.length <= 1) return { cns, next_j: -1 };

  let top = valid_picks[pick_id];
  let bottom = valid_picks[strictMod(pick_id - 1, valid_picks.length)];


  console.log("GET FACE OF ", { i: top, j, id: 0 })
  let top_f = getFace({ i: top, j, id: 0 }, warps, cns);
  console.log("GET FACE OF ", { i: bottom, j, id: 0 })
  let bottom_f = getFace({ i: bottom, j, id: 0 }, warps, cns);


  if (setAndSameFaces(top_f, bottom_f)) {

    cns = unsetNodesAtIJ(top, j, warps, cns);
    cns = unsetNodesAtIJ(bottom, j, warps, cns);

    return { cns, next_j: j - 1 };

  } else if (setAndOppositeFaces(top_f, bottom_f)) {

    cns = setNodeType({ i: top, j, id: dir.id }, warps, cns, 'ACN');
    cns = setNodeType({ i: bottom, j, id: dir.id }, warps, cns, 'ACN');

    return { cns, next_j: -1 };

  } else if (top_f == null) {

    if (bottom_f == true) {
      for (let search = j + dir.inc; search >= 0 && search < warps; search = search + dir.inc) {
        console.log("SEARCHING", top, { i: top, j: search, id: 0 })
        if (getFace({ i: top, j: search, id: 0 }, warps, cns) !== null) {
          cns = setNodeType({ i: bottom, j: search, id: dir.id }, warps, cns, 'ACN');
          return { cns, next_j: -1 };
        }
      }

      //I got to the end and it never found anything, just stop
      return { cns, next_j: -1 }
    }
    else if (bottom_f == false) {

      cns = unsetNodesAtIJ(top, j, warps, cns);
      cns = unsetNodesAtIJ(bottom, j, warps, cns);
      return { cns, next_j: j - 1 };
    }
    else {
      return { cns, next_j: j - 1 };
    }
  } else if (bottom_f == null) {
    if (top_f) {
      cns = setNodeType({ i: top, j, id: dir.id }, warps, cns, 'ACN');
      return { cns, next_j: -1 };
    } else {
      cns = unsetNodesAtIJ(top, j, warps, cns)
      return { cns, next_j: j + dir.inc };
    }
  } else {
    console.error("UNHANDLED EDGE BEHAVIOR", top, bottom, j, top_f, bottom_f)

  }




}


/**
 * if we pull on the edge of a freshly inserted weft, we need to see if it will unpick or not. This simulates how the weft might unpick (as a relationship to other wefts that share a material and system and then update the contact nodes to account for the behavior of this weft. )
 * @param bottom 
 * @param j 
 * @param warps 
 * @param cns 
 * @returns 
 */
//   const determineRightEdgeBehavior = (top: number, bottom: number, next: number, j: number, warps: number, cns: Array<ContactNeighborhood>) : {cns: Array<ContactNeighborhood>, next_j: number} => {
//   let top_f = getFace({i:top, j, id: 0}, warps, cns);
//   let bottom_f = getFace({i:bottom, j, id: 0}, warps, cns);

//   if(setAndSameFaces(top_f, bottom_f)){

//     //SET LEFT AND RIGHT TO EMPTY
//     cns = setNodeType({i:top, j, id:0}, warps, cns, 'ECN');
//     cns = setNodeType({i:bottom, j, id:0}, warps, cns, 'ECN');
//     cns = setNodeType({i:top, j, id:1}, warps, cns, 'ECN');
//     cns = setNodeType({i:bottom, j, id:1}, warps, cns, 'ECN');

//     //SET TOP AND BOTTOM to POTENTIAL, 
//     cns = setNodeType({i:top, j, id:2}, warps, cns, 'PCN');
//     cns = setNodeType({i:bottom, j, id:2}, warps, cns, 'PCN');
//     cns = setNodeType({i:top, j, id:3}, warps, cns, 'PCN');
//     cns = setNodeType({i:bottom, j, id:3}, warps, cns, 'PCN');

//     return {cns, next_j: j-1};

//   }else if(setAndOppositeFaces(top_f, bottom_f)){

//     cns = setNodeType({i:top, j, id:1}, warps, cns, 'ACN');
//     cns = setNodeType({i:bottom, j, id:1}, warps, cns, 'ACN');

//     return {cns, next_j: -1};


//   }else if(top_f == null){

//     if(bottom_f == true){
//       for(let search = j-1; search <= 0; search--){
//         if(getFace({i:top, j:search, id:0}, warps, cns) !== null){
//            cns = setNodeType({i:bottom, j:search, id:1}, warps, cns, 'ACN');
//           return {cns, next_j: -1};
//         }
//       }
//       //I got to the end and it never found anything, just stop
//       return {cns, next_j:-1}
//     }
//     else if(bottom_f == false){

//       cns = setNodeType({i:top, j, id:0}, warps, cns, 'ECN');
//       cns = setNodeType({i:bottom, j, id:0}, warps, cns, 'ECN');
//       cns = setNodeType({i:top, j, id:1}, warps, cns, 'ECN');
//       cns = setNodeType({i:bottom, j, id:1}, warps, cns, 'ECN');
//       return {cns, next_j: j-1};
//     }
//     else {
//       return {cns, next_j: j-1};
//     }
//   }else if(bottom_f == null){
//     if(top_f){
//        cns = setNodeType({i:top, j, id:1}, warps, cns, 'ACN');
//       return {cns, next_j: -1};
//     }else{
//       cns = setNodeType({i:top, j, id:0}, warps, cns, 'ECN');
//       cns = setNodeType({i:top, j, id:1}, warps, cns, 'ECN');
//       return {cns, next_j: j-1};
//     }
//   }else{
//     console.error("UNHANDLED RIGHT EDGE BEHAVIOR", top, bottom, j, top_f, bottom_f)

//   }

// }

/**
 * when pulling the row, we need to know if or how to pull the yarn based on the relationships between acns on successive wefts. For instance, if it iterlaces the edge or if it is a repeat and essentially pulls itself out of the structure. 
 * @param top 
 * @param bottom 
 * @param j 
 * @param warps 
 * @param cns 
 * @returns 
 */
// const determineLeftEdgeBehavior = (top: number, bottom: number, j: number, warps: number, cns: Array<ContactNeighborhood>) : {cns: Array<ContactNeighborhood>, next_j: number} => {


//   let top_f = getFace({i:top, j, id: 0}, warps, cns);
//   let bottom_f = getFace({i:bottom, j, id: 0}, warps, cns);


//   if(setAndSameFaces(top_f, bottom_f)){
//     // console.log("SET AND SAME")

//     cns = setNodeType({i:top, j, id:0}, warps, cns, 'ECN');
//     cns = setNodeType({i:bottom, j, id:0}, warps, cns, 'ECN');
//     cns = setNodeType({i:top, j, id:1}, warps, cns, 'ECN');
//     cns = setNodeType({i:bottom, j, id:1}, warps, cns, 'ECN');

//     cns = setNodeType({i:top, j, id:2}, warps, cns, 'PCN');
//     cns = setNodeType({i:bottom, j, id:2}, warps, cns, 'PCN');
//     cns = setNodeType({i:top, j, id:3}, warps, cns, 'PCN');
//     cns = setNodeType({i:bottom, j, id:3}, warps, cns, 'PCN');
//     return {cns, next_j: j+1};

//   }else if(setAndOppositeFaces(top_f, bottom_f)){
//     // console.log("SET AND OP")

//     cns = setNodeType({i:top, j, id:0}, warps, cns, 'ACN');
//     cns = setNodeType({i:bottom, j, id:0}, warps, cns, 'ACN');
//     return {cns, next_j: -1};

//   }else if(top_f == null){

//       if(bottom_f == true){
//           // console.log("UNSET (top) and RAISED (bottom)")

//           for(let search = j+1; search < warps; search++){
//             if(getFace({i:top, j:search, id:0}, warps, cns) !== null){
//               cns = setNodeType({i:bottom, j:search, id:0}, warps, cns, 'ACN');
//               return {cns, next_j: -1};
//             }
//           }
//           //I got to the end and it never found anything, just stop
//           return {cns, next_j:-1}
//       }
//       else if(bottom_f == false){
//             // console.log("UNSET (top) and Lowered (bottom)")

//           cns = setNodeType({i:top, j, id:0}, warps, cns, 'ECN');
//           cns = setNodeType({i:bottom, j, id:0}, warps, cns, 'ECN');
//           cns = setNodeType({i:top, j, id:1}, warps, cns, 'ECN');
//           cns = setNodeType({i:bottom, j, id:1}, warps, cns, 'ECN');
//           return {cns, next_j: j+1};
//       }
//       else {
//           //console.log("UNSET BOTH")
//           return {cns, next_j: j+1};
//         } 
//   }else if(bottom_f == null){

//     //handle if top is black or top is while
//     if(top_f){
//         cns = setNodeType({i:top, j, id:0}, warps, cns, 'ACN');
//         return {cns, next_j: -1};
//     }else{
//        cns = setNodeType({i:top, j, id:0}, warps, cns, 'ECN');
//        cns = setNodeType({i:bottom, j, id:0}, warps, cns, 'ECN');
//        cns = setNodeType({i:top, j, id:1}, warps, cns, 'ECN');
//        return {cns, next_j: j+1};
//     }


//   }else{
//     console.error("UNHANDLED LEFT EDGE BEHAVIOR", top, bottom, j, top_f, bottom_f)
//   }

// }


/**
 * determining layers requires keeping a list of floats with ids. This function takes a given float and sees if there is a float in the list that matches it's dimensions, returning the id of the index at which that float was found. 
 * @param float 
 * @param all_float_objs 
 * @returns 
 */
const getFloatIndex = (float: CNFloat, all_float_objs: Array<{ id: number, float: CNFloat, touched: boolean }>): number => {

  if (float == null || float.left == null || float.right == null) {
    console.error("FLOAT IS NULL GET IN GET INDEX ", float);
    return -1;
  }
  let ndx = all_float_objs.findIndex(el => el.float.left.i == float.left.i && el.float.left.j == float.left.j && el.float.left.id == float.left.id);

  //if(ndx == -1) console.error("FLOAT OBJS DID NOT CONTAIN OBJECT", float, all_float_objs);
  return ndx;

}


const setFloatZ = (float: CNFloat, wefts: number, warps: number, layer: number, cns: Array<ContactNeighborhood>): Array<ContactNeighborhood> => {
  //lift the entire float: 
  if (float.face) {

    for (let x = 0; x <= getWarpFloatLength(float, wefts); x++) {
      let adj_i = strictMod(float.left.i + x, wefts);
      //only set values that have no already been set by another layer
      if (getMvZ({ i: adj_i, j: float.left.j, id: 0 }, warps, cns) == 0) {
        cns = setMvZ({ i: adj_i, j: float.left.j, id: 0 }, warps, cns, layer);
        cns = setMvZ({ i: adj_i, j: float.left.j, id: 1 }, warps, cns, layer);
        cns = setMvZ({ i: adj_i, j: float.left.j, id: 2 }, warps, cns, layer);
        cns = setMvZ({ i: adj_i, j: float.left.j, id: 3 }, warps, cns, layer);
      }
    }
  } else if (float.face === false) {
    for (let x = 0; x <= getWeftFloatLength(float, warps); x++) {
      let adj_j = strictMod(float.left.j + x, warps);
      if (getMvZ({ i: float.left.i, j: adj_j, id: 0 }, warps, cns) == 0) {
        cns = setMvZ({ i: float.left.i, j: adj_j, id: 0 }, warps, cns, layer);
        cns = setMvZ({ i: float.left.i, j: adj_j, id: 1 }, warps, cns, layer);
        cns = setMvZ({ i: float.left.i, j: adj_j, id: 2 }, warps, cns, layer);
        cns = setMvZ({ i: float.left.i, j: adj_j, id: 3 }, warps, cns, layer);
      }
    }

  }

  return cns;
}




/**
 * this needs to recursively search the previous rows (and loop if needed) to determine how far this float can slide in the y direction. 
 * @param i the row to which we are comparing
 * @param mvy the number of rows this has already moved
 * @param float the float we are comparing to
 * @param warps the width of the cloth
 * @param cns the list of contact neighborhoods
 */
const calcMVYValue = (i: number, i_start: number, mvy: number, z_map: Array<{ i: number, reltn: string }>, float: CNFloat, wefts: number, warps: number, cns: Array<ContactNeighborhood>): { mvy: number, z_map: Array<{ i: number, reltn: string }>, next_i: number } => {

  //wrap to continue search but eventually stop if we've covered the whole cloth
  let adj_i = i;
  if (i < 0) adj_i = strictMod(i, wefts);
  if (strictMod(i, wefts) == i_start) return { mvy, z_map, next_i: null }
  //get all of the attached floats on i
  let attached: Array<CNFloat> = getAttachedFloats(adj_i, wefts, warps, float, cns);

  //we need a bit more information in this case
  let reltn = [];

  if (attached.length == 0) {
    //peak right and left; 
    let right_edge_ndx = { i: adj_i, j: float.right.j, id: 1 };
    let right_edge_type = getNodeType(right_edge_ndx, warps, cns);
    let left_edge_ndx = { i: adj_i, j: float.left.j, id: 0 };
    let left_edge_type = getNodeType(left_edge_ndx, warps, cns);

    if (left_edge_type == "ACN" || right_edge_type == 'ACN') {
      reltn.push("BUILD");
    } else {
      reltn.push(["SLIDE-OPP"]); //sliding on the opposite side of the warp
    }

  } else {
    //determine what kind of relationship the 
    reltn = getWarpwiseRelationship(float, attached);
  }


  //console.log("FOUND RELATIONS ", float, reltn.map(el => String(el)))
  //adjust the right side of the float to clamp the value in: 
  if (reltn.find(el => el == "BUILD") !== undefined) {
    z_map.push({ i: i, reltn: 'BUILD' });
    return { mvy, z_map, next_i: null }

  } else if (reltn.find(el => el == "SLIDE-OPP") !== undefined) {
    z_map.push({ i: i, reltn: 'SLIDE_OPP' });
    return { mvy: mvy + 1, z_map, next_i: i - 1 }


  } else if (reltn.find(el => el == "STACK") !== undefined) {
    z_map.push({ i: i, reltn: 'STACK' });
    return { mvy: mvy + .5, z_map, next_i: i - 1 }
  } else {
    //SLIDE OVER OR UNDER

    if (reltn.find(el => el == "SLIDE-OVER") !== undefined) {
      z_map.push({ i: i, reltn: 'SLIDE-OVER' });
      return { mvy: mvy + 1, z_map, next_i: i - 1 };

      //   let factor = (float.face) ? -1 : 1;

      //   //get the largest layer offset from the previous row's attached warps
      //   let prev_z = attached.reduce((acc, el) => {
      //     if(el.left.j >= 0 && el.left.j < warps){
      //       let left_z = getMvZ(el.left, warps, cns);
      //       if(Math.abs(left_z) > acc) acc = Math.abs(left_z);
      //     }

      //     if(el.right.j >= 0 && el.right.j < warps){
      //       let right_z = getMvZ(el.right, warps, cns);
      //       if(Math.abs(right_z) > acc) acc = Math.abs(right_z);
      //     }

      //     return acc;
      //   }, 0)

      //     cns = setMvZ(float.left, warps, cns, prev_z*factor+factor);
      //     cns = setMvZ(float.right, warps, cns, prev_z*factor+factor);

    }


    if (reltn.find(el => el == "SLIDE-UNDER") !== undefined) {
      z_map.push({ i: i, reltn: 'SLIDE-UNDER' });
      return { mvy: mvy + 1, z_map, next_i: i - 1 };
      //   //this float is going to slide under the float before it. 

      //   //this now needs to do an ordering sequence with the wefts before it. 

      //   //the mvy factor should represent how many attached wefts this weft can float under

      //   //for each of those attached wefts, we need to figure out what their current z level is and then set them to be above this one.




      //   //if I am warp faced float, I'm going to be on the back (-) side of the cloth
      //   let factor = (float.face) ? -1 : 1;

      //     attached.forEach(attached_float => {
      //       if(attached_float.left.j >= 0){
      //          let prev_attached_left_z = getMvZ(attached_float.left, warps, cns);
      //          cns = setMvZ(attached_float.left, warps, cns, prev_attached_left_z+factor);
      //       }

      //       if(attached_float.right.j < warps){
      //         let prev_attached_right_z = getMvZ(attached_float.right, warps, cns);
      //          cns = setMvZ(attached_float.right, warps, cns, prev_attached_right_z+factor);

      //       }

      //     });
    }

  }
}






// TOP LEVEL FUNCTIONS USED TO BUILD THE TOPOLOGY

/**
 * creates an empty set of CN's for the given drawdown and then walks through and populates their face and id values. 
 * @param dd 
 * @returns an initialized list of contact neighborhoods
 */
const initContactNeighborhoods = (dd: Drawdown): Promise<Array<ContactNeighborhood>> => {
  let width = warps(dd);
  let height = wefts(dd);
  let size = width * height * 4;
  let cns: Array<ContactNeighborhood> = new Array<ContactNeighborhood>(size);

  for (let x = 0; x < cns.length; x++) {
    cns[x] = {
      ndx: { i: 0, j: 0, id: 0 },
      node_type: 'ECN',
      mv: { y: 0, z: 0 },
      face: null,
    }
  }

  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {

      cns = setIndex({ i, j, id: 0 }, width, cns);
      cns = setIndex({ i, j, id: 1 }, width, cns);
      cns = setIndex({ i, j, id: 2 }, width, cns);
      cns = setIndex({ i, j, id: 3 }, width, cns);

      let face = getCellValue(dd[i][j]);
      cns = setFace({ i, j, id: 0 }, width, cns, face)
      cns = setFace({ i, j, id: 1 }, width, cns, face)
      cns = setFace({ i, j, id: 2 }, width, cns, face)
      cns = setFace({ i, j, id: 3 }, width, cns, face)

    }
  }
  return Promise.resolve(cns);
}


/**
 * analyses the relationship between the current row's CNS and the previous rows CNS to determine if and how far the floats on this row can pack. 
 * @param i the row number
 * @param cns the list of current contact neighborhoods
 */
const packPicks = (wefts: number, warps: number, cns: Array<ContactNeighborhood>): Array<ContactNeighborhood> => {

  for (let i = 0; i < wefts; i++) {

    let floats: Array<CNFloat> = getRowAsFloats(i, warps, cns);
    //console.log("ANALYSING ", i)

    floats.forEach(float => {
      if (float.face != null) {
        // console.log("CHECKING FLOAT ", float.left.j, float.right.j)
        let obj = calcMVYValue(i - 1, i, 0, [], float, wefts, warps, cns);
        //console.log("*RETURNED ", obj)
        while (obj.next_i !== null) {
          obj = calcMVYValue(obj.next_i, i, obj.mvy, obj.z_map, float, wefts, warps, cns);
          //console.log("RETURNED ", obj)

        }
        cns = setMvY(float.left, warps, cns, obj.mvy);
        let adj_right: CNIndex = {
          i: float.right.i,
          j: strictMod(float.right.j, warps),
          id: float.right.id
        };

        cns = setMvY(adj_right, warps, cns, obj.mvy);


      }
    });
    return cns;
  }
}




const updateCNs = (cns: Array<ContactNeighborhood>, wefts: number, warps: number, sim: SimulationVars): Array<ContactNeighborhood> => {
  console.log("UPDATE CNS ",)

  let regions = [
    { name: "above", id: 2, start_i: -1, start_j: 0 },
    { name: "below", id: 3, start_i: 1, start_j: 0 },
    { name: "left", id: 0, start_i: 0, start_j: -1 },
    { name: "right", id: 1, start_i: 0, start_j: 1 },
  ]
  for (let i = 0; i < wefts; i++) {
    for (let j = 0; j < warps; j++) {
      let face = getFace({ i, j, id: 0 }, warps, cns);
      let layer = getMvZ({ i, j, id: 0 }, warps, cns);

      for (let region of regions) {
        //find the next next acn above that shares the layer
        let ij = getNextCellOnLayer(i + region.start_i, j + region.start_j, wefts, warps, layer, region.name, cns);
        if (ij == null) {
          cns = setNodeType({ i, j, id: region.id }, warps, cns, 'ECN')
        } else {
          let last_face = getFace({ i: ij.i, j: ij.j, id: 0 }, warps, cns)
          cns = classifyNodeTypeBasedOnFaces(face, last_face, { i, j, id: region.id }, warps, cns);

        }

        //ADD ANY REQUIRED VIRTUAL NODES for FULL WIDTH RENDERING
        let ndx = { i, j, id: region.id };
        if (!sim.wefts_as_written) {
          switch (region.name) {
            case "above":
              if (i == 0 && getNodeType(ndx, warps, cns) !== 'ACN') setNodeType(ndx, warps, cns, 'VCN')
              break;

            case "below":
              if (i == wefts - 1 && getNodeType(ndx, warps, cns) !== 'ACN') setNodeType(ndx, warps, cns, 'VCN')
              break;

            case "left":
              if (j == 0 && getNodeType(ndx, warps, cns) !== 'ACN') setNodeType(ndx, warps, cns, 'VCN')
              break;

            case "right":
              if (j == warps - 1 && getNodeType(ndx, warps, cns) !== 'ACN') setNodeType(ndx, warps, cns, 'VCN')
              break;
          }


        }
      }
    }
  }
  return cns;

}


const pullRows = (d: Draft, paths: Array<WeftPath>, cns: Array<ContactNeighborhood>): Array<ContactNeighborhood> => {

  for (let i = 0; i < wefts(d.drawdown); i++) {
    let path = getWeftPath(paths, d.rowSystemMapping[i], d.rowShuttleMapping[i]);
    cns = pullRow(i, wefts(d.drawdown), warps(d.drawdown), path.pics, cns);
  }

  return cns;
}




/** checks this row against the last row of the same material and system type and sees if the edge will interlace. If not, it removes any ACNs that would be pulled out in this pic */
export const pullRow = (i: number, wefts: number, warps: number, prev_i_list: Array<number>, cns: Array<ContactNeighborhood>): Array<ContactNeighborhood> => {

  console.log("PULLING ROW ", i, prev_i_list)

  if (prev_i_list.length == 0) return cns;

  //last can't always just be the last row in the list, because this would look pairwise and not consider prior rows that have been un-picked. 
  let last = -1;
  let next = -1;

  //get only picks in this list that have valid. 
  let valid_pics = prev_i_list.filter(el => rowHasActiveCNs(el, warps, cns));
  let ndx = valid_pics.findIndex(el => el == i);

  if (ndx == -1) return cns;

  const direction = ndx % 2 == 1; //true means the previous row went from left to right
  let starting_j = (direction) ? warps - 1 : 0;

  let obj: { cns: Array<ContactNeighborhood>, next_j: number } = determineEdgeBehavior(ndx, starting_j, valid_pics, warps, direction, cns);
  cns = obj.cns;

  while (obj.next_j !== -1 && obj.next_j < warps && obj.next_j >= 0) {

    obj = determineEdgeBehavior(ndx, obj.next_j, valid_pics, warps, direction, cns);
    cns = obj.cns;
  }


  // console.log("AFTER i ", i);
  // printYValues(cns, wefts, warps, false);
  printYValues(cns, wefts, warps, true);
  return cns;
}

/**
* starting with the longest warp, this function searches for all the floats that would be affected (and then would subsequently affect others, if that warp was lifted) the degree or (height) to which it is lifted is specified by the "lift-limit" param in SimulationVars. This assigns layers sequentially, with 1 meaning it is the top layer (looking down on the cloth from above), 2 is the next layer under, 3 is under 2 and so on. a value of 0 means that that this CN was never visited by the algorithm. This function is called recursively as long as there are still floats to analyze. 
* @param wefts 
* @param warps 
* @param layer 
* @param cns 
* @param sim 
* @returns 
*/
const isolateLayers = (wefts: number, warps: number, layer: number, cns: Array<ContactNeighborhood>, sim: SimulationVars): Array<ContactNeighborhood> => {



  //get weft floats; 
  let floats: Array<CNFloat> = [];

  for (let i = 0; i < wefts; i++) {
    floats = floats.concat(getRowAsFloats(i, warps, cns).filter(float => !float.face));
  }

  for (let j = 0; j < warps; j++) {
    floats = floats.concat(getColAsFloats(j, wefts, warps, cns).filter(float => float.face));
  }

  floats = floats.filter(el => getMvZ(el.left, warps, cns) == 0);


  const floats_with_id = floats.map((el, ndx) => { return { id: ndx, float: el, touched: false } });

  if (floats_with_id.length == 0) return cns;

  let longest_warp = floats
    .reduce((acc, el, ndx) => {
      if (el.face) {
        let len = getWarpFloatLength(el, wefts) + 1;
        if (len >= acc.len) {
          acc.len = len;
          acc.id = ndx;
        }
      }
      return acc;
    }, { len: 0, id: -1 })


  //internally recursive function that updates the float list
  function liftFloat(float: CNFloat, float_ndx: number) {


    let float_obj = floats_with_id[float_ndx];

    if (float_obj.touched == true) return;

    float_obj.touched = true;

    let attached: Array<number> = [];

    attached = getFloatsAffectedByLifting(float, floats_with_id, wefts, warps, sim.lift_limit, cns);


    if (attached.length == 0) return;


    for (let a = 0; a < attached.length; a++) {
      let float_ndx = attached[a];
      let a_float: CNFloat = floats_with_id[float_ndx].float;
      if (float_ndx !== -1) liftFloat(a_float, float_ndx);
    }
  }


  //pull up on the longest warp float, see what moves with it. 
  liftFloat(floats[longest_warp.id], longest_warp.id);


  console.log("**** LIFTING COMPLETE ****")
  for (let f of floats_with_id) {
    if (f.touched) {
      cns = setFloatZ(f.float, wefts, warps, layer, cns);
    }
  }
  cns = updateCNs(cns, wefts, warps, sim);
  printLayerMap(cns, wefts, warps);
  return isolateLayers(wefts, warps, ++layer, cns, sim)
}



/**
 * this will read through a current drawdown and populate the information needed for the contact neighborhoods, determining if and how different wefts stack or slide, etc. This will change based on the behavior of the wefts so we do need some information here if the simulation should assume the wefts run full width or if we want to simulate as drafted (where, if there isn't a selvedge, some might pull out) 
 * @param dd 
 * @param cns 
 * @param sim variables to control how the parsing takes place (e.g. specifically if you want to render the draft as it would be woven vs forcing it to go full width)
 * @returns 
 */
const parseDrawdown = (d: Draft, cns: Array<ContactNeighborhood>, sim: SimulationVars): Promise<Array<ContactNeighborhood>> => {

  console.log("**************** NEW DRAFT LOADED **************", d)

  let paths: Array<WeftPath> = initWeftPaths(d);
  paths = parseWeftPaths(d, paths);

  let dd = d.drawdown;

  //START BY POPULATING THE CNS MAPS
  cns = updateCNs(cns, wefts(d.drawdown), warps(d.drawdown), sim);


  if (sim.wefts_as_written) {
    cns = pullRows(d, paths, cns);
    //update CNS after pull to reset warp aligned ACNS
    cns = updateCNs(cns, wefts(d.drawdown), warps(d.drawdown), sim);
  }

  if (sim.use_layers) cns = isolateLayers(wefts(dd), warps(dd), 1, cns, sim);

  cns = packPicks(wefts(dd), warps(dd), cns);

  printYValues(cns, wefts(dd), warps(dd), true)
  return Promise.resolve(cns);
}



/**
 * update this to contact neighborhood 
 */
export const getDraftTopology = async (draft: Draft, sim: SimulationVars): Promise<Array<ContactNeighborhood>> => {

  return initContactNeighborhoods(draft.drawdown)
    .then(cns => {
      return parseDrawdown(draft, cns, sim);
    });
}


// RENDERING TOPOLOGY TO VERTEX


/**
 * if every row is packed at the same packing force, then the fell line created by a straight beater would be represented by the maximum y value;  Y values represent the center of teh material. 
 * @param vtxs 
 * @returns the y value represented by the top edge of the last weft inserted and packed. 
 */
const getFellY = (vtxs: Array<YarnVertex>, diameter: number): number => {
  let max_y = vtxs.reduce((acc, el) => {
    if (el.y > acc) return el.y;
    return acc;
  }, 0);
  return max_y + diameter / 2;

}

/**
 * looks at the move number of the current node and determines, based on the nodes this is connected to, how far is should actually move from it's relationship to neighboring interlacements. This could be more sophisticated (but right now it returns the max over a window of a given size). 
 * @param ndx 
 * @param cns 
 */
const calcYOffset = (ndx: CNIndex, warps: number, cns: Array<ContactNeighborhood>, simVars: SimulationVars): number => {

  let max_dist = 10; //the distance at which one weft would NOT affect another
  let mvy = getMvY(ndx, warps, cns);

  let j_dist = simVars.warp_spacing;  //the distance traveled for each j
  let j_check = Math.floor((max_dist / j_dist) / 2);
  let left = (simVars.wefts_as_written) ? ndx.j - j_check : strictMod(ndx.j - j_check, warps);
  let right = (simVars.wefts_as_written) ? ndx.j + j_check : strictMod(ndx.j + j_check, warps);
  let j_left = Math.min(left, right);
  let j_right = Math.max(left, right);

  // console.log("J, J LEFT, J RIGHT ", ndx.j, j_left, j_right)
  let row = cns.filter(
    el => el.ndx.i == ndx.i
      && el.node_type == "ACN"
      && el.ndx.j >= j_left
      && el.ndx.j <= j_right
  );

  //row should have at least i
  // console.log("ROW ", row);

  // let sum:number = row.reduce((acc, el) => {
  //   acc += el.mv.y;
  //   return acc;
  // }, 0);

  // return sum / row.length;

  let min: number = row.reduce((acc, el) => {
    if (acc < el.mv.y) acc = el.mv.y;
    return acc;
  }, mvy);

  return min;



}


/**
 * converts the information for the CN into a vertex using the information from the CNs as well as the simulation variables. It assumes that for any pick, how far this y can travel from it's insertion point is a function of the pack force, position of fell line, and the mobility of the individual float. 
 * 
 *  
 * @param ndx 
 * @param d 
 * @param vtxs 
 * @param cns 
 * @param sim 
 * @returns 
 */
const createVertex = (ndx: CNIndex, fell: number, d: Draft, cns: Array<ContactNeighborhood>, sim: SimulationVars): YarnVertex => {



  let width = warps(d.drawdown);
  let weft_material_id = d.rowShuttleMapping[ndx.i];
  let weft_diameter = sim.ms.getDiameter(weft_material_id);
  let warp_material_id = d.colShuttleMapping[ndx.j];
  let warp_diameter = sim.ms.getDiameter(warp_material_id);

  //this is a function of EPI, warp diameter and weft diameter, but for now, we'll be sloppy
  const interlacement_space = weft_diameter;

  let pack_factor = (1 - sim.pack / 100);

  let mvy = getMvY(ndx, width, cns);
  let max_row_mat_diameter = weft_diameter;

  for (let i = 0; i < mvy; i++) {
    //get each material that this could theoretically slide over or under
    let row_mat_diameter = 0;
    if (ndx.i - i >= 0) row_mat_diameter = d.rowShuttleMapping[ndx.i - i];
    if (row_mat_diameter > max_row_mat_diameter) max_row_mat_diameter = row_mat_diameter;
  }


  //Each ACN has a MY number, which represents how far this weft *can* slide but not neccessarily how it does slide. This calculates how far it can slide based on it's relationships to it's neighbors and their sliding 

  let y_offset = calcYOffset(ndx, width, cns, sim);
  let mobility = (y_offset > 1) ? -1 : -y_offset; //clamp this value to -1

  //if pack_factor is 0 (no packing) this weft should sit at fell-line + diameter/2
  //if pack factor is 1 (max packing) this weft can sit  fell-line - max_y_displacement. Max y displacement is a function of the yarns that are stacking at this specific location. 


  let max_min = {
    max: fell + weft_diameter + interlacement_space,
    min: fell + (max_row_mat_diameter / 2) * mobility + weft_diameter / 2
  };
  let y = interpolate(pack_factor, max_min);


  //let the layer first
  let z = getMvZ(ndx, width, cns) * sim.layer_spacing * -1;
  //then adjust for which side of the warp it is sitting upon. 
  if (getFace(ndx, width, cns)) z -= warp_diameter;
  else z += warp_diameter;




  let x = sim.warp_spacing * ndx.j;
  if (ndx.id == 0) x -= warp_diameter;
  if (ndx.id == 1) x += warp_diameter;


  return { ndx, x, y, z }


}

/**
 * initializes a list of vertexes for every unique system-material combination used in this draft
 * @param d 
 */
const initWeftPaths = (d: Draft): Array<WeftPath> => {

  let weft_paths: Array<WeftPath> = [];

  for (let i = 0; i < wefts(d.drawdown); i++) {
    let system = d.rowSystemMapping[i];
    let material = d.rowShuttleMapping[i];
    let path = weft_paths.find(el => el.system == system && el.material == material)
    if (path == undefined) {
      weft_paths.push({ system, material, vtxs: [], pics: [] });
    }

  }
  return weft_paths;

}


const parseWeftPaths = (d: Draft, paths: Array<WeftPath>): Array<WeftPath> => {

  for (let i = 0; i < wefts(d.drawdown); i++) {
    let material = d.rowShuttleMapping[i];
    let system = d.rowSystemMapping[i];
    let path = paths.find(el => el.material == material && el.system == system);
    if (path == undefined) Promise.reject('no path found for material and system ')
    path.pics.push(i);
  }

  return paths;
}

export const getFlatVtxList = (paths: Array<WeftPath>): Array<YarnVertex> => {
  //collapse the paths into a flat list
  return paths.reduce((acc, el) => {
    acc = acc.concat(el.vtxs);
    return acc;
  }, []);
}

export const getWeftPath = (paths: Array<WeftPath>, system: number, material: number): WeftPath => {
  return paths.find(el => el.material == material && el.system == system);
}




const getYFromWeft = (i: number, j: number, cns: Array<ContactNeighborhood>, paths: Array<WeftPath>) => {

  //first, check if this index exists in the path already
  let active_path = null;
  for (let path of paths) {
    if (path.pics.find(pic => pic == i) !== undefined)
      active_path = path;
  }
  if (active_path !== null) {
    //get all the vertexes associated with this weft. 
    let vtx_list = active_path.vtxs.filter(vtx => vtx.ndx.i == i);
    let closest: any = vtx_list.reduce((acc, el) => {
      let dist = j - el.ndx.j;
      if (dist == 0) {
        acc.dist_left = dist;
        acc.dist_right = dist;
        acc.j_left = el.ndx.j;
        acc.j_right = el.ndx.j;
        acc.y_left = el.y;
        acc.y_right = el.y;

      } else if (dist > 0) {
        if (dist < acc.dist_left) {
          acc.dist_left = dist;
          acc.j_left = el.ndx.j;
          acc.y_left = el.y;
        }
      } else {
        dist = Math.abs(dist);
        if (dist < acc.dist_right) {
          acc.dist_right = dist;
          acc.j_right = el.ndx.j;
          acc.y_right = el.y;

        }
      }

      return acc;
    }, { dist_left: 10000, j_left: -1, y_left: 0, dist_right: 10000, j_right: -1, y_right: 0 });


    return closest.y_left + closest.y_right / 2;

  } else {
    return 0;
  }


}


const getWarpACNS = (j: number, cns: Array<ContactNeighborhood>): Array<ContactNeighborhood> => {
  return cns.filter(el => el.ndx.j == j && el.node_type == 'ACN' && (el.ndx.id == 2 || el.ndx.id == 3));
}

export const renderWarps = (draft: Draft, cns: Array<ContactNeighborhood>, weft_paths: Array<WeftPath>, sim: SimulationVars): Promise<Array<WarpPath>> => {

  let warp_paths: Array<WarpPath> = [];
  let width = warps(draft.drawdown);

  for (let j = 0; j < width; j++) {

    let x = j * sim.warp_spacing;
    let vtxs: Array<YarnVertex> = [];
    let system = draft.colSystemMapping[j];
    let material = draft.colShuttleMapping[j];

    let acns = getWarpACNS(j, cns);

    for (let cn of acns) {
      let z = cn.mv.z * sim.layer_spacing * -1;
      let y = getYFromWeft(cn.ndx.i, j, cns, weft_paths);
      vtxs.push({ x, y, z, ndx: cn.ndx });

    }

    //push the ends:
    if (vtxs.length > 0) {
      vtxs.unshift({ x: vtxs[0].x, y: -2 * sim.ms.getDiameter(material), z: vtxs[0].z, ndx: { i: 0, j, id: 3 } });
      vtxs.push({ x: vtxs[vtxs.length - 1].x, y: wefts(draft.drawdown) * sim.ms.getDiameter(material), z: vtxs[vtxs.length - 1].z, ndx: { i: wefts(draft.drawdown) - 1, j, id: 2 } });
    } else {
      vtxs.push({ x, y: -2 * sim.ms.getDiameter(material), z: 0, ndx: { i: 0, j, id: 3 } });
      vtxs.push({ x, y: wefts(draft.drawdown) * sim.ms.getDiameter(material), z: 0, ndx: { i: wefts(draft.drawdown) - 1, j, id: 2 } });
    }

    warp_paths.push({ system, material, vtxs })




    // for(let i = 0; i < wefts(draft.drawdown); i++){
    //   let type_top = getNodeType({i, j, id: 2}, width, cns);
    //   let type_bottom = getNodeType({i, j, id: 3}, width, cns);
    //   console.log("NODE TYPE AT ", i, j, " is ", type_top, type_bottom, )
    //   if(type_top == 'ACN' || type_top == 'VCN' || type_bottom == 'ACN' || type_bottom == 'VCN'){

    //     let z = getMvZ({i, j, id: 2}, width, cns) * sim.layer_spacing * -1;
    //     let y = getYFromWeft(i, j, cns, weft_paths);
    //     vtxs.push({x, y, z, ndx:{i, j, id:2}});

    //   }
    // }
  }

  return Promise.resolve(warp_paths);



}
/**
 * converts a topology diagram to a list of weft vertexes to draw. It only draws key interlacements to the list
 * @param draft 
 * @param topo 
 * @param layer_map 
 * @param sim 
 * @returns 
 */
export const followTheWefts = (draft: Draft, cns: Array<ContactNeighborhood>, sim: SimulationVars): Promise<Array<WeftPath>> => {
  let warpnum = warps(draft.drawdown);

  //get a list of the unique system-material combinations of this weft. 
  let paths: Array<WeftPath> = initWeftPaths(draft);
  let fell_y = 0;

  //parse row by row, then assign to the specific path to which this belongs
  for (let i = 0; i < wefts(draft.drawdown); i++) {


    let system = draft.rowSystemMapping[i];
    let material = draft.rowShuttleMapping[i];
    let path = getWeftPath(paths, system, material);

    if (path === undefined) Promise.reject("weft path with system and material not found")

    let flat_vtx_list = getFlatVtxList(paths);

    let direction = (path.pics.length % 2 == 0);  //true is left to right, false is 


    let temp_pic: Array<YarnVertex> = [];

    if (direction) {
      //left to right - 

      for (let j = 0; j < warpnum; j++) {

        if (getNodeType({ i, j, id: 0 }, warpnum, cns) == 'ACN') {
          let vtx = createVertex({ i, j, id: 0 }, fell_y, draft, cns, sim);
          temp_pic.push(vtx);
        }

        if (getNodeType({ i, j, id: 1 }, warpnum, cns) == 'ACN') {
          let vtx = createVertex({ i, j, id: 1 }, fell_y, draft, cns, sim);
          temp_pic.push(vtx);
        }
      }

    } else {

      for (let j = warpnum - 1; j >= 0; j--) {
        if (getNodeType({ i, j, id: 1 }, warpnum, cns) == 'ACN') {
          let vtx = createVertex({ i, j, id: 1 }, fell_y, draft, cns, sim);
          temp_pic.push(vtx);
        }

        if (getNodeType({ i, j, id: 0 }, warpnum, cns) == 'ACN') {
          let vtx = createVertex({ i, j, id: 0 }, fell_y, draft, cns, sim);
          temp_pic.push(vtx);
        }
      }
    }

    //IF WE ARE RENDERING FULL WIDTH, add the VCNS and make sure they match the layer of the weft. 
    if (!sim.wefts_as_written) {
      let left: YarnVertex = null;
      let right: YarnVertex = null;
      let last_ndx = temp_pic.length - 1;

      if (temp_pic.length > 0) {


        //set it to the layer for this weft
        let left_ndx = { i, j: 0, id: 0 };
        if (getNodeType(left_ndx, warpnum, cns) !== 'ACN') {
          cns = setMvZ(left_ndx, warpnum, cns, getMvZ(temp_pic[0].ndx, warpnum, cns));
          left = createVertex(left_ndx, fell_y, draft, cns, sim);
        }

        //set it to the layer for this weft
        let right_ndx = { i, j: warpnum - 1, id: 1 };
        if (getNodeType(right_ndx, warpnum, cns) !== 'ACN') {
          cns = setMvZ(right_ndx, warpnum, cns, getMvZ(temp_pic[last_ndx].ndx, warpnum, cns));
          right = createVertex(right_ndx, fell_y, draft, cns, sim);
        }

      }

      if (direction) {
        if (left !== null) temp_pic.unshift(left);
        if (right !== null) temp_pic.push(right);
      } else {
        if (right !== null) temp_pic.unshift(right);
        if (left !== null) temp_pic.push(left);
      }
    }


    path.vtxs = path.vtxs.concat(temp_pic);
    path.pics.push(i);
    fell_y = getFellY(flat_vtx_list.concat(path.vtxs), sim.ms.getDiameter(material));


  }

  return Promise.resolve(paths);
}


export const calcClothHeightOffsetFactor = (diam: number, radius: number, offset: number): number => {
  return diam * (radius - offset) / radius;
}

/** CODE DEVOTED TO MASS-SPRING-CALC */

export const createParticle = (x: number, y: number, z: number, pinned: boolean): Particle => {
  let position = new THREE.Vector3(x, y, z);
  let geometry = new THREE.SphereGeometry(0.1, 16, 16);
  let material = new THREE.MeshBasicMaterial({ color: 0xff0000 })

  let acceleration: THREE.Vector3 = new THREE.Vector3();


  let p = {
    position,
    previousPosition: position.clone(),
    geometry,
    material,
    mesh: new THREE.Mesh(geometry, material),
    acceleration,
    pinned
  }

  p.mesh.position.copy(position)
  return p;
}

export const applyForce = (p: Particle, force: THREE.Vector3): Particle => {
  p.acceleration.add(force);
  return p;
}

export const verlet = (p: Particle, damping: number, timeStep: number): Particle => {
  if (p.pinned) return p;

  const velocity = p.position.clone().sub(p.previousPosition).multiplyScalar(damping)

  const newPos = p.position.clone().add(velocity).add(p.acceleration.clone().multiplyScalar(timeStep ** 2));

  p.previousPosition.copy(p.position);
  p.position.copy(newPos);
  p.acceleration.set(0, 0, 0);

  return p;

}

export const updateParticleMesh = (p: Particle): Particle => {
  p.mesh.position.copy(p.position);
  return p;
}

export const createSpring = (p1: Particle, p2: Particle, restLength: number, color: number, diameter: number
): Spring => {

  let spring = {
    pts: [],
    mesh: null,
    p1, p2, restLength, color, diameter
  }

  spring.pts.push(new THREE.Vector3(p1.position.x, p1.position.y, p1.position.z));

  spring.pts.push(new THREE.Vector3(p2.position.x, p2.position.y, p2.position.z));

  //const curve = new THREE.CatmullRomCurve3(spring.pts, false, 'catmullrom', .1);

  //const geometry = new THREE.TubeGeometry( curve, 2, 1, 8, false );
  const geometry = new THREE.BufferGeometry().setFromPoints(spring.pts);
  const material = new THREE.LineBasicMaterial({ color: 0x00ff00 }); // Green line

  // const material = new THREE.MeshPhysicalMaterial( {
  //       color: color,
  //       depthTest: true,
  //       emissive: 0x000000,
  //       metalness: 0,
  //       roughness: 0.5,
  //       clearcoat: 1.0,
  //       clearcoatRoughness: 1.0,
  //       reflectivity: 0.0
  //   } ); 

  spring.mesh = new THREE.Line(geometry, material)
  //spring.mesh = new THREE.Mesh(geometry, material);

  return spring;


}

export const satisfyConstraint = (s: Spring): Spring => {
  const delta = s.p2.position.clone().sub(s.p1.position);
  const dist = delta.length();
  const diff = (dist - s.restLength) / dist;
  const correction = delta.multiplyScalar(0.5 * diff);

  if (!s.p1.pinned) s.p1.position.add(correction);
  if (!s.p2.pinned) s.p2.position.sub(correction);

  return s;
}

export const updateSpringMesh = (s: Spring): Spring => {
  s.mesh.position.copy(s.p1.position);

  const vertices = s.mesh.geometry.attributes.position.array;
  vertices[0] = s.p1.position.x;
  vertices[1] = s.p1.position.y;
  vertices[2] = s.p1.position.z;

  vertices[3] = s.p2.position.x;
  vertices[4] = s.p2.position.y;
  vertices[5] = s.p2.position.z;

  s.mesh.geometry.attributes.position.needsUpdate = true;

  return s;
}

// DEBUGGING FUNCTIONS

const printLayerMap = (cns: Array<ContactNeighborhood>, wefts: number, warps: number) => {

  const layer_map = [];
  for (let i = 0; i < wefts; i++) {
    let row = [];
    for (let j = 0; j < warps; j++) {
      row.push(getMvZ({ i, j, id: 0 }, warps, cns));
    }
    layer_map.push(row);
  }

  console.log("LAYER MAP ", layer_map)

}


const printYValues = (cns: Array<ContactNeighborhood>, wefts: number, warps: number, mode: boolean) => {


  console.log((mode) ? "SHOWING WEFT TYPES" : "SHOWING WARP TYPES")
  const layer_map = [];
  for (let i = 0; i < wefts; i++) {
    let row = [];
    for (let j = 0; j < warps; j++) {

      if (mode) {
        row.push(getMvY({ i, j, id: 0 }, warps, cns) + "-" + getNodeType({ i, j, id: 0 }, warps, cns) + ", " + getMvY({ i, j, id: 1 }, warps, cns) + "-" + getNodeType({ i, j, id: 1 }, warps, cns));
      } else {
        row.push(getMvY({ i, j, id: 2 }, warps, cns) + "-" + getNodeType({ i, j, id: 2 }, warps, cns) + ", " + getMvY({ i, j, id: 3 }, warps, cns) + "-" + getNodeType({ i, j, id: 3 }, warps, cns));
      }


    }
    layer_map.push(row);
  }

  console.log("Y Values MAP ", layer_map)

}



