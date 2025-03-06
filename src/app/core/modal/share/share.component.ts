import { Component, Inject, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../provider/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FilesystemService } from '../../provider/filesystem.service';
import { MediaInstance, ShareObj, SingleImage } from '../../model/datatypes';
import { WorkspaceService } from '../../provider/workspace.service';
import { FileService } from '../../provider/file.service';
import { defaults, licenses } from '../../model/defaults';
import { MediaService } from '../../provider/media.service';
import { LoginComponent } from '../login/login.component';

@Component({
  selector: 'app-share',
  templateUrl: './share.component.html',
  styleUrl: './share.component.scss'
})
export class ShareComponent {
  private _snackBar = inject(MatSnackBar);

  public shared_id: string = '';
  public share_obj: ShareObj;
  public share_url: string;
  public has_uploaded_image: boolean = false;

  public licenses: Array<any> = [];
  public fileid: string;

  public fc: FormControl;

  public share_in_history: ShareObj;
  public replace_img: boolean = false;

  constructor( 
    public auth: AuthService, 
    public fs: FilesystemService, 
    private file_serv: FileService,
    private mediaService: MediaService,
    private ws: WorkspaceService,
    private dialog: MatDialog,
    private dialogRef: MatDialogRef<ShareComponent>,
    @Inject(MAT_DIALOG_DATA) private data: any){

      this.fileid = data.fileid;
      this.licenses = licenses;


      //CHECK IF THIS WAS, AT ANY POINT, LOADED FROM A SHARED FILE (which data is held in workspace)
     this.fs.getFileMeta(+this.fileid).then(meta => {
        if(meta.from_share == '') return Promise.resolve(null);
        
        return  this.fs.isShared(meta.from_share.toString());
      }).then(shareobj => {
        this.share_in_history = shareobj;

      });



     
      


      // CHECK IF A LINK HAD ALREADY BEEN GENERATED FROM THIS (e.g. Edit Share is Called);
      this.fs.isShared(this.fileid.toString()).then(share_obj => {

        if(share_obj == null){
          //this is not yet shared
          this.share_obj = null;
          
        }else{
          this.share_obj = share_obj;
          this.shared_id = this.fileid.toString();
          this.updateSettings(share_obj);
          this.share_url = defaults.share_url_base+this.fileid;
        }
      }).catch(err => {
        console.log("ENTRY NOT FOUND")
      });
     

    }

    ngAfterViewInit(){


    }


  openLoginDialog() {
    const dialogRef = this.dialog.open(LoginComponent, {
      width: '600px',
    });
  }

    /**
     * update the information on the page to match what is stored in the file system
     * @param share_obj 
     */
    updateSettings(share_obj: ShareObj){

      //upload the image
      if(share_obj.img !== 'none'){
        this.mediaService.loadImage(-1, share_obj.img).then(media => {
          this.has_uploaded_image = true;
         if(media.type =='image') this.drawImage(<SingleImage> media.img)
        });
      }
      
    }

    updateChange(){
      this.fs.updateSharedFile(this.shared_id.toString(), this.share_obj)
    }

    toggleSharing(){

      if(this.shared_id !== ''){
        this.removeLink();

      }else{
        this.generateLink();
      }


    }

    generateLink(){

      console.log("GENERATE LINK ", this.fileid)
      let int_id: number = +this.fileid;

      this.fs.getFileMeta(int_id).then(meta => {
        console.log("FOT FILE META", meta)
        return Promise.all([this.file_serv.saver.ada(), meta])

      }).then(so => {
        //add the current time to the author list entry 
        console.log("IN DUPLICATE ", so)
        return   Promise.all([this.fs.duplicate(this.auth.uid, so[1].name,so[1].desc, so[0].file, ''), so[1]])
      }).then(id_and_meta => {
        console.log("ID AND META ", id_and_meta)
        this.shared_id = id_and_meta[0].toString();
        this.share_obj = {
          license: 'by',
          filename: id_and_meta[1].name,
          desc: id_and_meta[1].desc,
          owner_uid: (this.auth.isLoggedIn) ? this.auth.uid : 'anon',
          owner_creditline: (this.auth.isLoggedIn) ? 'created by '+this.auth.username : '',
          owner_url: '',
          public: false,
          img: 'none'

        }

        return  this.fs.createSharedFile(this.shared_id , this.share_obj)
      }).then(share_data => {
        this.share_url = defaults.share_url_base+this.shared_id;
      }).catch(err => {
        console.log("ERROR", err)
      })

    }

    removeLink(){
      this.fs.removeSharedFile(this.fileid);
    }

    replaceImg(){
      this.replace_img = true;
    }

    formatDate(date: number){
      var dateFormat = new Date(date);
      return dateFormat.toLocaleDateString();
    }

  /**
   * this is called by the upload services "On Data function" which uploads and analyzes the image data in the image and returns it as a image data object
   * @param obj 
   */
  handleFile(obj: MediaInstance){

     this.replace_img = false;
     this.has_uploaded_image = true;

     if(obj === null || obj[0].data == null) return;
       
     this.share_obj.img = obj[0].ref;
     this.updateChange();
     this.drawImage(obj[0].data);
 
  
  }



  drawImage(img: SingleImage){

    const canvas: HTMLCanvasElement =  <HTMLCanvasElement> document.getElementById('img_preview');
    const ctx = canvas.getContext('2d');

    const max_dim = (img.width > img.height) ? img.width : img.height;
    const use_width = (img.width > 400) ? img.width / max_dim * 400 : img.width;
    const use_height = (img.height > 400) ? img.height / max_dim * 400 : img.height;

    canvas.width = use_width;
    canvas.height = use_height;



    ctx.drawImage(img.image, 0, 0, img.width, img.height, 0, 0, use_width, use_height);

  
  }



    updateLink(){
      //create a share option from the settings, have it return the id, post the id to the screen. 

    }

    copyToClipboard(){
      navigator.clipboard.writeText(this.share_url).then(
        ()=> {
           this.openSnackBar('link copied', 'close')//on success
        },
        () => {
          //on fail 
          this.openSnackBar('could not copy link', 'close')//on success

        }
      )

    }

    openSnackBar(message: string, action: string) {
      this._snackBar.open(message, action);
    }
  
  
}
