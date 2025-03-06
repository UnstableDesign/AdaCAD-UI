import { createCell } from "../../model/cell";
import { AnalyzedImage, Cell, Draft, DynamicOperation, FileParam, NumParam, OperationInlet, OpInput, OpParamVal } from "../../model/datatypes";
import { getHeddle, initDraftFromDrawdown, initDraftWithParams, warps, wefts } from "../../model/drafts";
import { getOpParamValById } from "../../model/operations";
import utilInstance from "../../model/util";




const name = "imagemap";
const old_names = [];
const dynamic_param_id = [0];
const dynamic_param_type = 'color';

//PARAMS
//the value on this param needs to hold all the image data
const file:FileParam =  {
    name: 'image file (.jpg or .png)',
    type: 'file',
    value: {id: '', data: null},
    dx: 'the file to upload',
}

const width:NumParam = { 
   name: 'draft width',     
   type: 'number',
   min: 1,
   max: 10000,
   value: 30,
   dx: 'resize the input image to the width specified'
}

const height:NumParam = {   
    name: 'draft height',   
    type: 'number',
    min: 1,
    max: 10000,
    value: 20,
    dx: 'resize the input image to the height specified'
 }
 



const params = [file, width, height];

//INLETS

  const inlets = [];


const  perform = (op_params: Array<OpParamVal>, op_inputs: Array<OpInput>) => {

    const file_param = getOpParamValById(0, op_params);   
    const res_w = getOpParamValById(1, op_params);
    const res_h = getOpParamValById(2, op_params);

    if(file_param.id == '' || file_param.data == null){
        const d = initDraftWithParams({wefts: res_w, warps: res_h, drawdown: [[createCell(false)]]})
        return Promise.resolve([d]);
    } 
    

    const data:AnalyzedImage = file_param.data;

    console.log("DATA ", data)

    //coorelates the inlet with an associated draft
    const color_to_drafts = data.colors.map((color, ndx) => {
        const child_of_color = op_inputs.find(input => (input.params.findIndex(param => param === color.hex) !== -1));

        if(child_of_color === undefined) return {color: color.hex, draft: null};
        else return {color: color.hex, draft: child_of_color.drafts[0]};
      });


    const pattern: Array<Array<Cell>> = [];
      for(let i = 0; i < res_h; i++){
        pattern.push([]);
        for(let j = 0; j < res_w; j++){

          const i_ratio = data.height / res_h;
          const j_ratio = data.width / res_w;

          const map_i = Math.floor(i * i_ratio);
          const map_j = Math.floor(j * j_ratio);



          const color_ndx = data.image_map[map_i][map_j]; //this is an id
          const mapped_color = data.colors_mapping.find(el => el.from == color_ndx); //this is the mapped id
          const mapped_color_hex = data.colors[mapped_color.to].hex
          const color_draft = color_to_drafts.find(el => el.color == mapped_color_hex).draft;

          // if(i == 0){
          //   console.log("COLOR, MAP, DRAFT", color_ndx, mapped_color, color_to_drafts[mapped_color.to], color_draft)
          // }

          if(color_draft === null) pattern[i].push( createCell(false));
          else {
            const draft_i = i % wefts(color_draft.drawdown);
            const draft_j = j % warps(color_draft.drawdown);
            pattern[i].push(createCell(getHeddle(color_draft.drawdown,draft_i,draft_j)));
          }

        }
      }

    const draft: Draft = initDraftFromDrawdown(pattern);
    return  Promise.resolve([draft]);

  }   

const generateName = (param_vals: Array<OpParamVal>, op_inputs: Array<OpInput>) : string => {
// const image_data = getImageData(getOpParamValById(0, param_vals));
  const file_param = getOpParamValById(0, param_vals);   
  if(file_param.id == '' || file_param.data == null){
      return 'image';
  }else{
    return file_param.data.name;
  } 

}


const onParamChange = (param_vals: Array<OpParamVal>, inlets: Array<OperationInlet>, inlet_vals: Array<any>, changed_param_id: number, param_val: any) : Array<any> => {


    //a new file was uploaded
    if(changed_param_id == 0){
        const id_and_data = param_val;
        if(id_and_data.id !== ''){
            inlets  = [];
            let color_space = id_and_data.data.colors;
            let unique_colors = utilInstance.filterToUniqueValues(id_and_data.data.colors_mapping.map(el => el.to))
            //compute the distance between each pair of colors, keep the N closest values

               unique_colors.forEach(id => { 
                    inlets.push(color_space[id].hex);
            });
        }   
    }

    return inlets;


}
  

export const imagemap: DynamicOperation = {name, old_names, params, inlets, dynamic_param_id, dynamic_param_type, perform, generateName,onParamChange};