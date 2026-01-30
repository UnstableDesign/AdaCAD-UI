import { Component, EventEmitter, inject, Output, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule, MatIconButton, MatMiniFabButton } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSlider, MatSliderThumb } from '@angular/material/slider';
import { MatTooltip } from '@angular/material/tooltip';
import { Draft, getDraftName, warps, wefts } from 'adacad-drafting-lib/draft';
import { Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';
import { DraftNode, RenderingFlags } from '../core/model/datatypes';
import { FirebaseService } from '../core/provider/firebase.service';
import { OperationService } from '../core/provider/operation.service';
import { StateService } from '../core/provider/state.service';
import { SystemsService } from '../core/provider/systems.service';
import { TreeService } from '../core/provider/tree.service';
import { ViewerService } from '../core/provider/viewer.service';
import { WorkspaceService } from '../core/provider/workspace.service';
import { ZoomService } from '../core/provider/zoom.service';
import { DraftRenderingComponent } from '../core/ui/draft-rendering/draft-rendering.component';
import { RenameComponent } from '../core/ui/rename/rename.component';
import { SimulationComponent } from './simulation/simulation.component';

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss'],
  imports: [ReactiveFormsModule, MatIconButton, MatButtonModule, MatSlideToggleModule, MatButtonToggleModule, MatExpansionModule, MatFormFieldModule, MatInputModule, MatTooltip, DraftRenderingComponent, SimulationComponent, MatSlider, MatSliderThumb, MatMiniFabButton]
})
export class ViewerComponent {
  private tree = inject(TreeService);
  ws = inject(WorkspaceService);
  vs = inject(ViewerService);
  zs = inject(ZoomService);
  fb = inject(FirebaseService);
  ss = inject(StateService);
  ops = inject(OperationService);
  private dialog = inject(MatDialog);
  private systemsService = inject(SystemsService);


  @Output() onOpenEditor: any = new EventEmitter();
  @Output() onDraftRename: any = new EventEmitter();
  @Output() onSave: any = new EventEmitter();
  @Output() onForceFocus: any = new EventEmitter();

  @ViewChild(SimulationComponent) sim: SimulationComponent;
  @ViewChild('view_rendering') view_rendering: DraftRenderingComponent;

  // Reactive form for viewer controls

  draft_canvas: HTMLCanvasElement;
  draft_name: string = '';
  draft_notes: string = '';
  draft_cx: any;
  pixel_ratio: number = 1;
  view_controls_visible: boolean = false;
  filename: string = '';
  zoomLevel: FormControl;
  visMode: FormControl;
  viewFace: FormControl;
  useSizes: FormControl;
  warps: number = 0;
  wefts: number = 0;
  scale: number = 0;
  before_name: string = '';
  before_notes: string = '';
  idChangeSubscription: Subscription;
  updateViewerSubscription: Subscription;
  draftValueChangeSubscription: Subscription;
  redrawCompleteSubscription: Subscription;

  simControlsVisible: boolean = false;
  //Sim Controls
  // weftsAsWrittenForm: FormControl;
  // liftLimitForm: FormControl;
  // packForm: FormControl;
  // massForm: FormControl;
  // maxThetaForm: FormControl;

  epiUnits: string = "ends / 10cm";

  constructor() {

    this.idChangeSubscription = this.vs.showing_id_change$.subscribe(data => {
      if (data == -1) this.clearDraft();
      else this.loadDraft(data);
    })




    this.zoomLevel = new FormControl(0);
    this.visMode = new FormControl(this.vs.current_view);
    this.viewFace = new FormControl(this.vs.view_face);
    this.useSizes = new FormControl(this.vs.use_sizes);

  }

  ngOnDestroy() {
    if (this.redrawCompleteSubscription) this.redrawCompleteSubscription.unsubscribe();
    this.idChangeSubscription.unsubscribe();
    this.updateViewerSubscription.unsubscribe();
    if (this.draftValueChangeSubscription) this.draftValueChangeSubscription.unsubscribe();

  }






  ngOnInit() {


    this.useSizes.valueChanges.subscribe(value => {
      console.log("USE SIZES VALUE CHANGED", value);
      if (value !== null && value !== undefined) {
        this.vs.use_sizes = value as 'actual' | 'standard';
        if (this.view_rendering !== undefined) this.view_rendering.use_sizes = value === 'actual';
        this.forceRedraw();
      }
    });


    this.viewFace.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.swapViewFace(value);
      }
    });


    this.zoomLevel.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.zs.setZoomIndexOnViewer(value);
        this.zoomChange();
      }
    });


    this.visMode.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined) {
        this.vs.current_view = value;
        if (this.view_rendering !== undefined) {
          this.view_rendering.current_view = value;
        }
        if (this.vs.current_view === 'sim') {
          this.sim.onFocus(this.vs.getViewerId());
        } else {
          if (this.sim.hasFocus) this.sim.onFocusOut()
          this.forceRedraw();
        }
      }
    });


    this.updateDraftData(this.vs.getViewerId());


  }

  ngAfterViewInit() {
    this.view_rendering.use_sizes = this.vs.use_sizes === 'actual';
  }


  toggleSimControls() {
    this.simControlsVisible = !this.simControlsVisible;
  }

  swapViewFace(face: 'front' | 'back') {
    this.vs.view_face = face;
    this.forceRedraw(face == 'front')
      .catch(console.error);
  }

  toggleViewControls() {
    this.view_controls_visible = !this.view_controls_visible;
  }


  getVisVariables() {
    switch (this.vs.current_view) {
      case 'sim':
        return { use_colors: false, floats: false };
      case 'draft':
        return { use_colors: false, floats: false };
      case 'structure':
        return { use_colors: false, floats: true };
      case 'visual':
        return { use_colors: true, floats: true };
    }
  }



  updateDraftNameFromMixerEvent(name: string) {
    this.draft_name = name;
    this.before_name = name;

  }

  updateDraftNotesFromMixerEvent(notes: string) {
    this.draft_notes = notes;
    this.before_notes = notes;

  }


  private clearDraft() {
    //clear draft here
  }



  updateDraftData(id: number) {
    const draft = this.tree.getDraft(id);
    if (draft == null) return;

    this.before_name = getDraftName(this.tree.getDraft(id));
    this.before_notes = this.tree.getDraftNotes(id);
    this.draft_name = this.before_name;
    this.draft_notes = this.before_notes;
    this.warps = warps(draft.drawdown);
    this.wefts = wefts(draft.drawdown);
    this.epiUnits = this.tree.getLoomSettings(id).units === 'in' ? 'ends / inch' : 'ends / 10cm';



  }


  private loadDraft(id: number) {

    const draftNode = this.tree.getNode(id) as DraftNode;
    if (draftNode.type !== 'draft') return;

    if (this.view_rendering !== undefined) {
      this.view_rendering.clearAll();
      this.view_rendering.onNewDraftLoaded(id); //this is going to subscribe and redraw the front view
      this.redrawCompleteSubscription = this.view_rendering.redrawComplete.subscribe(draft => {
        this.centerScrollbars();
      });
    }

    //subscribe to future updates on the draft so the UI can update info about size changes, etc. 
    if (this.draftValueChangeSubscription) this.draftValueChangeSubscription.unsubscribe();
    this.draftValueChangeSubscription = draftNode.onValueChange.pipe(skip(1)).subscribe(draftNodeBroadcast => {
      this.updateDraftData(id);
    });

    // Load the draft immediately if in sim mode (skip the initial BehaviorSubject emission)
    if (this.vs.current_view == 'sim') {
      this.sim.onNewDraftLoaded(id);
    }
  }


  centerScrollbars() {
    // Skip if no draft is selected or in simulation mode
    if (this.vs.getViewerId() === -1 || this.vs.current_view === 'sim') {
      return;
    }

    // Hide draft rendering until zoom is calculated

    // Use a recursive function to wait for elements to be ready
    const attemptCenter = (attempts: number = 0) => {
      const maxAttempts = 50; // Try for up to 5 seconds (50 * 100ms)

      // Get the container and draft rendering elements
      const container = document.getElementById('viewer-scale-container');
      const draftId = this.vs.getViewerId();
      const draftContainer = document.getElementById(`draft-scale-container-viewer-${draftId}`);

      if (!container || !draftContainer) {
        if (attempts < maxAttempts) {
          setTimeout(() => {
            attemptCenter(attempts + 1);
          }, 100);
        } else {
          // Show draft rendering even if we couldn't calculate zoom
        }
        return;
      }

      // Get container dimensions
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;

      // Get the canvas element to get its actual dimensions (not scaled)
      const canvas = document.getElementById(`drawdown-viewer-${draftId}`) as HTMLCanvasElement;

      if (!canvas) {
        if (attempts < maxAttempts) {
          setTimeout(() => {
            attemptCenter(attempts + 1);
          }, 100);
        }
        return;
      }

      // Get the actual canvas dimensions (width and height properties, not CSS dimensions)
      const baseDraftWidth = canvas.width;
      const baseDraftHeight = canvas.height;

      // Check if dimensions are valid (greater than 0)
      if (containerWidth === 0 || containerHeight === 0 || baseDraftWidth === 0 || baseDraftHeight === 0) {
        if (attempts < maxAttempts) {
          setTimeout(() => {
            attemptCenter(attempts + 1);
          }, 100);
        } else {
          // Show draft rendering even if we couldn't calculate zoom
        }
        return;
      }

      // Get current zoom
      const currentZoomIndex = this.zoomLevel.value;
      const currentZoom = this.zs.zoom_table[currentZoomIndex];
      const minZoom = this.zs.getZoomMin();

      // Calculate zoom factors needed to fit
      const widthFactor = containerWidth / baseDraftWidth;
      const heightFactor = containerHeight / baseDraftHeight;
      const fitZoom = Math.min(widthFactor, heightFactor);

      // Find the largest zoom index that still fits
      let bestZoomIndex = 0;

      // Access zoom_table through the service (it's a public array)
      const zoomTable = (this.zs as any).zoom_table;

      if (zoomTable && zoomTable.length > 0) {
        for (let i = 0; i < zoomTable.length; i++) {
          const zoomValue = zoomTable[i];
          const scaledWidth = baseDraftWidth * zoomValue;
          const scaledHeight = baseDraftHeight * zoomValue;

          // Check if this zoom fits within the container
          if (scaledWidth <= containerWidth && scaledHeight <= containerHeight) {
            bestZoomIndex = i;
          } else {
            // Once we exceed, stop
            break;
          }
        }
      }

      // Set the zoom if it's different from current
      if (bestZoomIndex !== currentZoomIndex) {
        this.zs.setZoomIndexOnViewer(bestZoomIndex);
        this.zoomLevel.setValue(bestZoomIndex, { emitEvent: false });
        this.zoomChange();
        // Show draft rendering after zoom change is applied
        setTimeout(() => {
        }, 50);
      } else {
        // Show draft rendering immediately if zoom didn't change
      }
    };

    // Start the attempt with a small delay to let the DOM update
    requestAnimationFrame(() => {
      setTimeout(() => {
        attemptCenter(0);
      }, 50);
    });
  }

  filenameChange() {
    this.ws.setCurrentFileName(this.filename);
    //check for connection?
  }


  viewAsSimulation() {
    this.visMode.setValue('sim');
  }

  viewAsDraft() {
    this.visMode.setValue('draft');
  }

  viewAsStructure() {
    this.visMode.setValue('structure');
  }

  viewAsColor() {
    this.visMode.setValue('color');
  }



  openEditor() {
    this.onOpenEditor.emit(this.vs.getViewerId());
  }

  /**
   * called when the pin button is pressed
   * if the viewer has a pin, it will clear the pin
   * otherwise, it will set the pin to the current viewer id
   */
  onTogglePinPressed() {
    if (this.vs.hasPin) {
      this.vs.clearPin();
    } else {
      this.vs.setPin(this.vs.getViewerId())
    }
  }

  openNameChangeDialog() {

    const dialogRef = this.dialog.open(RenameComponent, {
      data: { id: this.vs.getViewerId() }
    });

    dialogRef.afterClosed().subscribe(obj => {


      this.draft_name = this.tree.getDraftName(this.vs.getViewerId());
      this.onDraftRename.emit(this.vs.getViewerId());
    });


    this.onDraftRename.emit(this.vs.getViewerId());


  }


  clearView() {

    if (this.view_rendering !== undefined) this.view_rendering.clearAll();
    //this.viewerForm.patchValue({ draftName: 'no draft selected' });
    this.warps = 0;
    this.wefts = 0;
  }

  saveAs(format: string) {
    this.onSave.emit(format);
  }

  //when expanded, someone can set the zoom from the main zoom bar
  //this is called, then, to rescale the view
  zoomChange() {

    this.scale = this.zs.getViewerZoom();
    this.view_rendering.scale = this.scale;
    const out_format = (!this.getVisVariables().floats && !this.getVisVariables().use_colors) ? 'canvas' : 'array_buffer';
    this.view_rendering.rescale(this.scale, out_format);
  }

  /**
   * draw whatever is stored in the draft object to the screen
   */
  public forceRedraw(front: boolean = true): Promise<any> {

    const draft: Draft = this.tree.getDraft(this.vs.getViewerId());
    const loom = this.tree.getLoom(this.vs.getViewerId());
    const loom_settings = this.tree.getLoomSettings(this.vs.getViewerId());

    if (draft == null || draft == undefined) {
      this.clearView();
      return Promise.resolve(false);
    }


    let flags: RenderingFlags = {
      u_drawdown: true,
      u_threading: true,
      u_tieups: true,
      u_treadling: true,
      u_warp_sys: true,
      u_warp_mats: true,
      u_weft_sys: true,
      u_weft_mats: true,
      use_floats: (this.vs.current_view !== 'draft'),
      use_colors: (this.vs.current_view == 'visual'),
      show_loom: false,
      use_sizes: this.vs.use_sizes === 'actual'
    }



    //if we are looking at the back face, invert and flip the draft
    if (!front) {
      const invert_op = this.ops.getOp('invert');
      const params = [];
      const drafts = [{
        drafts: [draft],
        inlet_id: 0,
        inlet_params: []
      }]

      return invert_op.perform(params, drafts).then(manipulated_draft => {
        const dd = manipulated_draft[0].draft;
        const flip_op = this.ops.getOp('flip');
        const flip_params = [{
          param: flip_op.params[0],
          val: 1
        },
        {
          param: flip_op.params[1],
          val: 0
        },];
        const flip_drafts = [{
          drafts: [dd],
          inlet_id: 0,
          inlet_params: []
        }]

        return flip_op.perform(flip_params, flip_drafts)
      }).then(manipulated_draft => {
        const dd = manipulated_draft[0].draft;

        return this.view_rendering.redraw(dd, null, loom_settings, flags).then(el => {
          return Promise.resolve(true);
        })
      });


    } else {
      console.log("REDRAW CALLED FROM VIEW RENDERING")

      return this.view_rendering.redraw(draft, loom, loom_settings, flags).then(el => {
        return Promise.resolve(true);
      })
    }






  }

}




