import { Draft, LoomSettings, NumParam, Operation, OperationInlet, OpInput, OpParamVal } from "../../model/datatypes";
import { getDraftName, initDraftWithParams, setHeddle, updateWarpSystemsAndShuttles, updateWeftSystemsAndShuttles, warps, wefts } from "../../model/drafts";
import { getLoomUtilByType, numFrames, numTreadles } from "../../model/looms";
import { getAllDraftsAtInlet, getInputDraft, getOpParamValById, parseDraftNames } from "../../model/operations";


const name = "direct loom";
const old_names = [];

//PARAMS

const frames:NumParam =  
{name: 'frames',
min: 2,
max: 10000,
value: 8,
type: 'number',
dx: 'number of frames to use. If the drawdown requires more, it will generate more'
}


const params = [frames];

//INLETS

const drawdown: OperationInlet = {
    name: 'drawdown', 
    type: 'static',
    value: null,
    uses: "draft",
    dx: 'the drawdown from which to create threading and lift plan from',
    num_drafts: 1
  }


  const inlets = [drawdown];


const  perform = (op_params: Array<OpParamVal>, op_inputs: Array<OpInput>) => {

  let draft = getInputDraft(op_inputs);
  let frames = getOpParamValById(0, op_params);

  
  if(draft == null) return Promise.resolve([]);


  const loom_settings:LoomSettings = {
    type: 'direct',
    epi: 10, 
    units: 'in',
    frames: frames,
    treadles: frames
  }

  const utils = getLoomUtilByType(loom_settings.type);
  return utils.computeLoomFromDrawdown(draft.drawdown, null, loom_settings)
  .then(l => {

    const frames = Math.max(numFrames(l), loom_settings.frames);
    const treadles = Math.max(numTreadles(l), loom_settings.treadles);
 
    let threading: Draft =initDraftWithParams({warps:warps(draft.drawdown), wefts: frames});
  l.threading.forEach((frame, j) =>{
    if(frame !== -1) setHeddle(threading.drawdown,frame, j, true);
  });

  threading = updateWarpSystemsAndShuttles(threading, draft)


  let treadling: Draft =initDraftWithParams({warps:treadles, wefts:wefts(draft.drawdown)});   
  l.treadling.forEach((treadle_row, i) =>{
    treadle_row.forEach(treadle_num => {
      setHeddle(treadling.drawdown, i, treadle_num, true);
    })
  });

  treadling = updateWeftSystemsAndShuttles(treadling, draft)

  return Promise.resolve([threading, treadling]);

  });
   
}   

const generateName = (param_vals: Array<OpParamVal>, op_inputs: Array<OpInput>, ndx: number) : string => {

  let drafts = getAllDraftsAtInlet(op_inputs, 0);

  switch (ndx ){
    case 0: 
    return   "threading_"+parseDraftNames(drafts);

    case 1: 
    return   "lift plan_"+parseDraftNames(drafts);

  }

  return 'makedirectloom('+parseDraftNames(drafts)+")";
}


export const makedirectloom: Operation = {name, old_names, params, inlets, perform, generateName};