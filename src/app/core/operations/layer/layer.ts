import { Draft, Operation, OperationInlet, OpInput, OpParamVal } from "../../model/datatypes";
import { generateMappingFromPattern, initDraftFromDrawdown, warps, wefts } from "../../model/drafts";
import { getAllDraftsAtInlet, parseDraftNames } from "../../model/operations";
import { Sequence } from "../../model/sequence";
import utilInstance from "../../model/util";

const name = "layer";
const old_names = [];

//PARAMS

const params = [];

//INLETS
const draft_inlet: OperationInlet = {
    name: 'drafts', 
    type: 'static',
    value: null,
    uses: "draft",
    dx: 'the drafts to layer (from top to bottom)',
    num_drafts: -1
  }


  const inlets = [draft_inlet];


const  perform = (op_params: Array<OpParamVal>, op_inputs: Array<OpInput>) : Promise<Array<Draft>> => {


  let drafts = getAllDraftsAtInlet(op_inputs, 0);

  if(drafts.length == 0) return Promise.resolve([]);


    //create a default system mapping that assumes alternating weft and warp systems associated with each layer
   let sys_seq = new Sequence.OneD();
   for(let i = 0; i < drafts.length; i++){
    sys_seq.push(i);
   }

   let composite = new Sequence.TwoD().setBlank(2
    );
   let ends = utilInstance.lcm(drafts.map(el => warps(el.drawdown))) * drafts.length;
   let pics = utilInstance.lcm(drafts.map(el => warps(el.drawdown))) * drafts.length;


  

   let warp_sys_above = [];
   let weft_sys_above = [];
   drafts.forEach((draft, ndx) => {
    let seq = new Sequence.TwoD().import(draft.drawdown);
    seq.mapToSystems([ndx], [ndx], sys_seq, sys_seq, ends, pics);
    composite.overlay(seq, false);
    composite.placeInLayerStack([ndx],warp_sys_above, [ndx],weft_sys_above,sys_seq, sys_seq );
    warp_sys_above.push(ndx);
    weft_sys_above.push(ndx);
   })


    let d: Draft = initDraftFromDrawdown(composite.export());
    d.colSystemMapping =  generateMappingFromPattern(d.drawdown, sys_seq.val(),'col');
    d.rowSystemMapping =  generateMappingFromPattern(d.drawdown, sys_seq.val(),'row');

    let warp_mats = [];
    for(let j = 0; j < ends; j++){
      let select_draft = j%drafts.length;
      let within_draft_id = Math.floor(j/drafts.length);
      let mat_mapping = drafts[select_draft].colShuttleMapping;
      let mat_id =mat_mapping[within_draft_id%mat_mapping.length]
      warp_mats.push(mat_id)
    }

    let weft_mats = [];
    for(let i = 0; i < pics; i++){
      let select_draft = i%drafts.length;
      let within_draft_id = Math.floor(i/drafts.length);
      let mat_mapping = drafts[select_draft].rowShuttleMapping;
      let mat_id =mat_mapping[within_draft_id%mat_mapping.length]
      weft_mats.push(mat_id)
    }
  
  d.rowShuttleMapping =  generateMappingFromPattern(d.drawdown,weft_mats,'row');
  d.colShuttleMapping =  generateMappingFromPattern(d.drawdown,warp_mats,'col');
  return Promise.resolve([d]);
};   


const generateName = (param_vals: Array<OpParamVal>, op_inputs: Array<OpInput>) : string => {

    let drafts = getAllDraftsAtInlet(op_inputs, 0);
    let name_list = parseDraftNames(drafts);
  return "layer("+name_list+")";
}


export const layer: Operation = {name, old_names, params, inlets, perform, generateName};