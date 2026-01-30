import { CdkScrollable } from '@angular/cdk/scrolling';
import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatOption } from '@angular/material/autocomplete';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { MediaInstance, ShareObj } from '../../model/datatypes';
import { defaults, licenses } from '../../model/defaults';
import { FileService } from '../../provider/file.service';
import { FirebaseService } from '../../provider/firebase.service';
import { MediaService } from '../../provider/media.service';
import { WorkspaceService } from '../../provider/workspace.service';
import { LoginComponent } from '../login/login.component';
import { UploadFormComponent } from '../uploads/upload-form/upload-form.component';

@Component({
  selector: 'app-share',
  templateUrl: './share.component.html',
  styleUrl: './share.component.scss',
  imports: [MatDialogTitle, NgOptimizedImage, CdkScrollable, MatDialogContent, MatButton, MatTooltip, MatDivider, MatSlideToggle, MatFormField, MatLabel, MatSelect, ReactiveFormsModule, MatOption, MatHint, MatInput, MatCheckbox, UploadFormComponent, MatDialogActions, MatDialogClose]
})
export class ShareComponent {
  fb = inject(FirebaseService);
  private file_serv = inject(FileService);
  private mediaService = inject(MediaService);
  private ws = inject(WorkspaceService);
  private dialog = inject(MatDialog);
  private dialogRef = inject<MatDialogRef<ShareComponent>>(MatDialogRef);
  private data = inject(MAT_DIALOG_DATA);

  private _snackBar = inject(MatSnackBar);

  public shared_id: string = '';
  public share_obj: ShareObj = {
    id: -1,
    license: 'by',
    filename: '',
    desc: '',
    owner_uid: (this.fb.auth.currentUser) ? this.fb.auth.currentUser.uid : 'anon',
    owner_creditline: (this.fb.auth.currentUser) ? 'created by ' + this.fb.auth.currentUser.displayName : '',
    owner_url: '',
    public: false,
    img: 'none'
  }
  public share_url: string;
  public has_uploaded_image: boolean = false;

  public licenses: Array<any> = [];
  public fileid: string;

  public fc: FormControl;

  public share_in_history: ShareObj;
  public replace_img: boolean = false;

  workspaceImg: string = '/assets/example_img/placeholder.png';

  shareForm: FormGroup;

  constructor() {
    const data = this.data;


    this.fileid = data.fileid;
    this.licenses = licenses;

    // Initialize reactive form with default values
    const defaultCreditline = (this.fb.auth.currentUser) ? 'created by ' + this.fb.auth.currentUser.displayName : '';
    this.shareForm = new FormGroup({
      license: new FormControl('by'),
      filename: new FormControl(''),
      desc: new FormControl(''),
      owner_creditline: new FormControl(defaultCreditline),
      owner_url: new FormControl(''),
      public: new FormControl(false)
    });

    // Subscribe to form value changes
    this.shareForm.valueChanges.subscribe(() => {
      this.updateChange();
    });


    //CHECK IF THIS WAS, AT ANY POINT, LOADED FROM A SHARED FILE (which data is held in workspace)
    this.fb.getFileMeta(+this.fileid).then(meta => {
      if (meta.from_share == '') return;
      return this.fb.getShare(+meta.from_share);
    })
      .then(shareobj => {
        this.share_in_history = shareobj;
      })
      .catch(err => console.error(err));





    this.fb.getShare(+this.fileid)
      .then(share_obj => {
        if (share_obj !== undefined) {
          this.share_obj = share_obj;
          console.log(" FROM GET SHARE", this.share_obj)

          this.shared_id = this.fileid.toString();
          this.updateSettings(share_obj);
          this.share_url = defaults.share_url_base + this.fileid;
        }
      }).catch(no_obj => {
        this.share_obj = null;
      });





  }

  ngAfterViewInit() {


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
  updateSettings(share_obj: ShareObj) {
    // Update form values from share_obj
    this.shareForm.patchValue({
      license: share_obj.license || 'by',
      filename: share_obj.filename || '',
      desc: share_obj.desc || '',
      owner_creditline: share_obj.owner_creditline || '',
      owner_url: share_obj.owner_url || '',
      public: share_obj.public || false,
    }, { emitEvent: false }); // Don't trigger valueChanges when setting initial values

    console.log("UPDATE SETTINGS ", share_obj)
    if (share_obj.img !== 'none') {
      this.mediaService.loadImageViaURL(-1, share_obj.img).then(url => {
        this.has_uploaded_image = true;
        this.replace_img = false;
        this.workspaceImg = url;
      });
    }


    //
    //upload the image
    // if (share_obj.img !== 'none') {
    //   this.mediaService.loadImage(-1, share_obj.img).then(media => {
    //     this.has_uploaded_image = true;
    //     if (media.type == 'image') this.drawImage(<SingleImage>media.img)
    //   });
    // }

  }

  updateChange() {
    if (!this.shareForm || !this.shareForm.valid) {
      return;
    }

    // Update share_obj from form values
    this.share_obj.license = this.shareForm.get('license')?.value || 'by';
    this.share_obj.filename = this.shareForm.get('filename')?.value || '';
    this.share_obj.desc = this.shareForm.get('desc')?.value || '';
    this.share_obj.owner_creditline = this.shareForm.get('owner_creditline')?.value || '';
    this.share_obj.owner_url = this.shareForm.get('owner_url')?.value || '';
    this.share_obj.public = this.shareForm.get('public')?.value || false;

    console.log("UPDATE CHANGE ", this.share_obj)
    if (this.shared_id !== '') {
      this.fb.updateSharedFile(this.shared_id.toString(), this.share_obj);
    }
  }

  toggleSharing() {

    if (this.shared_id !== '') {
      this.removeLink();

    } else {
      this.generateLink();
    }


  }

  generateLink() {

    console.log("GENERATE LINK ", this.fileid)
    let int_id: number = +this.fileid;

    this.fb.getFileMeta(int_id).then(meta => {
      console.log("FOT FILE META", meta)
      return Promise.all([this.file_serv.saver.ada(), meta])

    }).then(so => {
      //add the current time to the author list entry 
      console.log("IN DUPLICATE ", so);
      return Promise.all([this.fb.duplicate(so[0].file, so[1]), so[1]])
    }).then(id_and_meta => {
      console.log("ID AND META ", id_and_meta)
      this.shared_id = id_and_meta[0].toString();
      this.share_obj = {
        id: +this.shared_id,
        license: 'by',
        filename: id_and_meta[1].name,
        desc: id_and_meta[1].desc,
        owner_uid: (this.fb.auth.currentUser) ? this.fb.auth.currentUser.uid : 'anon',
        owner_creditline: (this.fb.auth.currentUser) ? 'created by ' + this.fb.auth.currentUser.displayName : '',
        owner_url: '',
        public: false,
        img: 'none'
      }

      // Update form with initial values
      this.shareForm.patchValue({
        license: this.share_obj.license,
        filename: this.share_obj.filename,
        desc: this.share_obj.desc,
        owner_creditline: this.share_obj.owner_creditline,
        owner_url: this.share_obj.owner_url,
        public: this.share_obj.public
      }, { emitEvent: false });

      return this.fb.createSharedFile(this.shared_id, this.share_obj)
    }).then(share_data => {
      this.share_url = defaults.share_url_base + this.shared_id;
    }).catch(err => {
      console.log("ERROR", err)
    })

  }

  removeLink() {
    this.fb.removeSharedFile(this.fileid);
  }

  replaceImg() {
    this.replace_img = true;
  }

  formatDate(date: number) {
    var dateFormat = new Date(date);
    return dateFormat.toLocaleDateString();
  }

  /**
   * this is called by the upload services "On Data function" which uploads and analyzes the image data in the image and returns it as a image data object
   * @param obj 
   */
  handleFile(obj: MediaInstance) {

    console.log("handle file", obj);

    this.replace_img = false;
    this.has_uploaded_image = true;

    if (obj === null || obj[0].ref == null) return;

    this.share_obj.img = obj[0].ref;
    this.updateChange();
    // this.drawImage(obj[0].img.data);


    this.mediaService.loadImageViaURL(-1, this.share_obj.img).then(url => {
      this.workspaceImg = url;
    });

    //we don't need to keep this around after the upload
    this.mediaService.removeInstance(obj[0].id);




  }



  // drawImage(img: SingleImage) {

  //   const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById('img_preview');
  //   const ctx = canvas.getContext('2d');

  //   const max_dim = (img.width > img.height) ? img.width : img.height;
  //   const use_width = (img.width > 400) ? img.width / max_dim * 400 : img.width;
  //   const use_height = (img.height > 400) ? img.height / max_dim * 400 : img.height;

  //   canvas.width = use_width;
  //   canvas.height = use_height;



  //   ctx.drawImage(img.image, 0, 0, img.width, img.height, 0, 0, use_width, use_height);


  // }



  updateLink() {
    //create a share option from the settings, have it return the id, post the id to the screen. 

  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.share_url).then(
      () => {
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
