import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Upload } from '../model/datatypes';
import { UploadService } from './upload.service';

@Injectable({
  providedIn: 'root',
})
export class ImporttodraftService {


  private upSvc = inject(UploadService);
  private httpClient = inject(HttpClient);


  wifImportedEvent: Subject<{ name: string, data: any, type: string }>;
  wifImported$: Observable<{ name: string, data: any, type: string }>;
  bitmapImportedEvent: Subject<{ name: string, data: any, type: string }>;
  bitmapImported$: Observable<{ name: string, data: any, type: string }>;






  constructor() {
    this.wifImportedEvent = new Subject<{ name: string, data: any, type: string }>();
    this.bitmapImportedEvent = new Subject<{ name: string, data: any, type: string }>();
    this.wifImported$ = this.wifImportedEvent.asObservable();
    this.bitmapImported$ = this.bitmapImportedEvent.asObservable();
  }


  async uploadWif(upload: Upload, file: File) {



    await this.upSvc.pushUpload(upload).then(snapshot => {
      return this.upSvc.getDownloadData(upload.name)
    }).then(url => {
      console.log("got download", url)
      this.httpClient.get(url, { responseType: 'text' })
        .subscribe(data => {
          var obj = {
            name: file.name.split(".")[0],
            data: data,
            type: 'wif',
            ref: upload.name
          }
          this.wifImportedEvent.next(obj);
        })
    });
  }


  /**
 * to be used when importing a bitmap into a draft
 * @param upload 
 * @param file 
 */
  async uploadBitmap(upload: Upload, file: File, fileType: string) {

    await this.upSvc.pushUpload(upload).then(snapshot => {
      return this.upSvc.getDownloadData(upload.name)
    }).then(url => {
      console.log("got download", url)
      this.httpClient.get(url, { responseType: 'blob' })
        .subscribe(data => {
          var obj = {
            name: file.name.split(".")[0],
            data: data,
            type: 'bitmap',
            fileType: fileType,
            url: url,
            ref: upload.name
          }

          this.bitmapImportedEvent.next(obj);
        })
    });






  }

  async uploadComplete(ref: string) {
    this.upSvc.deleteUpload(ref);
  }





}
