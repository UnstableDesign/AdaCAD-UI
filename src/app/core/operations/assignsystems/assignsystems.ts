import { Draft, Operation, OperationInlet, OpInput, OpParamVal, StringParam } from "../../model/datatypes";
import { generateMappingFromPattern, initDraftFromDrawdown, initDraftWithParams, warps, wefts } from "../../model/drafts";
import { getAllDraftsAtInlet, getOpParamValById, parseDraftNames } from "../../model/operations";
import { Sequence } from "../../model/sequence";
import utilInstance from "../../model/util";
import { layer } from "../layer/layer";

const name = "assign systems";
const old_names = [];

//PARAMS

const pattern:StringParam =  
    {name: 'assign to system',
    type: 'string',
    value: 'a1',
    regex: /[\S]/i, //Accepts a letter followed by a number, a single letter or a single number
    error: 'invalid entry',
    dx: 'enter the letter or number associated with the weft/warp system to which this draft will be assigned. For example, "a 1" will assign the draft to the cells associated with warp system 1 and weft system a. The entry "a b" will assign the draft to all warps on both wefts a and b.'
  }



const params = [pattern];

//INLETS
const systems: OperationInlet = {
  name: 'systems draft', 
  type: 'static',
  value: null,
  uses: "warp-and-weft-data",
  dx: 'the draft that describes the system ordering we will add input structures within',
  num_drafts: 1
}

  const draft_inlet: OperationInlet = {
    name: 'draft',
    type: 'static',
    value: null,
    uses: 'draft',
    dx: "the draft that will be assigned to a given system",
    num_drafts: 1
  }


  const inlets = [systems, draft_inlet];


const  perform = (op_params: Array<OpParamVal>, op_inputs: Array<OpInput>) : Promise<Array<Draft>> => {


  const original_string = getOpParamValById(0, op_params);
  const original_string_split = utilInstance.parseRegex(original_string, pattern.regex);

  if(op_inputs.length == 0) return Promise.resolve([]);

  const system_map = getAllDraftsAtInlet(op_inputs, 0);
  if(system_map.length == 0) return Promise.resolve([]); ;

  const draft = getAllDraftsAtInlet(op_inputs, 1);
  if(draft.length == 0) return Promise.resolve([]); ;


  let weft_system_map = new Sequence.OneD(system_map[0].rowSystemMapping);
  let warp_system_map = new Sequence.OneD(system_map[0].colSystemMapping);
  let weft_shuttle_map = new Sequence.OneD(system_map[0].rowShuttleMapping);
  let warp_shuttle_map = new Sequence.OneD(system_map[0].colShuttleMapping);


  let layer_draft_map = original_string_split.reduce((acc, val) => {
    return {
      wesy: acc.wesy.concat(parseWeftSystem(val)), 
      wasy: acc.wasy.concat(parseWarpSystem(val)),
      layer: acc.layer, 
      draft:  acc.draft
    }
  }, {wesy: [], wasy: [], layer: 1, draft: draft[0]});

  if(layer_draft_map.wesy.length == 0){
   layer_draft_map.wesy = utilInstance.filterToUniqueValues(system_map[0].colSystemMapping)
  }
  if(layer_draft_map.wasy.length == 0){
    layer_draft_map.wasy = utilInstance.filterToUniqueValues(system_map[0].rowSystemMapping)
  }


  let ends = warps(draft[0].drawdown) * warps(system_map[0].drawdown);
  let pics = wefts(draft[0].drawdown) * wefts(system_map[0].drawdown);

  const seq = new Sequence.TwoD().import(layer_draft_map.draft.drawdown);
  seq.mapToSystems(layer_draft_map.wesy, layer_draft_map.wasy, weft_system_map, warp_system_map, ends, pics);

  let d: Draft = initDraftFromDrawdown(seq.export());
  
  d.colSystemMapping =  generateMappingFromPattern(d.drawdown, warp_system_map.val(),'col');
  d.rowSystemMapping =  generateMappingFromPattern(d.drawdown, weft_system_map.val(),'row');
  d.colShuttleMapping =  generateMappingFromPattern(d.drawdown, warp_shuttle_map.val(),'col');
  d.rowShuttleMapping =  generateMappingFromPattern(d.drawdown, weft_shuttle_map.val(),'row');

  return Promise.resolve([d]);
};   


const generateName = (param_vals: Array<OpParamVal>, op_inputs: Array<OpInput>) : string => {

    let drafts = getAllDraftsAtInlet(op_inputs, 0);
    let name_list = parseDraftNames(drafts);
  return "assign systems("+name_list+")";
}




//pull out all the nubmers from a notation element into warp systems
const parseWarpSystem = (val: string) : Array<number> => {
  let matches = val.match(/\d+/g);
  if(matches == null || matches.length == 0){
    console.error("in Layer Notation, no warp system")
    return [];
  }
  return  matches.map(el => parseInt(el)-1);

}

//pull out all the letters from a notation element into weft systems
const parseWeftSystem = (val: string) : Array<number> => {
  let matches = val.match(/[a-zA-Z]+/g);
  if(matches == null || matches.length == 0){
    console.error("in Layer Notation, no weft system")
    return [];
  }
  return matches.map(match => match.charCodeAt(0) - 97);

}
  

export const assignsystems: Operation = {name, old_names, params, inlets, perform, generateName};

