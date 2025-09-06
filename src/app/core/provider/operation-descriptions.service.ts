import { Injectable } from '@angular/core';
import descriptions from '../../../assets/json/op_descriptions.json';
import classifications from '../../../assets/json/op_classifications.json';
import { OperationClassification } from 'adacad-drafting-lib';

@Injectable({
  providedIn: 'root'
})
export class OperationDescriptionsService {

  constructor() { 



  }

  getOpClassifications() : Array<OperationClassification>{

    



   return classifications.classifications;
  }


  getCatDescription(name: string) : string{
    const cat =  classifications.classifications.find(el => el.category_name == name);
    if(cat !== undefined) return cat.description;
    else return "";
   }

   getOpCategory(opname: string) : string {
    const cat = classifications.classifications.find(classification => {
      return (classification.op_names.find(sel => sel == opname) !== undefined);
    })

    if(cat == undefined) return '';

    return cat.category_name;

   }

   getCatName(name: string) : string{
    const cat =  classifications.classifications.find(el => el.category_name == name);
    if(cat !== undefined) return cat.category_name;
    else return "";
   }

   getCatColor(name: string) : string{
    const cat =  classifications.classifications.find(el => el.category_name == name);
    if(cat !== undefined) return cat.color;
    else return "#000";   }


  getOpDescription(opname: string): string{
    const item = descriptions.operation.find(el => el.name == opname);
    if(item !== undefined){
      return item.description;
    }else{
      return "";
    }
  }

  /**
   * returns the list of all the tags associated with this operation
   * @param opname 
   * @returns array of tags as strings
   */
  getOpTags(opname: string): Array<string>{
    const item = descriptions.operation.find(el => el.name == opname);
    if(item !== undefined){
      return item.tags;
    }else{
      return [];
    }
  }

    /**
   * checks for the existance of a specific tag within the tag list
   * @param opname 
   * @returns array of tags as strings
   */
    hasOpTag(opname: string, tagname: string): boolean{
      const item = descriptions.operation.find(el => el.name == opname);
      if(item !== undefined){

        let tag = item.tags.find(el => el == tagname)
        if(tag !== undefined) return true;

      }
      return false;
    }


  hasDisplayName(opname: string) : boolean{
    const item = descriptions.operation.find(el => el.name == opname);
    if(item !== undefined){
      return true;
    }else{
      return false;
    }
  }

  getDisplayName(opname: string){
    const item = descriptions.operation.find(el => el.name == opname);
    if(item !== undefined){
      return item.displayname;
    }else{
      return opname;
    }
  }

  getOpYoutube(opname: string){
    const item = descriptions.operation.find(el => el.name == opname);
    if(item !== undefined && item.youtube !== undefined){
      return item.youtube;
    }else{
      return "";
    }
  }

  getOpApplication(opname: string){
    const item = descriptions.operation.find(el => el.name == opname);
    if(item !== undefined){
      return item.application;
    }else{
      return "";
    }
  }

  getYoutube(opname: string){
    const item = descriptions.operation.find(el => el.name == opname);
    if(item !== undefined){
      return item.youtube;
    }else{
      return "";
    }
  }

  getParamDescription(paramname: string){
    const item = descriptions.param.find(el => el.name == paramname);
    if(item !== undefined){
      return item.description;
    }
  }



  getDyanmicText(): string{
    return descriptions.dynamic_description;
  }




}
