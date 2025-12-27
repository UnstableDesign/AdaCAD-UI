import { NumParam, Operation, OperationInlet, OpInput, OpParamVal } from "../../model/datatypes";
import { initDraftFromDrawdown, updateWarpSystemsAndShuttles, updateWeftSystemsAndShuttles, warps, wefts } from "../../model/drafts";
import { getAllDraftsAtInlet, getInputDraft, getOpParamValById, parseDraftNames } from "../../model/operations";
import { Sequence } from "../../model/sequence";


const name = "tile";
const old_names = [];

//PARAMS
const warp_repeats: NumParam =
{
  name: 'warp-repeats',
  type: 'number',
  min: 1,
  max: 100,
  value: 2,
  dx: 'the number of times to repeat this tile across the width'
};

const weft_repeats: NumParam = {
  name: 'weft-repeats',
  type: 'number',
  min: 1,
  max: 100,
  value: 2,
  dx: 'the number of times to repeat this tile across the length'
}

const ends_between: NumParam = {
  name: 'ends between',
  type: 'number',
  min: 0,
  max: 10000,
  value: 0,
  dx: 'Number of ends between tiles'
}

const pics_between: NumParam = {
  name: 'pics between',
  type: 'number',
  min: 0,
  max: 10000,
  value: 0,
  dx: 'Number of pics between tiles'
}

const params = [warp_repeats, weft_repeats, ends_between, pics_between];

//INLETS
const draft_inlet: OperationInlet = {
  name: 'draft',
  type: 'static',
  value: null,
  uses: "draft",
  dx: 'the draft to tile',
  num_drafts: 1
}

const inlets = [draft_inlet];


const perform = (op_params: Array<OpParamVal>, op_inputs: Array<OpInput>) => {

  let input_draft = getInputDraft(op_inputs);
  if (input_draft == null) return Promise.resolve([]);

  let warp_rep = getOpParamValById(0, op_params);
  let weft_rep = getOpParamValById(1, op_params);
  let ends_between = getOpParamValById(2, op_params);
  let pics_between = getOpParamValById(3, op_params);

  const w = (warp_rep * warps(input_draft.drawdown)) + ((warp_rep - 1) * ends_between);

  let pattern = new Sequence.TwoD;

  for (let i = 0; i < weft_rep; i++) {
    for (let y = 0; y < wefts(input_draft.drawdown); y++) {
      let s = new Sequence.OneD;
      for (let x = 0; x < warp_rep; x++) {
        s.pushRow(input_draft.drawdown[y]);
        if (x < warp_rep - 1) {
          s.pushMultiple(2, ends_between);
        }
      }
      pattern.pushWeftSequence(s.val());
    }
    if (i < weft_rep - 1) {
      for (let p = 0; p < pics_between; p++) {
        let s = new Sequence.OneD;
        s.pushMultiple(2, w);
        pattern.pushWeftSequence(s.val());
      }
    }
  }

  let d = initDraftFromDrawdown(pattern.export());
  // TODO: Ask how to properly update warp systems and materials
  d = updateWeftSystemsAndShuttles(d, input_draft);
  d = updateWarpSystemsAndShuttles(d, input_draft);

  return Promise.resolve([d]);
}

const generateName = (param_vals: Array<OpParamVal>, op_inputs: Array<OpInput>): string => {

  let drafts = getAllDraftsAtInlet(op_inputs, 0);
  return 'tile(' + parseDraftNames(drafts) + ")";
}


export const tile: Operation = { name, old_names, params, inlets, perform, generateName };