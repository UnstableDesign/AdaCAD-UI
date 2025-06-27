import {
  NumParam,
  StringParam,
  OpParamVal,
  OpInput,
  Operation,
} from "../../model/datatypes";
import { getOpParamValById } from "../../model/operations";
import { Sequence } from "../../model/sequence";
import { initDraftFromDrawdown } from "../../model/drafts";
import { evaluate } from "mathjs";

const name = "bitfield";
const old_names = [];

//PARAMS
const warps: NumParam = {
  name: "num warps",
  type: "number",
  min: 1,
  max: 128,
  value: 32,
  dx: "Number of warps",
};

const wefts: NumParam = {
  name: "num warps",
  type: "number",
  min: 1,
  max: 128,
  value: 32,
  dx: "Number of wefts",
};

const f: StringParam = {
  name: "bitfield function",
  type: "string",
  regex: /.*/,
  error: "Invalid expression",
  value: "(x ^ y) % 3",
  dx: "Maths expression that uses x/y values to return a boolean value for each cell, to make 'bitfield' patterns",
};

const params = [warps, wefts, f];

const inlets = [];

const perform = (param_vals: Array<OpParamVal>, op_inputs: Array<OpInput>) => {
  const num_warps: number = getOpParamValById(0, param_vals);
  const num_wefts: number = getOpParamValById(1, param_vals);
  let script: string = getOpParamValById(2, param_vals);

  // Mathjs uses ^ for pow, and ^| for bitwise xor
  // This replaces ^ with ^|, so folks don't have to type the |
  script = script.replace(/\^(?!\|)/, "^|");

  // Evaluate as an expression with mathjs. This could just be done with a javascript eval(), but this is more secure.
  let func = evaluate("f(x, y) = ".concat(script));

  let pattern = new Sequence.TwoD();
  for (let weft = 0; weft < num_wefts; ++weft) {
    const row = new Sequence.OneD();
    for (let warp = 0; warp < num_warps; ++warp) {
      row.push(!!func(warp, weft));
    }
    pattern.pushWeftSequence(row.val());
  }
  return Promise.resolve([initDraftFromDrawdown(pattern.export())]);
};

const generateName = (
  param_vals: Array<OpParamVal>,
  op_inputs: Array<OpInput>
): string => {
  const num_up: number = getOpParamValById(0, param_vals);
  return num_up + "/bitfield";
};

export const bitfield: Operation = {
  name,
  old_names,
  params,
  inlets,
  perform,
  generateName,
};
