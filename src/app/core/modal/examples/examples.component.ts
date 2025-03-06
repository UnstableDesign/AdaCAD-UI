import { Component, EventEmitter, Output } from '@angular/core';
import { ExampleserviceService } from '../../provider/exampleservice.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { FilesystemService } from '../../provider/filesystem.service';
import { MediaService } from '../../provider/media.service';
import { SingleImage } from '../../model/datatypes';
import { FilebrowserComponent } from '../../ui/filebrowser/filebrowser.component';

@Component({
  selector: 'app-examples',
  templateUrl: './examples.component.html',
  styleUrls: ['./examples.component.scss']
})
export class ExamplesComponent {
  @Output() onLoadExample = new EventEmitter <any>(); 
  @Output() onLoadSharedFile = new EventEmitter <any>(); 
  @Output() onOpenFileManager = new EventEmitter <any>(); 
  local_examples: any;
  community_examples: any;


  constructor(
    public fs: FilesystemService,
    public examples: ExampleserviceService,
    private ms: MediaService,
    private dialog: MatDialog,
    public dialogRef: MatDialogRef<ExamplesComponent>) {
      
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

