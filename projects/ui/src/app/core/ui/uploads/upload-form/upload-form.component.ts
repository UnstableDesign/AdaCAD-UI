import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, EventEmitter, inject, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatFormField } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MediaInstance, Upload } from '../../../model/datatypes';
import { ImporttodraftService } from '../../../provider/importtodraft.service';
import { MediaService } from '../../../provider/media.service';
import { UploadService } from '../../../provider/upload.service';

@Component({
  selector: 'upload-form',
  templateUrl: './upload-form.component.html',
  styleUrls: ['./upload-form.component.scss'],
  imports: [MatFormField, MatInput, MatProgressBar, MatButton]
})
export class UploadFormComponent implements OnInit {
  private upSvc = inject(UploadService);
  private httpClient = inject(HttpClient);
  private mediaSvc = inject(MediaService);
  private importtodraftSvc = inject(ImporttodraftService);

  @Input() type: string; //'single_image', 'ada', or 'bitmap_collection'
  @Input() multiple: boolean;
  @Input() accepts: string;
  @Input() source: string = 'mixer'; //'mixer', 'share'


  progress: number = 0;
  selectedFiles: FileList;
  uploading: boolean = false;
  imageToShow: any;
  downloadid: string;

  @ViewChild('uploadImage') canvas: ElementRef;

  @Output() onData: any = new EventEmitter();
  @Output() onError: any = new EventEmitter();



  detectFiles(event) {
    this.selectedFiles = event.target.files;
  }

  async uploadAda(upload: Upload, file: File) {
    await this.upSvc.pushUpload(upload).then(snapshot => {
      return this.upSvc.getDownloadData(upload.name)
    }).then(url => {
      console.log("got download", url)
      this.httpClient.get(url).toPromise()
        .then(data => {
          var obj = {
            name: file.name.split(".")[0],
            data: data,
            type: 'ada',
          }
          this.onData.emit(obj);
          this.uploading = false;
          this.selectedFiles = null;
          this.upSvc.deleteUpload(upload.name);

        })





    });

  }




  uploadImage(upload: Upload, file: File, type: 'image' | 'indexed_color_image'): Promise<any> {

    console.log("uploading image", upload, file, type);

    return this.upSvc.pushUpload(upload).then(snapshot => {

      const media_instance: MediaInstance = {
        id: -1,
        ref: upload.name,
        type: type,
        img: null
      }

      return this.mediaSvc.loadMediaFromUpload([media_instance]);
    }).then(uploaded => {


      this.onData.emit(uploaded);
      this.uploading = false;
      this.selectedFiles = null;

    }).catch(e => {
      console.error("error uploading image", e);
      this.onError.emit(e);
      this.uploading = false;
      this.selectedFiles = null;
    });
  }





  upload() {

    this.uploading = true;

    console.log("uploading", this.selectedFiles, this.type);

    let uploadList = [];
    if (this.multiple) {
      for (let i = 0; i < this.selectedFiles.length; i++) {
        let file: File = this.selectedFiles.item(i);
        let fileType = file.name.split(".").pop();
        let fileName = file.name.split(".")[0];
        uploadList.push({ file: file, fileName: fileName, fileType: fileType });
      }
    } else {
      uploadList.push({ file: this.selectedFiles.item(0), fileName: this.selectedFiles.item(0).name.split(".")[0], fileType: this.selectedFiles.item(0).name.split(".").pop() });
    }


    for (let uploadObj of uploadList) {
      const upload: Upload = {
        $key: '',
        file: uploadObj.file,
        name: uploadObj.fileName,
        fileType: uploadObj.fileType,
        url: '',
        progress: 0,
        createdAt: new Date()
      };





      switch (this.type) {
        case 'ada':
          this.uploadAda(upload, uploadObj.file);
          break;

        case 'indexed_color_image':
          this.uploadImage(upload, uploadObj.file, 'indexed_color_image')

          break;

        case 'single_image':
          this.uploadImage(upload, uploadObj.file, 'image')
          break;

        case 'wif':
          this.importtodraftSvc.uploadWif(upload, uploadObj.file).then(
            res => {
              this.onData.emit();
              this.uploading = false;
              this.selectedFiles = null;
            }).catch(e => {
              this.onError.emit(e);
              this.uploading = false;
              this.selectedFiles = null;
            });
          break;

        case 'bitmap':
          this.importtodraftSvc.uploadBitmap(upload, uploadObj.file, uploadObj.fileType).then(
            res => {
              this.onData.emit(res);
              this.uploading = false;
              this.selectedFiles = null;
            }).catch(e => {
              this.onError.emit(e);
              this.uploading = false;
              this.selectedFiles = null;
            });
          break;


        default:
          break;
      }
    }




  }


  ngOnInit() {
  }

}
