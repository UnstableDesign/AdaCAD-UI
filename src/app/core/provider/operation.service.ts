import { Injectable } from '@angular/core';
import { imagemap, bwimagemap, notation, weft_profile, warp_profile, sample_width, sample_length, rect, twill, complextwill, undulatingtwill, square_waffle, waffleish, satin, satinish, shaded_satin, tabby_der, random, interlace, deinterlace, interlacewarps, splicein, spliceinwarps, assignsystems, invert, flipx, flipy, shiftx, shifty, layer, selvedge, bindweftfloats, bindwarpfloats, joinleft, jointop, slope, tile, undulatewefts, undulatewarps, chaos, stretch, resize, margin, set, unset, rotate, makesymmetric, fill, overlay, atop, mask, diff, cutout, shift, flip, overlay_multi, analyzesystem, crop, trim, makeloom, makedirectloom, drawdown, directdrawdown, erase_blank, apply_mats, apply_warp_mats, apply_weft_mats, combinatorics, sinewave, sawtooth, glitchsatin, selector } from 'adacad-drafting-lib/ops';
import { DynamicOperation, Operation, OperationClassification } from 'adacad-drafting-lib/objects';
import { clear } from 'console';

@Injectable({
  providedIn: 'root'
})
export class OperationService {

  ops: Array<Operation> = [];
  dynamic_ops: Array<DynamicOperation> = [];
  classification: Array<OperationClassification> = [];

  constructor() { 
     

  

    // this.dynamic_ops.push(dynamic_join_left);
    // this.dynamic_ops.push(dynamic_join_top);
    this.dynamic_ops.push(imagemap);
    this.dynamic_ops.push(bwimagemap);
    this.dynamic_ops.push(notation);
    this.dynamic_ops.push(weft_profile);
    this.dynamic_ops.push(warp_profile);
    this.dynamic_ops.push(sample_width);
    this.dynamic_ops.push(sample_length);


    //**push operations that you want the UI to show as options here */
    this.ops.push(rect);
    this.ops.push(twill);
    this.ops.push(complextwill);
    this.ops.push(undulatingtwill);
    this.ops.push(square_waffle);
    this.ops.push(waffleish);
    this.ops.push(satin);
    this.ops.push(satinish);
    this.ops.push(shaded_satin);
    // this.ops.push(tabby);
    this.ops.push(tabby_der);
    // this.ops.push(rib);
    this.ops.push(random);
    this.ops.push(interlace);
    this.ops.push(deinterlace);
    this.ops.push(interlacewarps);
    this.ops.push(splicein);
    this.ops.push(spliceinwarps);
    this.ops.push(assignsystems);
    this.ops.push(invert);
  //  this.ops.push(replicate);
    this.ops.push(flipx);
    this.ops.push(flipy);
    this.ops.push(shiftx);
    this.ops.push(shifty);
    this.ops.push(layer);
    this.ops.push(selvedge);
    this.ops.push(bindweftfloats);
    this.ops.push(bindwarpfloats);
    this.ops.push(joinleft);
    this.ops.push(jointop);
    this.ops.push(slope);
    this.ops.push(tile);
    this.ops.push(undulatewefts);
    this.ops.push(undulatewarps);
    this.ops.push(chaos);
    this.ops.push(stretch);
    this.ops.push(resize);
    this.ops.push(margin);
    // this.ops.push(clear);
    this.ops.push(set);
    this.ops.push(unset);
    this.ops.push(rotate);
    this.ops.push(makesymmetric);
    this.ops.push(fill);
    this.ops.push(overlay);
    this.ops.push(atop);
    this.ops.push(mask);
    this.ops.push(diff);
    this.ops.push(cutout);
    this.ops.push(shift);
    this.ops.push(flip);
    this.ops.push(overlay_multi);
    this.ops.push(analyzesystem);

  //   //this.ops.push(germanify);
  //   //this.ops.push(crackleify);
  //   //this.ops.push(variants);
     this.ops.push(crop);
    this.ops.push(trim);
    this.ops.push(makeloom);
    this.ops.push(makedirectloom);
    this.ops.push(drawdown);
    this.ops.push(directdrawdown);
    this.ops.push(erase_blank);
    this.ops.push(apply_mats);
    this.ops.push(apply_warp_mats)
    this.ops.push(apply_weft_mats)
    this.ops.push(combinatorics);
    this.ops.push(sinewave);
    this.ops.push(sawtooth);
    this.ops.push(glitchsatin)
    this.ops.push(selector)
    }


   
  isDynamic(name: string) : boolean{
    const parent_ndx: number = this.dynamic_ops.findIndex(el => el.name === name);
    if(parent_ndx == -1) return false;
    return true;
  }


  getOp(name: string): Operation | DynamicOperation{
    const op_ndx: number = this.ops.findIndex(el => el.name === name);
    const parent_ndx: number = this.dynamic_ops.findIndex(el => el.name === name);
    if(op_ndx !== -1) return this.ops[op_ndx];
    if(parent_ndx !== -1) return this.dynamic_ops[parent_ndx];
    return null;
  }

  hasOldName(op: Operation | DynamicOperation, name: string) : boolean {
    return (op.old_names.find(el => el === name) !== undefined );
  }

  getOpByOldName(name: string): Operation | DynamicOperation{
    const allops = this.ops.concat(this.dynamic_ops);
    const old_name = allops.filter(el => this.hasOldName(el, name));

    if(old_name.length == 0){
      return this.getOp('rectangle');
    }else{
      return old_name[0]; 
    }

  }
}
