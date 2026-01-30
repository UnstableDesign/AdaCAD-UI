import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { NgOptimizedImage } from '@angular/common';
import { Component, EventEmitter, OnDestroy, Output, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { Subscription } from 'rxjs';
import { ShareObj } from '../../model/datatypes';
import { ExampleserviceService } from '../../provider/exampleservice.service';
import { FirebaseService } from '../../provider/firebase.service';
import { MediaService } from '../../provider/media.service';


@Component({
  selector: 'app-examples',
  templateUrl: './examples.component.html',
  styleUrls: ['./examples.component.scss'],
  imports: [NgOptimizedImage, MatDialogTitle, CdkDrag, CdkDragHandle, CdkScrollable, MatDialogContent, MatTabGroup, MatTab, MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardActions, MatButton, MatDialogActions, MatDialogClose]
})
export class ExamplesComponent implements OnDestroy {
  fb = inject(FirebaseService);
  examples = inject(ExampleserviceService);
  private ms = inject(MediaService);
  private dialog = inject(MatDialog);
  dialogRef = inject<MatDialogRef<ExamplesComponent>>(MatDialogRef);

  @Output() onLoadExample = new EventEmitter<any>();
  @Output() onLoadSharedFile = new EventEmitter<any>();
  @Output() onOpenFileManager = new EventEmitter<any>();
  local_examples: any;

  sharedFileSubscription: Subscription;
  community_examples: Array<ShareObj> = [];
  exampleImgs: Array<any> = [];
  placeholderImg: string = '/assets/example_img/placeholder.png'

  constructor() {
    const examples = this.examples;

    this.local_examples = examples.getExamples();




  }

  ngAfterViewInit() {

    this.sharedFileSubscription = this.fb.sharedFilesChangeEvent$.subscribe(files => {
      this.community_examples = files.public.slice();
      this.exampleImgs = [];
      let img_fns = [];

      this.community_examples.forEach(ex => {
        let img_src = (ex.img !== "none") ? this.ms.loadImageViaURL(-1, ex.img).then(url => { return url }) : '';
        img_fns.push(img_src);
      })

      Promise.all(img_fns).then(outs => {
        this.exampleImgs = outs;
      })


    })

  }

  ngOnDestroy(): void {
    this.sharedFileSubscription.unsubscribe();
  }

  openFileManager() {

    this.onOpenFileManager.emit();
  }

  loadExample(filename: string) {

    this.onLoadExample.emit(filename);
    this.dialogRef.close();
  }

  loadSharedFile(filename: string) {

    this.onLoadSharedFile.emit(filename);
    this.dialogRef.close();
  }

  openDocs(url: string) {
    let formatted_url = ""
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      formatted_url = "http://" + url;
    } else {
      formatted_url = url;
    }
    window.open(url)
  }



}

