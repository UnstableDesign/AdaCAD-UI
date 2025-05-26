import { Component, EventEmitter, Input, OnInit, Output, ViewChild, ViewEncapsulation, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { AbstractControl, FormControl, UntypedFormControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { AnalyzedImage, BoolParam, CodeParam, FileParam, IndexedColorImageInstance, MediaInstance, NotationTypeParam, NumParam, OpNode, SelectParam, StringParam, CanvasParam } from '../../../../core/model/datatypes';
import { OperationDescriptionsService } from '../../../../core/provider/operation-descriptions.service';
import { OperationService } from '../../../../core/provider/operation.service';
import { TreeService } from '../../../../core/provider/tree.service';
import { MediaService } from '../../../../core/provider/media.service';
import { MaterialsService } from '../../../../core/provider/materials.service';
import { map, startWith } from 'rxjs/operators';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import {NgZone} from '@angular/core';
import {take} from 'rxjs/operators';
import { ImageeditorComponent } from '../../../../core/modal/imageeditor/imageeditor.component';
import { MatDialog } from '@angular/material/dialog';
import { Index } from '@angular/fire/firestore';
import { update } from '@angular/fire/database';
import * as p5 from 'p5';


export function regexValidator(nameRe: RegExp): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const globalRegex = new RegExp(nameRe, 'g');
    const valid =  globalRegex.test(control.value);
    return !valid ? {forbiddenInput: {value: control.value}} : null;
  };
}



@Component({
  selector: 'app-parameter',
  templateUrl: './parameter.component.html',
  styleUrls: ['./parameter.component.scss'],
  encapsulation: ViewEncapsulation.None,
  // providers: [
  //   {provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: {appearance: 'outline', subscriptSizing: 'dynamic' }}
  // ]
})
export class ParameterComponent implements OnInit, OnDestroy, AfterViewInit {

  fc: UntypedFormControl;
  opnode: OpNode;
  name: any;
  refresh_dirty: boolean = false;

  @Input() param:  NumParam | StringParam | SelectParam | BoolParam | FileParam | CodeParam;
  @Input() opid:  number;
  @Input() paramid:  number;
  @Output() onOperationParamChange = new EventEmitter <any>(); 
  @Output() onFileUpload = new EventEmitter <any>(); 
  @Output() preventDrag = new EventEmitter <any>(); 



  //you need these to access values unique to each type.
  numparam: NumParam;
  boolparam: BoolParam;
  stringparam: StringParam;
  selectparam: SelectParam;
  fileparam: FileParam;
  canvasparam: CanvasParam;
  description: string;
  has_image_uploaded: boolean = false;
  filewarning: string = '';

  @ViewChild('autosize') autosize: CdkTextareaAutosize;
  @ViewChild('p5canvasContainer') p5canvasContainer: ElementRef;

  private p5Instance: any;

  constructor(
    public tree: TreeService, 
    private dialog: MatDialog,
    public ops: OperationService,
    public op_desc: OperationDescriptionsService,
    public mediaService: MediaService,
    private _ngZone: NgZone,
    private materialsService: MaterialsService) { 




  }

  triggerResize() {
    // Wait for changes to be applied, then trigger textarea resize.
    this._ngZone.onStable.pipe(take(1)).subscribe(() => this.autosize.resizeToFitContent(true));
  }

  ngOnInit(): void {

    this.opnode = this.tree.getOpNode(this.opid);
    this.description = this.op_desc.getParamDescription(this.param.name);
    if(this.description == undefined || this.description == null) this.description = this.param.dx;
     //initalize the form controls for the parameters: 

      switch(this.param.type){
        case 'number':
          this.numparam = <NumParam> this.param;
          this.fc = new UntypedFormControl(this.param.value);
          break;

        case 'boolean':
          this.boolparam = <BoolParam> this.param;
          this.fc = new UntypedFormControl(this.param.value);
          break;

        case 'select':
          
          this.selectparam = <SelectParam> this.param;
          this.fc = new UntypedFormControl(this.param.value);
          break;

        case 'file':
          this.fileparam = <FileParam> this.param;
          this.fc = new UntypedFormControl(this.param.value);
          break;

        case 'string':
          this.stringparam = <StringParam> this.param;
         // this.fc = new UntypedFormControl(this.stringparam.value, [Validators.required, Validators.pattern((<StringParam>this.param).regex)]);
          this.fc = new UntypedFormControl(this.stringparam.value, [Validators.required, Validators.pattern((<StringParam>this.param).regex)]);
    
         this.fc.valueChanges.forEach(el => {this._refreshDirty()})
       //  this.fc.valueChanges.forEach(el => {this._refreshDirty(el.trim())})

    
          break;

        case 'notation_toggle':
          this.boolparam = <NotationTypeParam> this.param;
          this.fc = new UntypedFormControl(this.param.value);
          break;

        // case 'draft':
        //   this.draftparam = <DraftParam> this.param;
        //   this.fc = new FormControl(this.draftparam.value);
        //   break;

      case 'p5-canvas':
        this.canvasparam = <CanvasParam>this.param;
        this.fc = new UntypedFormControl(this.param.value);
        break;
    }
  }

  ngAfterViewInit() {
    // Initialize canvas if needed
    if (this.param.type === 'p5-canvas' && this.p5canvasContainer) {
      // Fetch initial param value from the opnode
      const op = this.ops.getOp(this.opnode.name);

      if(op === null || op === undefined) return Promise.reject("Operation is null")
    
      const initialParamVals = op.params.map((param, ndx) => {
        return {
          param: param,
          val: this.opnode.params[ndx]
        }
      })

      // Wait for next tick to ensure ViewChild is available
      // Fetch the initial state for the first load - This determines the initial config
      if (!initialParamVals) {
        console.error(`[ParameterComponent ${this.opid}] Could not get initial param value in ngAfterViewInit.`);
        return;
      }

      setTimeout(() => this.initializeP5Canvas(initialParamVals), 0);
    }
  }

  ngOnDestroy() {
    // Clean up p5 instance if it exists
    if (this.p5Instance) {
      this.p5Instance.remove();
    }
  }

  _refreshDirty(){
    this.refresh_dirty = true;
  }

  _updateString(val: string){
    this.refresh_dirty = false;
    this.onParamChange(val);
    return val;
  }

  /**
   * Public method called by parent components to explicitly reset the p5 sketch.
   * @param latestConfig The latest configuration object derived from non-canvas params.
   */
  public triggerSketchReset (latestConfig: object): void {
    if (this.param.type === 'p5-canvas') {
      if (!latestConfig) {
        console.error('[ParameterComponent] triggerSketchReset called without latestConfig for op:', this.opid);
        return;
      }
      
      this._resetSketch(latestConfig);
    }
  }

  /**
   * Private helper to destroy the current p5 instance and re-initialize it
   * with the provided configuration.
   * @param latestConfig The latest configuration object for the sketch.
   */
  private _resetSketch (latestParamVals: object): void {
    if (this.p5Instance) {
      try {
        this.p5Instance.remove();
      } catch (e) {
        console.error('[ParameterComponent] Error removing p5 instance:', e);
      }
      this.p5Instance = null;
    }
    setTimeout(() => this.initializeP5Canvas(latestParamVals), 0);
  }

  /**
   * changes the view and updates the tree with the new value
   * @param value 
   */
  onParamChange(value: any){

    const opnode: OpNode = <OpNode> this.tree.getNode(this.opid);

    switch(this.param.type){

      case 'file': 
      if(value == null) value = 1;
       opnode.params[this.paramid] = value;
       //this.fc.setValue(value);
       this.onOperationParamChange.emit({id: this.paramid, value: value, type: this.param.type});
       break;

      case 'number': 
       if(value == undefined) value = null;
        opnode.params[this.paramid] = value;
        this.fc.setValue(value);
        this.onOperationParamChange.emit({id: this.paramid, value: value, type: this.param.type});
        break;

      case 'boolean':
        if(value == null) value = false;
        opnode.params[this.paramid] = (value) ? 1 : 0;
        this.fc.setValue(value);
        this.onOperationParamChange.emit({id: this.paramid, value: value, type: this.param.type});
        break;

      case 'notation_toggle':
        if(value == null) value = false;
        opnode.params[this.paramid] = (value) ? 1 : 0;
        this.fc.setValue(value);
        this.onOperationParamChange.emit({id: this.paramid, value: value, type: this.param.type});
        break;

      case 'string':
        if(value == null) value = '';
        opnode.params[this.paramid] = value;
        //this.fc.setValue(value); //this is being handled in the form input
        if(!this.fc.hasError('pattern'))this.onOperationParamChange.emit({id: this.paramid, value: value, type: this.param.type});
        break;

      case 'select':
        if(value == null) value = 0;
        opnode.params[this.paramid] = value;
        this.fc.setValue(value);
        this.onOperationParamChange.emit({id: this.paramid, value: value, type: this.param.type});
        break;

      case 'draft':
        opnode.params[this.paramid] = value;
        this.fc.setValue(value);
        this.onOperationParamChange.emit({id: this.paramid, value: value, type: this.param.type});
        break;

      case 'p5-canvas':
        opnode.params[this.paramid] = value;
        this.fc.setValue(value);
        this.onOperationParamChange.emit({ id: this.paramid, value: value, type: this.param.type });
        break;
    }
  }

  initializeP5Canvas (currentParamVals: object) {
    // Setup an interactive p5.js canvas for operations that use it

    if (!this.p5canvasContainer || !this.p5canvasContainer.nativeElement) {
      console.error(`[ParameterComponent ${this.opid}] p5canvasContainer not available.`);
      return;
    }

    if (this.param.type !== 'p5-canvas') {
      console.error(`[ParameterComponent ${this.opid}] This component's own param Input is not type 'p5-canvas'. Type: ${this.param.type}`);
      return;
    }

    const opNodeName = this.tree.getOpNode(this.opid)?.name;
    if (!opNodeName) {
      console.error(`[ParameterComponent ${this.opid}] Could not determine operation name.`);
      return;
    }
    const operationDefinition = this.ops.getOp(opNodeName);

    // If operation provides a sketch function, create the P5 instance
    if (operationDefinition && 'createSketch' in operationDefinition && typeof operationDefinition.createSketch === 'function') {

      const updateCallbackFn = (newCanvasState: any) => {
        // 1. Update the canvasState in the component param value to the newCanvasState
        //    This ensures that if findOrCreateMaterialByHex fails or this logic has an issue,
        //    the raw sketch state is still preserved at a base level.
        this.param.value = newCanvasState;

        // 2. Resolve weft colors used in the sketch to AdaCAD material IDs
        if (this.param.type === 'p5-canvas' &&
          newCanvasState &&
          newCanvasState.generatedDraft &&
          Array.isArray(newCanvasState.generatedDraft.weftColors)) {

          const sketchColors: string[] = newCanvasState.generatedDraft.weftColors;
          const resolvedIds: number[] = [];

          sketchColors.forEach((hexColor, sketchWeftId) => {
            const nameSuggestion = `CrossSection Weft ${String.fromCharCode(97 + sketchWeftId)}`;
            try {
              const materialId = this.materialsService.findOrCreateMaterialByHex(hexColor, nameSuggestion);
              resolvedIds.push(materialId);
            } catch (e) {
              console.error(`Error in findOrCreateMaterialByHex for color ${hexColor} (sketchWeftId: ${sketchWeftId}):`, e);
              resolvedIds.push(0); // Fallback to material ID 0 if service call fails
            }
          });
          newCanvasState.generatedDraft.resolvedSketchMaterialIds = resolvedIds;
        }

        // 3. Emit that a change has occurred to the canvasState
        // Triggers onParamChange, which saves to the tree and notifies the op chain.
        this.onParamChange(newCanvasState);
      };

      // Debounce or ensure cleanup happens correctly if resets are rapid
      if (this.p5Instance) {
        try {
          this.p5Instance.remove();
        } catch (e) {
          console.error("[ParameterComponent] Error removing previous p5 instance:", e);
        }
        this.p5Instance = null;
      }
      
      const userSketchProvider = operationDefinition.createSketch(currentParamVals, updateCallbackFn);

      // Define the wrapper for p5 instantiation, including the mouse proxy
      const sketchWrapper = (actualP5Instance: p5) => {
        this.p5Instance = actualP5Instance; // Store the p5 instance

        // The p5.js canvas is inside an operation that gets scaled by AdaCAD application CSS
        // This makes the mouse coordinates inside a sketch incorrect. This proxy corrects that.
        // It wraps the p5.js instance and intercepts `p.mouseX` and `p.mouseY` and correct them.
        // The error is between the p5 canvas buffer dimensions and the display dimensions.
        const P5MouseProxyHandler: ProxyHandler<p5> = {
          get: (target, prop, receiver) => {
            // target: The actual p5 instance.
            // receiver: The proxy instance.

            // Intercept mouseX/Y
            if (prop === 'mouseX') {
              if (!target.canvas || !(target as any)._setupDone) {
                const unscaledFallbackX = Reflect.get(target, 'mouseX', receiver); // Get actual p5.mouseX
                return typeof unscaledFallbackX === 'number' ? unscaledFallbackX : 0;
              }
              const rect = target.canvas.getBoundingClientRect();
              const unscaledMouseX = Reflect.get(target, 'mouseX', receiver); // Get actual p5.mouseX value
              if (rect.width > 0 && target.width > 0 && typeof unscaledMouseX === 'number') {
                return unscaledMouseX * (target.width / rect.width);
              }
              return typeof unscaledMouseX === 'number' ? unscaledMouseX : 0;
            }
            if (prop === 'mouseY') {
              if (!target.canvas || !(target as any)._setupDone) {
                const unscaledFallbackY = Reflect.get(target, 'mouseY', receiver);
                return typeof unscaledFallbackY === 'number' ? unscaledFallbackY : 0;
              }
              const rect = target.canvas.getBoundingClientRect();
              const unscaledMouseY = Reflect.get(target, 'mouseY', receiver); // Get actual p5.mouseY value
              if (rect.height > 0 && target.height > 0 && typeof unscaledMouseY === 'number') {
                return unscaledMouseY * (target.height / rect.height);
              }
              return typeof unscaledMouseY === 'number' ? unscaledMouseY : 0;
            }

            // Delegate all other property access to the original p5 instance.
            return Reflect.get(target, prop, receiver);
          },
        };

        // Use the mouse-correcting proxy.
        const proxiedP5Instance = new Proxy(actualP5Instance, P5MouseProxyHandler);
        userSketchProvider(proxiedP5Instance);
      };

      // Instantiate p5 with the wrapper
      new p5(sketchWrapper, this.p5canvasContainer.nativeElement);

    } else {
      console.error("[ParameterComponent] An operation with p5-canvas type did not provide a valid createSketch function.");
    }
  }

  openImageEditor(){
  
    const opnode = this.tree.getOpNode(this.opid);
    const obj = <IndexedColorImageInstance> this.mediaService.getMedia(opnode.params[this.paramid].id);

    if(obj === undefined || obj.img == undefined || obj.img.image == null ) return;

    const dialogRef = this.dialog.open(ImageeditorComponent, {data: {media_id: obj.id, src: this.opnode.name}});
    dialogRef.afterClosed().subscribe(nothing => {

      let updated_media = <IndexedColorImageInstance> this.mediaService.getMedia( this.opnode.params[this.paramid].id)
      this.onParamChange({id: this.opnode.params[this.paramid].id, data:updated_media.img});
   });
  }

  handleError(err: any){
    this.filewarning = err;
    this.clearImagePreview();

  }

  replaceImage(){
    this.clearImagePreview();
    const opnode = this.tree.getOpNode(this.opid);
    this.mediaService.removeInstance( opnode.params[this.paramid].id)
    this.opnode.params[this.paramid] = {id:''};
    this.onOperationParamChange.emit({id: this.paramid, value: this.opnode.params[this.paramid], type: this.param.type});

  }




  /**
   * this is called by the upload services "On Data function" which uploads and analyzes the image data in the image and returns it as a image data object
   * @param obj 
   */
  handleFile(obj: Array<IndexedColorImageInstance>){

    this.filewarning = "";
    let img:AnalyzedImage = obj[0].img;

    this.opnode.params[this.paramid] = {id: obj[0].id, data: img};
    this.onOperationParamChange.emit({id: this.paramid, value: this.opnode.params[this.paramid]});
    
    this.fc.setValue(img.name);

    if(img.warning !== ''){
        this.filewarning = img.warning;
    }else{

      const opnode = this.tree.getOpNode(this.opid);
      //now update the default parameters to the original size 
      opnode.params[1] = img.width;
      opnode.params[2] = img.height;

      this.drawImagePreview();

    }





  }

  drawImagePreview(){


    //check if the image has been removed
    const opnode = this.tree.getOpNode(this.opid);
    if(opnode.params[this.paramid].id == ''){
      this.clearImagePreview();
      return;
    } 

    const obj = <IndexedColorImageInstance> this.mediaService.getMedia(opnode.params[this.paramid].id);

   if(obj === null || obj.img == null || obj.img.image == null ) return;

    this.has_image_uploaded = true;


    //   const data = obj.data;

    //   this.has_image_preview = true;
    //   const image_div =  document.getElementById('param-image-'+this.opid);
    //   image_div.style.display = 'flex';

    //   const dims_div =  document.getElementById('param-image-dims-'+this.opid);
    //   dims_div.innerHTML=data.width+"px x "+data.height+"px";

    //   const canvas: HTMLCanvasElement =  <HTMLCanvasElement> document.getElementById('preview_canvas-'+this.opid);
    //   const ctx = canvas.getContext('2d');

    //   const max_dim = (data.width > data.height) ? data.width : data.height;
    //   const use_width = (data.width > 100) ? data.width / max_dim * 100 : data.width;
    //   const use_height = (data.height > 100) ? data.height / max_dim * 100 : data.height;

    //   canvas.width = use_width;
    //   canvas.height = use_height;


    //   ctx.drawImage(data.image, 0, 0, use_width, use_height);
  

    

  }


  clearImagePreview(){

    this.has_image_uploaded  = false;

      // const opnode = this.tree.getOpNode(this.opid);
      // const obj = this.imageService.getImageData(opnode.params[this.paramid].id);
  
      // if(obj === undefined) return;
  
      //   const data = obj.data;
  
      //   const image_div =  document.getElementById('param-image-'+this.opid);
      //   image_div.style.display = 'none';
  
      //   const dims_div =  document.getElementById('param-image-dims-'+this.opid);
      //   dims_div.innerHTML="";
  
      //   const canvas: HTMLCanvasElement =  <HTMLCanvasElement> document.getElementById('preview_canvas-'+this.opid);
  

      //   canvas.width = 0;
      //   canvas.height = 0;
  
  
    
  
  }



}
