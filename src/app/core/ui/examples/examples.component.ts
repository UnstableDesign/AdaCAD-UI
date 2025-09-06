import { Component, EventEmitter, Output, inject } from '@angular/core';
import { ExampleserviceService } from '../../provider/exampleservice.service';
import { MatDialog, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';
import { FilesystemService } from '../../provider/filesystem.service';
import { MediaService } from '../../provider/media.service';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatTabGroup, MatTab } from '@angular/material/tabs';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardActions } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { SingleImage } from 'adacad-drafting-lib/objects/datatypes.ts';

@Component({
    selector: 'app-examples',
    templateUrl: './examples.component.html',
    styleUrls: ['./examples.component.scss'],
    imports: [MatDialogTitle, CdkDrag, CdkDragHandle, CdkScrollable, MatDialogContent, MatTabGroup, MatTab, MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardActions, MatButton, MatDialogActions, MatDialogClose]
})
export class ExamplesComponent {
  fs = inject(FilesystemService);
  examples = inject(ExampleserviceService);
  private ms = inject(MediaService);
  private dialog = inject(MatDialog);
  dialogRef = inject<MatDialogRef<ExamplesComponent>>(MatDialogRef);

  @Output() onLoadExample = new EventEmitter <any>(); 
  @Output() onLoadSharedFile = new EventEmitter <any>(); 
  @Output() onOpenFileManager = new EventEmitter <any>(); 
  local_examples: any;
  community_examples: any;


  constructor() {
      const examples = this.examples;

      
      this.local_examples = examples.getExamples();
      this.community_examples = this.fs.public_files.slice();
    

      this.community_examples.filter(res => res.val.img !== 'none').forEach(res => {
        this.ms.loadImage(-1, res.val.img).then(media => {
          console.log("GOT MEDIA INSTANCE ",media)
          if(media.type = 'image') this.drawImage(res.id, <SingleImage> media.img)

        });
      });


      this.fs.public_file_change$.subscribe(data => {
        this.community_examples = data;
      });

  }

  openFileManager(){

    this.onOpenFileManager.emit();
  }

  loadExample(filename: string){
    
    this.onLoadExample.emit(filename);
    this.dialogRef.close();
  }

  loadSharedFile(filename: string){
    
    this.onLoadSharedFile.emit(filename);
    this.dialogRef.close();
  }






  

  drawImage(id: number, img: SingleImage){



      const canvas: HTMLCanvasElement =  <HTMLCanvasElement> document.getElementById('img_preview'+id);
      const ctx = canvas.getContext('2d');
  
      const max_dim = (img.width > img.height) ? img.width : img.height;
      const use_width = (img.width > 400) ? img.width / max_dim * 400 : img.width;
      const use_height = (img.height > 400) ? img.height / max_dim * 400 : img.height;
  
      canvas.width = use_width;
      canvas.height = use_height;
  
  
  
      ctx.drawImage(img.image, 0, 0, img.width, img.height, 0, 0, use_width, use_height);
  
  }


}

