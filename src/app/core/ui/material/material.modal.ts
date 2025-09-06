import { Component, EventEmitter, Output, inject } from '@angular/core';
import { TreeService } from '../../provider/tree.service';
import { DraftNode } from '../../model/datatypes';
import { DesignmodesService } from '../../provider/designmodes.service';
import { MaterialMap, MaterialsService } from '../../provider/materials.service';
import { MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription } from '@angular/material/expansion';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatMenuTrigger, MatMenu } from '@angular/material/menu';
import { Material } from 'adacad-drafting-lib/objects/datatypes.ts';
import { createMaterial, setMaterialID } from 'adacad-drafting-lib/objects';
import { hexToRgb, updateMaterialIds } from 'adacad-drafting-lib/utils';


@Component({
    selector: 'app-material-modal',
    templateUrl: './material.modal.html',
    styleUrls: ['./material.modal.scss'],
    imports: [MatDialogTitle, CdkScrollable, MatDialogContent, MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatFormField, MatLabel, MatInput, FormsModule, MatSuffix, MatButton, MatMenuTrigger, MatMenu, MatDialogActions, MatDialogClose]
})



export class MaterialModal{
  private dm = inject(DesignmodesService);
  ms = inject(MaterialsService);
  private tree = inject(TreeService);


  @Output() onMaterialChange: any = new EventEmitter();

  replacements: Array<number> = [];
  types: any;
  newshuttle: Material = createMaterial({});
  addmaterial: boolean = false;

  constructor() {
      const ms = this.ms;


      ms.getShuttles().forEach((el, ndx) => {
        this.replacements.push((ndx+1%this.ms.getShuttles().length));
      });

  }



  ngOnInit() {
  }


  diameterChange(){

  }
  

  materialColorChange(id: number, e: any){
    const material = this.ms.getShuttle(id);
    material.rgb = hexToRgb(e);
  }

  addMaterial(){

  }




  /**
   * handles user input of delete event and reads the "replace" value to reassign draft
   * @param index  - the shuttle to delete
   */
  delete(index:number, replacement_id: number){

    if(this.ms.getShuttles().length == 1) return;

    if(confirm("Are you sure you want to delete this material")) {
    this.replacements[index] = replacement_id;


    const map: Array<MaterialMap> = this.ms.deleteShuttle(index);
    const dn: Array<DraftNode> = this.tree.getDraftNodes();
    
    
    dn.forEach(dn =>{
      dn.draft.rowShuttleMapping = updateMaterialIds( dn.draft.rowShuttleMapping, map, this.replacements[index]);
      dn.draft.colShuttleMapping = updateMaterialIds( dn.draft.colShuttleMapping, map, this.replacements[index]);

    });

    //remove this from replacements
    this.replacements = this.replacements.filter((el, ndx) => ndx != index);
    //map remaning replacement values to valid indices 
    this.replacements = this.replacements.map(el => (el%this.ms.getShuttles().length));

    this.onMaterialChange.emit();
    }
  }

  addNewShuttle(){
    console.log(this.newshuttle);
    setMaterialID(this.newshuttle,this.ms.getShuttles().length);
    this.newshuttle.rgb = hexToRgb(this.newshuttle.color.trim());
    this.ms.addShuttle(this.newshuttle);
    this.newshuttle = createMaterial({});
  }

  save() {
    this.onMaterialChange.emit();

  }

    ngOnDestroy(){
      this.save();
    }
    

}
