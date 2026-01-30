import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component, inject } from '@angular/core';
import { MatOption } from '@angular/material/autocomplete';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatSelect } from '@angular/material/select';
import { AnalyzedImage, Color, filterToUniqueValues } from 'adacad-drafting-lib';
import { MediaService } from '../../provider/media.service';
import { TreeService } from '../../provider/tree.service';

@Component({
  selector: 'app-imageeditor',
  templateUrl: './imageeditor.component.html',
  styleUrl: './imageeditor.component.scss',
  imports: [MatDialogTitle, CdkDrag, CdkDragHandle, CdkScrollable, MatDialogContent, MatFormField, MatLabel, MatSelect, MatOption, MatDialogActions, MatButton, MatDialogClose]
})
export class ImageeditorComponent {
  tree = inject(TreeService);
  mediaService = inject(MediaService);
  private dialog = inject(MatDialog);
  dialogRef = inject<MatDialogRef<ImageeditorComponent>>(MatDialogRef);
  obj = inject(MAT_DIALOG_DATA);


  media_id: number;
  img: AnalyzedImage;
  color_table: Array<{ from: number, from_hex: string, to: number, to_hex: string }>;
  resulting_color_space: Array<{ from: number, from_hex: string, to: number, to_hex: string }>;
  editable: boolean = true;

  constructor() {
    const obj = this.obj;



    if (obj.src == 'bwimagemap') {
      this.editable = false;
    }

    this.media_id = obj.media_id;
    const media_item = this.mediaService.getMedia(this.media_id);
    this.img = <AnalyzedImage>media_item.img;

    this.parseColorTable(this.img.colors, this.img.colors_mapping);
    this.updateColormapping(this.img.colors, this.img.colors_mapping);

  }

  ngAfterViewInit() {
    this.drawImagePreview();
  }

  /**
   * create a new version of the color table suited for rendering 
   * @param colors 
   * @param mapping 
   */
  parseColorTable(colors: Array<Color>, mapping: Array<{ from: number, to: number }>) {

    this.color_table = [];
    mapping.forEach(el => {
      this.color_table.push({
        from: el.from,
        from_hex: colors[el.from].hex,
        to: el.to,
        to_hex: colors[el.to].hex
      }
      )
    })

  }

  /**
   * after any mapping is made, update which options are visible in the mapped region
   */
  updateColormapping(colors: Array<Color>, mapping: Array<{ from: number, to: number }>) {
    const unique_colors: Array<number> = <Array<number>>filterToUniqueValues(mapping.map(el => el.to));

    this.resulting_color_space = [];
    unique_colors.forEach(el => {
      let map_entry = mapping.find(meel => meel.to == el)
      this.resulting_color_space.push({
        from: map_entry.from,
        from_hex: colors[map_entry.from].hex,
        to: map_entry.to,
        to_hex: colors[map_entry.to].hex
      }
      )
    })
  }

  mappingChanged(src: number, $event) {
    console.log("EVENT", src, $event)
    let el = this.img.colors_mapping.find(el => el.from == src);
    if (el == undefined) return;
    el.to = $event.value;

    this.mediaService.updateIndexColorMediaInstance(this.media_id, this.img);

    this.updateColormapping(this.img.colors, this.img.colors_mapping)
  }


  drawImagePreview() {


    const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById('preview_canvas');
    const ctx = canvas.getContext('2d');



    canvas.width = this.img.width;
    canvas.height = this.img.height;


    ctx.drawImage(this.img.image, 0, 0, this.img.width, this.img.height);




  }

}
