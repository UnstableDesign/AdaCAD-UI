import { AfterViewInit, Component, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { MatButton, MatIconButton, MatMiniFabButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatSliderThumb } from '@angular/material/slider';
import { MatTooltip } from '@angular/material/tooltip';
import { Draft } from 'adacad-drafting-lib';
import { getDraftName, warps, wefts } from 'adacad-drafting-lib/draft';
import { DraftNode, RenderingFlags } from '../../../core/model/datatypes';
import { saveAsBmp, saveAsPrint, saveAsWif } from '../../../core/model/helper';
import { FileService } from '../../../core/provider/file.service';
import { MaterialsService } from '../../../core/provider/materials.service';
import { RenderService } from '../../../core/provider/render.service';
import { SystemsService } from '../../../core/provider/systems.service';
import { TreeService } from '../../../core/provider/tree.service';
import { ViewerService } from '../../../core/provider/viewer.service';
import { WorkspaceService } from '../../../core/provider/workspace.service';
import { DraftRenderingComponent } from '../../../core/ui/draft-rendering/draft-rendering.component';
import { RenameComponent } from '../../../core/ui/rename/rename.component';

import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { Subscription } from 'rxjs';
import { StateService } from '../../../core/provider/state.service';
import { ZoomService } from '../../../core/provider/zoom.service';


@Component({
  selector: 'app-draftcontainer',
  templateUrl: './draftcontainer.component.html',
  styleUrls: ['./draftcontainer.component.scss'],
  imports: [MatButton, MatMiniFabButton, FormsModule, ReactiveFormsModule, MatSliderModule, MatSliderThumb, MatMenu, MatMenuItem, MatTooltip, MatIconButton, MatMenuTrigger, DraftRenderingComponent]
})
export class DraftContainerComponent implements AfterViewInit {
  private dialog = inject(MatDialog);
  private ms = inject(MaterialsService);
  private fs = inject(FileService);
  tree = inject(TreeService);
  render = inject(RenderService);
  state = inject(StateService);
  private ss = inject(SystemsService);
  private vs = inject(ViewerService);
  ws = inject(WorkspaceService);
  private zs = inject(ZoomService);


  @Input() id;
  @Input() hasParent;
  @Input() selecting_connection;
  @Output() connectionSelected = new EventEmitter();
  @Output() onDuplicateCalled = new EventEmitter();
  @Output() onDeleteCalled = new EventEmitter();
  @Output() onOpenInEditor = new EventEmitter();
  @Output() onRecomputeChildren = new EventEmitter();
  @Output() onDrawdownSizeChanged = new EventEmitter();
  @Output() onDraftVisibilityChanged = new EventEmitter();
  @Output() onNameChanged = new EventEmitter();

  @ViewChild('bitmapImage') bitmap: any;
  @ViewChild('draft_rendering') draft_rendering:
    DraftRenderingComponent;
  @ViewChild(MatMenuTrigger) trigger: MatMenuTrigger;



  // draft_cell_size: number = 40;

  globalZoomUndo: number = 1;

  exceeds_size: boolean = false;

  warps: number;

  wefts: number;

  draft_visible: boolean = true;

  use_colors: boolean = true;

  outlet_connected: boolean = true;

  draft_name: string = "";

  local_zoom: number = 1;

  // Reactive Forms control
  localZoomForm: FormControl;

  current_view: string = 'draft';

  size_observer: any;

  showingIdChangeSubscription: Subscription;

  redrawCompleteSubscription: Subscription;

  draftValueChangeSubscription: Subscription;


  constructor() {

    //subscribe to id changes on the view service to update view if this is current selected
    this.showingIdChangeSubscription = this.vs.showing_id_change$.subscribe(data => {
      this.updateStyle(data);
    })



  }

  ngOnInit() {
    // Initialize form control
    this.localZoomForm = new FormControl(1);

  }

  ngAfterViewInit() {


    const dn = this.tree.getNode(this.id) as DraftNode;


    this.outlet_connected = (this.tree.getNonCxnOutputs(this.id).length > 0);
    this.local_zoom = this.tree.getDraftScale(this.id);
    this.draft_visible = this.tree.getDraftVisible(this.id);

    // Subscribe to form control value changes
    this.localZoomForm.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.localZoomChange(value);
      }
    });

    this.draft_rendering.onNewDraftLoaded(this.id);
    this.redrawCompleteSubscription = this.draft_rendering.redrawComplete.subscribe(el => {
      this.redrawComplete();
    });


    this.draftValueChangeSubscription = dn.onValueChange.subscribe(el => {
      this.updateDraftInfo(el.draft);
    });


    // this.forceDrawDraft(draft);
    this.localZoomChange(this.local_zoom);

    this.updateDraftInfo(dn.draft);
    this.startSizeObserver();

    this.globalZoomUndo = 1 / this.zs.getMixerZoom();

  }


  //update info from a draft after it has been recomputed
  updateDraftInfo(draft: Draft) {
    if (draft === null) return;
    this.warps = warps(draft.drawdown);
    this.wefts = wefts(draft.drawdown);
    this.draft_name = getDraftName(draft);
  }




  rename(event) {

    const dialogRef = this.dialog.open(RenameComponent, {
      data: { id: this.id }
    });

    dialogRef.afterClosed().subscribe(obj => {

      this.draft_name = this.tree.getDraftName(this.id);
      this.onNameChanged.emit(this.id);
    });
  }

  onDoubleClick() {
    this.trigger.openMenu();
  }

  updateStyle(viewer_id: number) {
    const targetNode = document.getElementById("subdraft-container-" + this.id);
    if (targetNode == null) return;

    if (this.id == viewer_id) {
      targetNode.classList.add('on_view');
    } else {
      targetNode.classList.remove('on_view');
    }

    if (this.id == this.vs.getPin()) {
      targetNode.classList.add('has_pin');
    } else {
      targetNode.classList.remove('has_pin');
    }

  }


  ngOnDestroy() {


    if (this.draftValueChangeSubscription) {
      this.draftValueChangeSubscription.unsubscribe();
    }
    //unsubscribe from subscriptions
    if (this.redrawCompleteSubscription) {
      this.redrawCompleteSubscription.unsubscribe();
    }

    if (this.showingIdChangeSubscription) {
      this.showingIdChangeSubscription.unsubscribe();
    }

    this.closeSizeObserver();
  }


  startSizeObserver() {

    const targetNode = document.getElementById("drawdown-mixer-" + this.id);
    const config = { attributes: true, characterData: true, childList: false, subtree: false };
    const callback = (mutationList, observer) => {
      for (const mutation of mutationList) {
        //changed this to only listen on height because it was triggering for too many attributes
        if (mutation.type === "attributes" && mutation.attributeName === "height") {
          this.onDrawdownSizeChanged.emit(this.id);
        }
      }
    };

    this.size_observer = new MutationObserver(callback);
    this.size_observer.observe(targetNode, config);


  }

  closeSizeObserver() {
    this.size_observer.disconnect();
  }

  toggleVisibility() {
    // console.log("VIS TOGGLED", this.id,  this.draft_visible, this.ws.hide_mixer_drafts)
    this.draft_visible = !this.draft_visible;
    this.tree.setDraftVisiblity(this.id, this.draft_visible);
    this.updateDraftVisibility();


  }

  /**
   * called when visibility changes (hide or show )
   */
  updateDraftVisibility() {
    const draft = this.tree.getDraft(this.id);


    if (this.draft_rendering !== undefined && draft !== undefined && draft !== null && this.draft_visible) {
      this.draft_rendering.onNewDraftLoaded(this.id); //this will andle drawing
      if (this.redrawCompleteSubscription) {
        this.redrawCompleteSubscription.unsubscribe();
      }
      this.redrawCompleteSubscription = this.draft_rendering.redrawComplete.subscribe(el => {
        this.onDraftVisibilityChanged.emit(this.id);
        this.redrawComplete();
      });

    } else {
      this.draft_rendering.clear().then(el => {
        this.onDraftVisibilityChanged.emit(this.id);
      });

    }
  }



  nameFocusOut(event) {
  }

  connectionStarted(event) {
    this.connectionSelected.emit({ event: event, id: this.id });
  }

  hasPin(): boolean {
    if (!this.vs.hasPin) return false;
    return this.id === this.vs.getViewerId()
  }


  pinToView() {
    this.vs.setPin(this.id);

  }



  unpinFromView() {
    this.vs.clearPin();
  }


  openInEditor() {
    this.onOpenInEditor.emit(this.id)
  }



  forceDrawDraft(draft: Draft): Promise<boolean> {


    this.warps = warps(draft.drawdown);
    this.wefts = wefts(draft.drawdown);

    if (!this.tree.getDraftVisible(this.id)) return Promise.resolve(false);
    if (this.draft_rendering == null || this.draft_rendering == undefined) return Promise.resolve(false);

    const loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);


    let flags: RenderingFlags = {
      u_drawdown: true,
      u_threading: true,
      u_tieups: true,
      u_treadling: true,
      u_warp_sys: true,
      u_warp_mats: true,
      u_weft_sys: true,
      u_weft_mats: true,
      use_floats: (this.current_view == 'color'),
      use_colors: (this.current_view != 'draft'),
      show_loom: (this.current_view == 'loom'),
      use_sizes: false
    }

    //pushes to the queue
    this.draft_rendering.redraw(draft, loom, loom_settings, flags).then(el => {
      this.onDrawdownSizeChanged.emit(this.id);
    });


  }

  //emits after the queue finishes
  redrawComplete() {
    // this.tree.setDraftClean(this.id);
    this.onDrawdownSizeChanged.emit(this.id);
  }


  updateName() {
    let name = this.tree.getDraftName(this.id);
    this.draft_name = name;
  }



  async saveAsWif() {

    let draft = this.tree.getDraft(this.id);
    let loom = this.tree.getLoom(this.id);
    let loom_settings = this.tree.getLoomSettings(this.id);
    saveAsWif(this.fs, draft, loom, loom_settings)


  }

  async saveAsPrint() {
    let draft = this.tree.getDraft(this.id);

    let floats = (this.current_view == 'draft') ? false : true;
    let color = (this.current_view == 'visual') ? true : false;

    saveAsPrint(
      this.bitmap.nativeElement,
      draft,
      color,
      floats,
      this.ws.selected_origin_option,
      this.ms,
      this.ss,
      this.fs
    )
  }

  /**
   * this is called when an event happens in the render that would need to be redrawn, like a material changing, etc. 
   */
  drawdownUpdated() {
    if (!this.tree.hasParent(this.id)) {
      this.vs.updateViewer();
      this.onRecomputeChildren.emit({ event: 'edit', id: this.id });
    }
  }
  /**
 * Draws to hidden bitmap canvas a file in which each draft cell is represented as a single pixel. 
 * @returns 
 */
  async saveAsBmp(): Promise<any> {

    let b = this.bitmap.nativeElement;
    let draft = this.tree.getDraft(this.id);

    saveAsBmp(b, draft, this.ws.selected_origin_option, this.ms, this.fs)

  }

  async designActionChange(e) {

    switch (e) {
      case 'duplicate':
        this.onDuplicateCalled.emit({ event: e, id: this.id });
        break;

      case 'delete':
        this.onDeleteCalled.emit({ event: e, id: this.id });
        break;



    }
  }


  localZoomChange(event: any) {
    this.local_zoom = event;
    const dn = <DraftNode>this.tree.getNode(this.id);
    dn.scale = this.local_zoom;
    this.draft_rendering.rescale(dn.scale, 'canvas');
    this.onDrawdownSizeChanged.emit(this.id);

    // Update the form control to reflect the new value
    if (this.localZoomForm) {
      this.localZoomForm.setValue(this.local_zoom, { emitEvent: false });
    }
  }





}
