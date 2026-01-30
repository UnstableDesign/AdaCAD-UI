import { Injectable } from "@angular/core";
import { DynamicOperation, getOpList, OpCategory, opCategoryList, Operation } from "adacad-drafting-lib";
import { OperationClassification } from "../model/datatypes";

@Injectable({
  providedIn: 'root'
})
export class OperationService {

  ops: Array<Operation | DynamicOperation> = [];
  classification: Array<OperationClassification> = [];

  constructor() {


    const categories: Array<OpCategory> = opCategoryList();
    categories.forEach(cat => {


      const op_list = getOpList(cat.name);

      const formatted_cat: OperationClassification = {
        category_name: cat.name,
        description: cat.desc,
        color: cat.color,
        op_names: op_list.map(el => el.name)
      }

      this.classification.push(formatted_cat);
      this.ops = this.ops.concat(op_list);
    });

  }



  isDynamic(name: string): boolean {
    const op = this.ops.find(el => el.name == name);
    if (!op) return false;

    if ((<DynamicOperation>op).dynamic_param_id !== undefined) {
      return true;
    }
    return false;

  }


  getOp(name: string): Operation | DynamicOperation {
    const op = this.ops.find(el => el.name == name);
    if (op == undefined) return null;
    return op;
  }

  hasOldName(op: Operation | DynamicOperation, name: string): boolean {
    if (!op.meta.old_names) return false;
    return (op.meta.old_names.find(el => el === name) !== undefined);
  }

  getOpByOldName(name: string): Operation | DynamicOperation {
    const old_name = this.ops.filter(el => this.hasOldName(el, name));

    if (old_name.length == 0) {
      return this.getOp('rectangle');
    } else {
      return old_name[0];
    }

  }


  getOpClassifications(): Array<OperationClassification> {

    return this.classification;
  }


  getCatDescription(name: string): string {
    const cat = this.classification.find(el => el.category_name == name);
    if (cat !== undefined) return cat.description;
    else return "";
  }

  getOpCategories(opname: string): Array<OpCategory> {
    const op = this.ops.find(op => op.name == opname);
    if (op == undefined) return [];
    return op.meta.categories;
  }

  getCatName(name: string): string {
    const cat = this.classification.find(el => el.category_name == name);
    if (cat !== undefined) return cat.category_name;
    else return "";
  }

  getCatColor(name: string): string {
    const cat = this.classification.find(el => el.category_name == name);
    if (cat !== undefined) return cat.color;
    else return "#000000";
  }


  getDisplayName(opname: string) {
    const op = this.ops.find(op => op.name == opname);
    if (op == undefined) return [];
    return op.meta.displayname;
  }

  idAdvanced(opname: string) {
    const op = this.ops.find(op => op.name == opname);
    if (op == undefined) return false;
    return op.meta.advanced ?? false;
  }

  getOpDescription(opname: string) {
    const op = this.ops.find(op => op.name == opname);
    if (op == undefined) return [];
    return op.meta.desc;
  }



}
