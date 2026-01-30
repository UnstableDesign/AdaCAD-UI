import { Component, inject, Input, ViewChild } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatMenu, MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { Draft } from 'adacad-drafting-lib';
import { Subscription } from 'rxjs';
import { saveAsBmp, saveAsColoringPage, saveAsPng, saveAsPrint, saveAsWif } from '../../model/helper';
import { FileService } from '../../provider/file.service';
import { MaterialsService } from '../../provider/materials.service';
import { SystemsService } from '../../provider/systems.service';
import { TreeService } from '../../provider/tree.service';
import { WorkspaceService } from '../../provider/workspace.service';

@Component({
  selector: 'app-download',
  imports: [MatMenu, MatButton, MatIconButton, MatMenuTrigger, MatTooltip, MatMenuModule],
  templateUrl: './download.component.html',
  styleUrl: './download.component.scss'
})
export class DownloadComponent {

  @ViewChild('bitmapImage') bitmap: any;

  private fs = inject(FileService);
  private tree = inject(TreeService);
  private ws = inject(WorkspaceService);
  private ms = inject(MaterialsService);
  private sys_serve = inject(SystemsService);
  @Input() origin: string; //where is this being called from
  @Input() ids: Array<number>; //which id's are currently selected
  @Input() workspaceName: string; //the metadata for the workspace

  workspaceNameSubscription: Subscription;


  ngOnInit() {


    this.workspaceNameSubscription = this.ws.onFilenameUpdated$.subscribe((name) => {
      this.workspaceName = name;
    });


  }

  ngOnDestroy() {
    this.workspaceNameSubscription.unsubscribe();
  }

  /**
 * this is called when a user pushes save from the topbar
 * @param event 
 */
  public async downloadWorkspace(type: any): Promise<any> {

    const link = document.createElement('a')


    switch (type) {
      // case 'jpg': 

      // //this.printMixer();

      // break;

      // case 'wif': 
      //    this.mixer.downloadVisibleDraftsAsWif();
      //    return Promise.resolve(null);
      // break;

      case 'ada':
        const filename = this.workspaceName;
        this.fs.saver.ada().then(out => {
          link.href = "data:application/json;charset=UTF-8," + encodeURIComponent(out.json);
          link.download = filename + ".ada";
          link.click();
        })
        break;
    }
  }


  saveDraftAs(format: string) {


    this.ids.forEach(id => {
      let draft: Draft = this.tree.getDraft(id);
      let b = this.bitmap.nativeElement;

      switch (format) {
        case 'png':
          saveAsPng(b, draft, this.ws.selected_origin_option, this.ms, this.fs) //currently not used, was just testing. 
          break;
        case 'bmp':
          saveAsBmp(b, draft, this.ws.selected_origin_option, this.ms, this.fs);
          break;
        case 'jpg-draft':
          saveAsPrint(b, draft, false, false, this.ws.selected_origin_option, this.ms, this.sys_serve, this.fs)
          break;
        case 'jpg-floats':
          saveAsPrint(b, draft, true, false, this.ws.selected_origin_option, this.ms, this.sys_serve, this.fs)
          break;
        case 'jpg-colors':
          saveAsPrint(b, draft, true, true, this.ws.selected_origin_option, this.ms, this.sys_serve, this.fs)
          break;
        case 'coloring_page':
          saveAsColoringPage(b, draft, this.ms, this.sys_serve, this.fs)
          break;
        case 'wif':
          let loom = this.tree.getLoom(id);
          let loom_settings = this.tree.getLoomSettings(id);
          saveAsWif(this.fs, draft, loom, loom_settings)
          break;
      }

    });




  }


}



