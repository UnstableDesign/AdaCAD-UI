import { Component, EventEmitter, OnInit, Output, ViewEncapsulation, inject } from '@angular/core';
import { AuthService } from '../../provider/auth.service';
import { FilesystemService } from '../../provider/filesystem.service';
import { MatDialog, MAT_DIALOG_DATA, MatDialogTitle, MatDialogClose, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { WorkspaceService } from '../../provider/workspace.service';
import { FileService } from '../../provider/file.service';
import { LoginComponent } from '../login/login.component';
import { ShareComponent } from '../share/share.component';
import { defaults } from '../../model/defaults';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatTooltip } from '@angular/material/tooltip';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-filebrowser',
    templateUrl: './filebrowser.component.html',
    styleUrls: ['./filebrowser.component.scss'],
    encapsulation: ViewEncapsulation.None,
    imports: [MatDialogTitle, CdkDrag, CdkDragHandle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatTooltip, MatMenuTrigger, MatMenu, MatMenuItem, MatFormField, MatLabel, MatInput, FormsModule, MatIconButton, MatSuffix, MatDialogActions]
})
export class FilebrowserComponent implements OnInit {
  files = inject(FilesystemService);
  auth = inject(AuthService);
  ws = inject(WorkspaceService);
  fs = inject(FileService);
  private dialog = inject(MatDialog);
  data = inject(MAT_DIALOG_DATA);

  private _snackBar = inject(MatSnackBar);

  @Output() onLoadFromDB: any = new EventEmitter();
  @Output() onCreateFile: any = new EventEmitter();
  @Output() onDuplicateFile: any = new EventEmitter();
  @Output() onShareFile: any = new EventEmitter();
  @Output() onLoadMostRecent: any = new EventEmitter();

  
  unopened_filelist = [];
  shared_filelist = [];
  file_list = [];



  rename_mode_id = -1;
  rename_file_name ="";


  constructor() { 
    

      this.updateFileData(this.files.file_tree)

      this.files.file_tree_change$.subscribe(data => {
        this.updateFileData(data);});

  
      this.files.shared_file_change$.subscribe(data => {
        this.updateFileData(data);});


  }

  ngOnInit(): void {
    
    
    
  }

  shareWorkspace(file_id: number){


    const dialogRef = this.dialog.open(ShareComponent, {
      width: '600px',
      data: {fileid: file_id}
    });
  }

  openLoginDialog() {
    const dialogRef = this.dialog.open(LoginComponent, {
      width: '600px',
    });
  }

  createBlankFile(){
    this.onCreateFile.emit();
  }

  openMostRecent(){
    this.onLoadMostRecent.emit();
  }

  /**
   * takes an array of file data and parses it into lists
   * @param data 
   */
  updateFileData(data: Array<any>){
    this.unopened_filelist = [];
    this.shared_filelist = [];

    this.file_list = [];
    data.forEach(file => {
      this.file_list.push(file);

        if(file.shared == undefined) this.unopened_filelist.push(file);
        else this.shared_filelist.push(file);
      })

  }

  editSharedFile(id: number){

    const dialogRef = this.dialog.open(ShareComponent, {
      width: '600px',
      data: {fileid:id}
    });


  }


  unshare(id: number){
    this.files.removeSharedFile(id.toString());
  }


  openFile(id: number){
    this.onLoadFromDB.emit(id);
  }

  duplicate(id: number){
    this.onDuplicateFile.emit(id);
  }




  rename(id: number){
    let file_to_rename = this.file_list.find(el => el.id == id);

      if(file_to_rename !== undefined){

        if(this.rename_mode_id !== -1){

        this.files.renameFile(file_to_rename.id, this.rename_file_name);
        this.rename_mode_id = -1;
        this.rename_file_name = '';

        }else{
          this.rename_file_name = file_to_rename.meta.name;
          this.rename_mode_id = id;
        }
      }
  }

  remove(fileid: number){
    this.files.removeFile(fileid);
  }

    /**
   * this is called when a user pushes save from the topbar
   * @param event 
   */
  public  exportWorkspace(id: number){

    const link = document.createElement('a')

    let fns = [ this.files.getFile(id), this.files.getFileMeta(id)];
    Promise.all(fns)
    .then(res => {
      var theJSON = JSON.stringify(res[0]);
      link.href = "data:application/json;charset=UTF-8," + encodeURIComponent(theJSON);
      link.download =  res[1].name + ".ada";
      link.click();
    }).catch(err => {console.error(err)});

  


  
  
    }

    openSnackBar(message: string, action: string) {
      this._snackBar.open(message, action);
    }

    
    copyToClipboard(id: number){
      const share_url = defaults.share_url_base+id;
      navigator.clipboard.writeText(share_url)
      .then(
        ()=> {
           this.openSnackBar('link copied', 'close')//on success
        },
        () => {
          //on fail 
          this.openSnackBar('could not copy link', 'close')//on success

        }
      )

    }  
     /**
   * this is called when a user pushes save from the topbar
   * @param event 
   */
  public  exportSharedWorkspace(id: number){

    const link = document.createElement('a')      

      let fns = [ this.files.getFile(id), this.files.isShared(id.toString())];
      Promise.all(fns)
      .then(res => {
        var theJSON = JSON.stringify(res[0]);
        link.href = "data:application/json;charset=UTF-8," + encodeURIComponent(theJSON);
        link.download =  res[1].filename + ".ada";
        link.click();
      }).catch(err => {console.error(err)});




  
  
    }
  

  

}
