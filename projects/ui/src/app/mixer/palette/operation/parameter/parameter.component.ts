import { CdkTextareaAutosize, TextFieldModule } from '@angular/cdk/text-field';
import { Component, EventEmitter, inject, Input, OnInit, Output, ViewChild } from '@angular/core';
import { AbstractControl, FormsModule, ReactiveFormsModule, UntypedFormControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatOption } from '@angular/material/autocomplete';
import { MatButton, MatFabButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { AnalyzedImage, BoolParam, CodeParam, FileParam, Img, NumParam, OpParamValType, SelectParam, StringParam } from 'adacad-drafting-lib';
import { MediaInstance, OpNode, OpStateParamChange } from '../../../../core/model/datatypes';
import { MediaService } from '../../../../core/provider/media.service';
import { OperationService } from '../../../../core/provider/operation.service';
import { StateService } from '../../../../core/provider/state.service';
import { TreeService } from '../../../../core/provider/tree.service';
import { ImageeditorComponent } from '../../../../core/ui/imageeditor/imageeditor.component';
import { TextparamComponent } from '../../../../core/ui/textparam/textparam.component';
import { UploadFormComponent } from '../../../../core/ui/uploads/upload-form/upload-form.component';


export function regexValidator(nameRe: RegExp): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const globalRegex = new RegExp(nameRe, 'g');
    const valid = globalRegex.test(control.value);
    return !valid ? { forbiddenInput: { value: control.value } } : null;
  };
}



@Component({
  selector: 'app-parameter',
  templateUrl: './parameter.component.html',
  styleUrls: ['./parameter.component.scss'],
  providers: [
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { floatLabel: 'always' } }
  ],
  imports: [MatFormField, MatFabButton, TextFieldModule, MatLabel, MatInput, FormsModule, ReactiveFormsModule, MatSelect, MatOption, MatButton, UploadFormComponent]
})
export class ParameterComponent implements OnInit {
  tree = inject(TreeService);
  ss = inject(StateService);
  dialog = inject(MatDialog);
  ops = inject(OperationService);
  mediaService = inject(MediaService);


  fc: UntypedFormControl;
  opnode: OpNode;

  name: any;

  @Input() param: NumParam | StringParam | SelectParam | BoolParam | FileParam | CodeParam;
  @Input() opid: number;
  @Input() paramid: number;
  @Output() onOperationParamChange = new EventEmitter<any>();
  @Output() onFileUpload = new EventEmitter<any>();
  @Output() preventDrag = new EventEmitter<any>();

  fromUser: boolean = true;

  has_image_uploaded: boolean = false;
  filewarning: string = '';

  @ViewChild('autosize') autosize: CdkTextareaAutosize;


  ngOnInit(): void {



    this.opnode = this.tree.getOpNode(this.opid);


    switch (this.param.type) {
      case 'number':
        this.fc = new UntypedFormControl(

          this.opnode.params[this.paramid] ?? this.param.value,
          [
            Validators.required,
            Validators.min((<NumParam>this.param).min),
            Validators.max((<NumParam>this.param).max),
          ]);
        this.fc.valueChanges.subscribe(val => {
          if (this.fc.valid) {
            this.onParamChange(val);
          }

        });
        break;

      case 'boolean':
        this.fc = new UntypedFormControl(
          this.opnode.params[this.paramid] ?? this.param.value);
        this.fc.valueChanges.subscribe(val => {
          this.onParamChange(val);
        });
        break;

      case 'select':

        this.fc = new UntypedFormControl(this.opnode.params[this.paramid] ?? this.param.value);
        this.fc.valueChanges.subscribe(val => {
          this.onParamChange(val);
        });
        break;

      case 'file':
        this.has_image_uploaded = (<Img>this.opnode.params[this.paramid]).data !== null;
        console.log("FILE PARAM ", this.opnode.params[this.paramid], this.param.value);
        console.log("MEDIA SERVICE CONTAINS ", this.mediaService.current.slice());
        this.fc = new UntypedFormControl(this.opnode.params[this.paramid] ?? this.param.value);
        break;

      case 'string':
        const value = this.opnode.params[this.paramid] ?? this.param.value;
        this.fc = new UntypedFormControl(value, [Validators.required, Validators.pattern((<StringParam>this.param).regex)]);
        this.fc.valueChanges.subscribe(val => {
          if (!this.fc.hasError('pattern')) {
            this.onParamChange(val);
          }
        });
        break;


      // case 'draft':
      //   this.draftparam = <DraftParam> this.param;
      //   this.fc = new FormControl(this.draftparam.value);
      //   break;


    }






  }




  // _updateString(val: string) {
  //   this.refresh_dirty = false;
  //   this.onParamChange(val);
  //   return val;
  // }



  setValueFromStateEvent(value: OpParamValType) {
    console.log("SET VALUE FROM STATE ", value)
    this.fromUser = false;

    if (this.param.type === 'file') {
      if (value !== null) {
        this.addImageFromStateChange(<Img>value)
      } else {
        this.replaceImage();
      }
    } else {
      this.fc.setValue(value);

    }


  }


  addImageFromStateChange(value: Img) {
    const instance = this.mediaService.addIndexColorMediaInstance(
      +value.id,
      'reloaded media item',
      <AnalyzedImage>value.data
    )
    this.handleFile([instance])
  }

  /**
 * changes the view and updates the tree with the new value
 * @param value 
 */
  onParamChange(value: any) {


    const opnode: OpNode = <OpNode>this.tree.getNode(this.opid);

    const change: OpStateParamChange = {
      originator: 'OP',
      type: 'PARAM_CHANGE',
      opid: this.opid,
      paramid: this.paramid,
      before: opnode.params[this.paramid],
      after: value
    }
    if (this.fromUser) this.ss.addStateChange(change);
    this.fromUser = true;

    switch (this.param.type) {

      case 'file':
        if (value == null) value = 1;
        opnode.params[this.paramid] = value;
        this.onOperationParamChange.emit({ id: this.paramid, value: value, type: this.param.type });
        break;

      case 'number':
        opnode.params[this.paramid] = value;
        this.onOperationParamChange.emit({ id: this.paramid, value: value, type: this.param.type });

        break;

      case 'boolean':
        if (value == null) value = false;
        opnode.params[this.paramid] = (value) ? 1 : 0;
        this.onOperationParamChange.emit({ id: this.paramid, value: value, type: this.param.type });
        break;

      case 'string':
        if (value == null) value = '';
        opnode.params[this.paramid] = value;
        if (!this.fc.hasError('pattern')) this.onOperationParamChange.emit({ id: this.paramid, value: value, type: this.param.type });
        break;

      case 'select':
        if (value == null) value = 0;
        opnode.params[this.paramid] = value;
        this.onOperationParamChange.emit({ id: this.paramid, value: value, type: this.param.type });
        break;

      case 'draft':
        opnode.params[this.paramid] = value;
        this.onOperationParamChange.emit({ id: this.paramid, value: value, type: this.param.type });
        break;
    }


  }

  openTextEditor() {

    const opnode = this.tree.getOpNode(this.opid);

    const dialogRef = this.dialog.open(TextparamComponent, { data: { val: opnode.params[this.paramid], param: this.param } });

    dialogRef.componentInstance.onUpdate.subscribe(text => {
      this.onParamChange(text);
    });

    dialogRef.afterClosed().subscribe(text => {
      this.onParamChange(text);
    });
  }


  async openImageEditor() {

    const opnode = this.tree.getOpNode(this.opid);
    let obj: MediaInstance = this.mediaService.getMedia(+(<Img>opnode.params[this.paramid]).id);
    console.log("MEDIA SERVICE CONTAINS ", obj, this.mediaService.current.slice(), opnode.params[this.paramid]);


    if (obj === undefined || obj === null) return;


    const dialogRef = this.dialog.open(ImageeditorComponent, { data: { media_id: obj.id, src: this.opnode.name } });
    dialogRef.afterClosed().subscribe(nothing => {

      let updated_media = this.mediaService.getMedia(+(<Img>this.opnode.params[this.paramid]).id)
      this.onParamChange({ id: (<Img>this.opnode.params[this.paramid]).id, data: <AnalyzedImage>updated_media.img });
    });
  }

  handleError(err: any) {
    this.filewarning = err;

  }

  replaceImage() {

    const opnode: OpNode = <OpNode>this.tree.getNode(this.opid);

    const img: Img = <Img>opnode.params[this.paramid];

    const change: OpStateParamChange = {
      originator: 'OP',
      type: 'PARAM_CHANGE',
      opid: this.opid,
      paramid: this.paramid,
      before: img,
      after: null
    }

    if (this.fromUser) this.ss.addStateChange(change);
    this.fromUser = true;

    this.has_image_uploaded = false;

    this.mediaService.removeInstance(+img.id)
    this.opnode.params[this.paramid] = { id: '0', data: null as AnalyzedImage };
    this.onOperationParamChange.emit({ id: this.paramid, value: this.opnode.params[this.paramid], type: this.param.type });

  }






  /**
   * this is called by the upload services "On Data function" which uploads and analyzes the image data in the image and returns it as a image data object
   * @param obj 
   */
  handleFile(obj: Array<MediaInstance>) {

    //ADD TEH CHANGE HERE


    this.filewarning = "";
    let img: AnalyzedImage = <AnalyzedImage>obj[0].img;

    this.opnode.params[this.paramid] = { id: obj[0].id.toString(), data: <AnalyzedImage>img };

    const change: OpStateParamChange = {
      originator: 'OP',
      type: 'PARAM_CHANGE',
      opid: this.opid,
      paramid: this.paramid,
      before: null,
      after: this.opnode.params[this.paramid]
    }
    if (this.fromUser) this.ss.addStateChange(change);
    this.fromUser = true;



    this.fc.setValue(img.name);


    if (img.warning !== '') {
      this.filewarning = img.warning;
    } else {
      this.has_image_uploaded = true;
      const opnode = this.tree.getOpNode(this.opid);
      //now update the default parameters to the original size 
      opnode.params[1] = img.width;
      opnode.params[2] = img.height;

    }


    this.onOperationParamChange.emit({ id: this.paramid, value: this.opnode.params[this.paramid] });







  }




}




