import { Operation, OperationInlet, OpInput, OpParamVal } from "../../model/datatypes";
import { getCol, initDraftFromDrawdown, updateWarpSystemsAndShuttles, updateWeftSystemsAndShuttles, warps } from "../../model/drafts";
import { getAllDraftsAtInlet, getInputDraft, parseDraftNames } from "../../model/operations";
import { Sequence } from "../../model/sequence";
import utilInstance from "../../model/util";


const name = "erase blank rows";
const old_names = [];

//PARAMS

const params = [];

//INLETS
const draft_inlet: OperationInlet = {
    name: 'draft', 
      type: 'static',
      value: null,
      uses: "draft",
      dx: 'the draft to erase blank rows from',
      num_drafts: 1
  }

  const inlets = [draft_inlet];


const  perform = (op_params: Array<OpParamVal>, op_inputs: Array<OpInput>) => {

  let input_draft = getInputDraft(op_inputs);
   
  if(input_draft == null) return Promise.resolve([]);

  let pattern = new Sequence.TwoD();
   let weft_sys = new Sequence.OneD();
   let weft_mats = new Sequence.OneD();


 input_draft.drawdown.forEach((row, i) => {
    let seq = new Sequence.OneD().import(row);
    if(!utilInstance.hasOnlyUnsetOrDown(row)){
        pattern.pushWeftSequence(seq.val());
        weft_sys.push(input_draft.rowSystemMapping[i])
        weft_mats.push(input_draft.rowShuttleMapping[i])
    } 

 })


 



  let d = initDraftFromDrawdown(pattern.export());

  d.rowShuttleMapping = weft_mats.val();
  d.rowSystemMapping = weft_sys.val();
  d = updateWarpSystemsAndShuttles(d, input_draft);

  return Promise.resolve([d]);
}   

const generateName = (param_vals: Array<OpParamVal>, op_inputs: Array<OpInput>) : string => {

  let drafts = getAllDraftsAtInlet(op_inputs, 0);
  return 'eraseblank('+parseDraftNames(drafts)+")";
}


export const erase_blank: Operation = {name, old_names, params, inlets, perform, generateName};