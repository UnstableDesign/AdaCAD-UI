import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatAccordion, MatExpansionPanel, MatExpansionPanelDescription, MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuTrigger } from '@angular/material/menu';
import { hexToRgb, interpolate, Material, updateMaterialIds } from 'adacad-drafting-lib';
import { createMaterial, MaterialMap, setMaterialID } from 'adacad-drafting-lib/material';
import { DraftNode, MaterialsStateChange } from '../../model/datatypes';
import { defaults } from '../../model/defaults';
import { MaterialsService } from '../../provider/materials.service';
import { StateService } from '../../provider/state.service';
import { TreeService } from '../../provider/tree.service';
import { ViewerService } from '../../provider/viewer.service';

@Component({
  selector: 'app-material',
  templateUrl: './material.html',
  styleUrls: ['./material.scss'],
  imports: [MatAccordion, MatIconButton, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatFormField, MatLabel, MatInput, ReactiveFormsModule, MatSuffix, MatButton, MatMenuTrigger, MatMenu]
})



export class MaterialComponent {
  ms = inject(MaterialsService);
  private tree = inject(TreeService);
  private fb = inject(FormBuilder);
  private state = inject(StateService);
  private vs = inject(ViewerService);
  private cdr = inject(ChangeDetectorRef);
  types: any;
  newshuttle: Material = createMaterial({});
  addmaterial: boolean = false;

  // Reactive forms
  materialsForm: FormGroup;
  newMaterialForm: FormGroup;
  allmaterials: Array<Material> = [];

  constructor() {



  }

  ngOnInit() {

    this.initializeForms();


  }

  onLoad() {

    //for update before state
    this.allmaterials = [];


    // this.ms.getShuttles().forEach((el, ndx) => {
    //   this.allmaterials.push((<Material>{
    //     id: el.id,
    //     name: el.name,
    //     color: el.color,
    //     rgb: el.rgb,
    //     diameter: el.diameter,
    //     notes: el.notes
    //   }));
    // });


    this.updateMaterialsForm();
    //  this.syncFormToMaterials();
  }



  private initializeForms() {
    // Initialize new material form
    this.newMaterialForm = this.fb.group({
      name: [''],
      color: ['#000000'],
      diameter: [defaults.default_material_diameter],
      notes: ['']
    });

    // Initialize materials form (will be populated in ngOnInit)
    this.materialsForm = this.fb.group({
      materials: this.fb.array([])
    });



  }

  private updateMaterialsForm() {

    //need to clear the array here. 
    const materialsArray = this.materialsForm.get('materials') as FormArray;
    materialsArray.clear({ emitEvent: false });

    let max_material_diameter = this.ms.getMaxDiameter();

    this.ms.getShuttles().forEach((material, index) => {
      materialsArray.push(this.fb.group({
        uid: [Math.random().toString(36).substring(2, 15)],
        id: [material.id],
        name: [material.name],
        color: [material.color],
        diameter: [material.diameter],
        icon_size: [interpolate(material.diameter / max_material_diameter, { min: defaults.min_material_icon_size, max: defaults.max_material_icon_size })],
        notes: [material.notes || '']
      }), { emitEvent: false });
    });
  }


  get materialsFormArray(): FormArray {
    return this.materialsForm.get('materials') as FormArray;
  }

  updateIconSizes() {
    const materialsArray = this.materialsForm.get('materials') as FormArray;
    const max_diameter = this.ms.getMaxDiameter();
    materialsArray.controls.forEach((control, index) => {
      const material = this.ms.getShuttle(control.get('id')?.value);
      control.get('icon_size')?.setValue(interpolate(material.diameter / max_diameter, { min: defaults.min_material_icon_size, max: defaults.max_material_icon_size }), { emitEvent: false });
    });
  }



  onNameChange(id: number, name: string) {

    const material = this.ms.getShuttle(id);
    material.name = name;
    this.ms.setMaterial(id, material);
  }



  diameterChange(id: number, diameter: number) {
    const material = this.ms.getShuttle(id);
    material.diameter = diameter;
    this.save();
    this.ms.setMaterial(id, material);
    this.updateIconSizes();
    // this.vs.updateViewer();
  }

  notesChange(id: number, notes: string) {
    const material = this.ms.getShuttle(id);
    material.notes = notes;
    this.ms.setMaterial(id, material);
  }



  /**
   * called only when the material color is actively changing
   * @param id 
   * @param e 
   */
  materialColorChange(id: number, e: any) {
    console.log("materialColorChange", id, e);
    const material = this.ms.getShuttle(id);
    material.color = e;
    material.rgb = hexToRgb(e);

    this.save();
    this.ms.setMaterial(id, material);
    //this.vs.updateViewer();
  }






  /**
   * handles user input of delete event and reads the "replace" value to reassign draft
   * @param index  - the shuttle to delete
   */
  delete(index: number) {

    if (this.ms.getShuttles().length == 1) return;

    if (confirm("Are you sure you want to delete this material")) {


      const map: Array<MaterialMap> = this.ms.deleteShuttle(index);
      const dn: Array<DraftNode> = this.tree.getDraftNodes();


      dn.forEach(dn => {
        dn.draft.rowShuttleMapping = updateMaterialIds(dn.draft.rowShuttleMapping, map, 0);
        dn.draft.colShuttleMapping = updateMaterialIds(dn.draft.colShuttleMapping, map, 0);

      });


      this.updateMaterialsForm();
      this.save();
    }
  }

  addNewShuttle() {
    if (this.newMaterialForm.valid) {
      const formValue = this.newMaterialForm.value;
      const newMaterial = createMaterial({
        name: formValue.name,
        color: formValue.color,
        diameter: formValue.diameter,
        notes: formValue.notes
      });

      setMaterialID(newMaterial, this.ms.getShuttles().length);
      newMaterial.rgb = hexToRgb(newMaterial.color.trim());
      this.ms.addShuttle(newMaterial);

      // Reset the form
      this.newMaterialForm.reset({
        name: '',
        color: '#000000',
        diameter: 0,
        notes: ''
      });

      // Update the materials form array
      this.updateMaterialsForm();
      this.save();
    }
  }


  save() {

    // Sync form changes back to the materials service

    //this.syncFormToMaterials();

    const change: MaterialsStateChange = {
      originator: 'MATERIALS',
      type: 'UPDATED',
      before: this.allmaterials.slice(),
      after: this.ms.getShuttles().slice()
    }


    this.state.addStateChange(change);
    this.materialsForm.markAsPristine();

    this.allmaterials = [];
    this.ms.getShuttles().forEach((el, ndx) => {
      this.allmaterials.push((<Material>{
        id: el.id,
        name: el.name,
        color: el.color,
        rgb: el.rgb,
        diameter: el.diameter,
        notes: el.notes
      }));
    });


  }

  // private syncFormToMaterials() {
  //   const materialsArray = this.materialsFormArray;
  //   materialsArray.controls.forEach((control, index) => {
  //     const formValue = control.value;
  //     const material = this.ms.getShuttle(formValue.id);
  //     console.log("SYNCING FORM TO MATERIALS SERVICE", formValue.name, material);
  //     if (material) {
  //       material.name = formValue.name;
  //       material.color = formValue.color;
  //       material.diameter = formValue.diameter;
  //       material.notes = formValue.notes;
  //       material.rgb = hexToRgb(formValue.color);
  //     }
  //     this.ms.setMaterial(formValue.id, material);
  //   });


  // }




  ngOnDestroy() {
  }


}
