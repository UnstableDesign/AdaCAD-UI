import { Component, OnInit, ViewChild, ElementRef, Output, Input, EventEmitter } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UploadService } from '../../../provider/upload.service';
import { Draft, Drawdown, Upload } from '../../../model/datatypes';
import { MediaService } from '../../../provider/media.service';
import { Sequence } from '../../../model/sequence';
import { initDraftFromDrawdown } from '../../../model/drafts';

@Component({
  selector: 'upload-form',
  templateUrl: './upload-form.component.html',
  styleUrls: ['./upload-form.component.scss']
})
export class UploadFormComponent implements OnInit {
 
  @Input() type: string; //'single_image', 'ada', or 'bitmap_collection'
  @Input() multiple: boolean;
  @Input() accepts: string;


  progress:number = 0;
  selectedFiles: FileList;
  uploading: boolean = false;
  imageToShow: any;
  downloadid: string;

  @ViewChild('uploadImage') canvas: ElementRef;

  @Output() onData: any = new EventEmitter();
  @Output() onError: any = new EventEmitter();

  constructor(private upSvc: UploadService, private httpClient: HttpClient, private mediaSvc: MediaService) { }

  detectFiles(event) {
      this.selectedFiles = event.target.files;
  }

  async uploadAda(upload: Upload, file: File){
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
        this.upSvc.deleteUpload(upload);

      })
        
     


            
    });
  
  }


   uploadImage(upload: Upload, file: File, type: 'image' | 'indexed_color_image') : Promise<any> {

    return this.upSvc.pushUpload(upload).then(snapshot => {
      
      const media_instance = {
        id: -1, 
        ref: upload.name, 
        type: type,
        img: null
      }

      return  this.mediaSvc.loadMediaFromUpload([media_instance]);
    }).then(uploaded => {


      this.onData.emit(uploaded);
      this.uploading = false;
      this.selectedFiles = null;

    }).catch(e => {
      this.onError.emit(e);
      this.uploading = false;
      this.selectedFiles = null;
    }); 
  }


//TEMP DISABLE
//   uploadBitmap(upload: Upload, file: File) : Promise<any> {
    
//     return this.upSvc.pushUpload(upload).then(snapshot => {
//      return  this.mediaSvc.loadMedia([{id: upload.name, data: null}]);
//    }).catch(e => {
//       this.onError.emit(e);
//       this.uploading = false;
//       this.selectedFiles = null;
//    }); 
//  }



  
  upload() {

    this.uploading = true;

    let file:File = this.selectedFiles.item(0)
    let fileType = file.name.split(".").pop();
    let fileName = file.name.split(".")[0];

    const upload:Upload = {
          $key: '',
          file:file,
          name:fileName,
          url:'',
          progress:0,
          createdAt: new Date()
      };


    switch(this.type){
      case 'ada':
        this.uploadAda(upload, file);
      break;

      case 'indexed_color_image':
          this.uploadImage(upload, file, 'indexed_color_image')
     
      break;

      case 'single_image':
        this.uploadImage(upload, file, 'image')
      break;

      case 'bitmap_collection':
        this.uploadBitmaps();
        break;


      default: 
      break;
    }



  }

  /**
   * used when handling the upload of multiple images (bitmaps) that should be converted into a drfat
   * TEMP DIABLED
   */
  uploadBitmaps() {
    
      // this.uploading = true;

      //   const uploads= [];
      //   const fns = [];
      //   for(let i = 0; i < this.selectedFiles.length; i++){

      //     let file:File = this.selectedFiles.item(i)
      //     let fileName = file.name.split(".")[0];

      //     const upload:Upload = {
      //       $key: '',
      //       file:file,
      //       name:fileName,
      //       url:'',
      //       progress:0,
      //       createdAt: new Date()
      //   };
      //   uploads.push(upload);
      //   fns.push(this.uploadBitmap(upload, file));

      //   }

      //  Promise.all(fns).then(res => {
      //   let drafts = [];
      //   res.forEach(upload_arr => {
          
      //     let upload = upload_arr[0];

      //     const twod: Sequence.TwoD = new Sequence.TwoD();
      //     let bw_ndx = upload.colors_to_bw.map(el => el.black);

      //     for(let i = 0; i < upload.height; i++){
      //       const oned: Sequence.OneD = new Sequence.OneD();
      //       for(let j = 0; j < upload.width; j++){
      //         const ndx = upload.image_map[i][j];
      //         let val:boolean = (ndx < bw_ndx.length) ? bw_ndx[ndx] : null;
      //         oned.push(val);
      //       }
      //       twod.pushWeftSequence(oned.val());
      //     }
      //     const d: Draft = initDraftFromDrawdown(twod.export());
      //     d.gen_name = upload.name;
      //     drafts.push(d);
      //   })

      //   this.onData.emit({type: this.type, drafts: drafts});
      //   this.uploading = false;
      //   this.selectedFiles = null;
      //   return [];
      //  }).then(res => {
      //     let functions = uploads.map(el => this.upSvc.deleteUpload(el));
      //     return Promise.all(functions);
      //  }).catch(e => {

      //   this.onError.emit('one of the files you uploaded was not a bitmap (and had more than 100 colors, so it could not be converted to black and white), please try again');
      //   this.uploading = false;
      //   this.selectedFiles = null;
      //  });


    

  }


  ngOnInit() {
  }

}
