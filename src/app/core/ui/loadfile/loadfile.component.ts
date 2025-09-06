import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';
import { FileService } from '../../provider/file.service';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { UploadFormComponent } from '../uploads/upload-form/upload-form.component';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'app-loadfile',
    templateUrl: './loadfile.component.html',
    styleUrls: ['./loadfile.component.scss'],
    imports: [MatDialogTitle, CdkScrollable, MatDialogContent, UploadFormComponent, MatDialogActions, MatButton, MatDialogClose]
})
export class LoadfileComponent {
  private fls = inject(FileService);
  private dialogRef = inject<MatDialogRef<LoadfileComponent>>(MatDialogRef);
  private data = inject(MAT_DIALOG_DATA);

 
 
  multiple: boolean = false;
  accepts: string = '';
  type: string = ''; //'single_image', 'ada', or 'bitmap_collection'
  title: string = 'Select Files'
  errorstring: string = '';

  constructor() {
      const data = this.data;


      this.multiple = data.multiple;
      this.accepts = data.accepts;
      this.type = data.type;
      if(data.title !== undefined) this.title = data.title;
      
  }

  handleError(e: any){
      this.errorstring = e;
  }

  /**
   * this is called on upload of a file from any location
   * @param e 
   */
   async handleFile(e: any) : Promise<any>{
    this.errorstring = '';
    switch(e.type){
      // case 'image': 
      // return this.fls.loader.bmp(e.name, e.data).then(
      //   res => this.dialogRef.close(res)
      // );
      // case 'wif': 
      //   return this.fls.loader.wif(e.name, e.data)
      //   .then(
      //     res => this.dialogRef.close(res)
      //   );

      case 'bitmap_collection':
        this.dialogRef.close(e.drafts)
        break;

      
      case 'ada': 
      
        return this.fls.loader.ada(e.name,'upload',-1, '', e.data, '')
        .then(
          res => this.dialogRef.close(res)
        );

        

    }
  
  }


}
