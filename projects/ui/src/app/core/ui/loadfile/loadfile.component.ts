import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { FileService } from '../../provider/file.service';
import { FirebaseService } from '../../provider/firebase.service';
import { UploadFormComponent } from '../uploads/upload-form/upload-form.component';

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
  private fb = inject(FirebaseService);



  multiple: boolean = false;
  accepts: string = '';
  type: string = ''; //'single_image', 'ada', or 'bitmap_collection'
  title: string = 'Select Files'
  errorstring: string = '';
  connection_state = false;
  private connectionSubscription: Subscription;



  constructor() {
    const data = this.data;


    this.multiple = data.multiple;
    this.accepts = data.accepts;
    this.type = data.type;
    if (data.title !== undefined) this.title = data.title;


    //subscribe to the connection event to see if we have access to the firebase database (and internet) 
    this.connectionSubscription = this.fb.connectionChangeEvent$.subscribe(data => {
      this.connection_state = data;
    });




  }

  ngOnDestroy() {

    if (this.connectionSubscription) {
      this.connectionSubscription.unsubscribe();
    }

  }


  handleError(e: any) {
    this.errorstring = e;
  }

  /**
   * this is called on upload of a file from any location
   * @param e 
   */
  async handleFile(e: any): Promise<any> {
    this.errorstring = '';
    if (e === undefined || e === null) {
      this.dialogRef.close();
      return;
    }
    switch (e.type) {

      case 'ada':

        let meta = {
          id: -1,
          name: e.name,
          desc: '',
          from_share: '',
          share_owner: ''
        }

        return this.fls.loader.ada(e.data, meta, 'upload')
          .then(
            res => this.dialogRef.close(res)
          );



    }

  }


}
