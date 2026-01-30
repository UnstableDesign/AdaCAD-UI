import { Directive, EventEmitter, HostListener, Output, inject } from '@angular/core';
import { FileService } from './provider/file.service';
import { FirebaseService } from './provider/firebase.service';
import { StateService } from './provider/state.service';
import { ViewadjustService } from './provider/viewadjust.service';
import { WorkspaceService } from './provider/workspace.service';

@Directive({ selector: 'appKeycodes' })
export class EventsDirective {
  private fs = inject(FileService);
  private ss = inject(StateService);
  private vas = inject(ViewadjustService);
  private fb = inject(FirebaseService)
  private ws = inject(WorkspaceService)

  mixer_has_focus = true;
  event_on_input_flag = false;

  @Output() onUndo: any = new EventEmitter();
  @Output() onRedo: any = new EventEmitter();
  @Output() zoomOut: any = new EventEmitter();
  @Output() zoomIn: any = new EventEmitter();
  @Output() onBump: any = new EventEmitter();
  @Output() updateMixerView: any = new EventEmitter();
  @Output() updateDetailView: any = new EventEmitter();
  @Output() onCopySelections: any = new EventEmitter();
  @Output() onPasteSelections: any = new EventEmitter();
  @Output() onDrawModeChange: any = new EventEmitter();
  @Output() onExplode: any = new EventEmitter();
  @Output() onWindowResize: any = new EventEmitter();
  @Output() onPan: any = new EventEmitter();
  @Output() onEditorModeChange: any = new EventEmitter();

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.vas.updateFromWindowResize(event.target.innerWidth);
    this.onWindowResize.emit();
  }

  /**
  * check the series of the targets for this mouse or key event and see if it tracks to 
  */


  @HostListener('window:keydown', ['$event'])
  public keyEventDetected(e) {

    // ignore arrow keys if user is in an input field
    const isInputField = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;

    // arrow key panning
    if (!isInputField && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const panAmount = 50; // pixels
      const direction = {
        'ArrowUp': { x: 0, y: -panAmount },
        'ArrowDown': { x: 0, y: panAmount },
        'ArrowLeft': { x: -panAmount, y: 0 },
        'ArrowRight': { x: panAmount, y: 0 }
      };
      e.preventDefault();
      this.onPan.emit(direction[e.key]);
      return false;
    }

    /**
    * ZOOM IN
    */
    if ((e.key == "=" || e.key == "+") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      this.zoomIn.emit();
      return false;
    }

    /**
    *  ZOOM OUT
    */
    if ((e.key == "-" || e.key == "_") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      this.zoomOut.emit();
      return false;
    }

    /**
*  ZOOM OUT 
*/
    if (e.key == "b" && (e.metaKey || e.ctrlKey)) {

      this.onBump.emit();
      return false;

    }



    /**
    * SAVE
    */
    if (e.key == "s" && (e.metaKey || e.ctrlKey)) {
      this.fs.saver.ada()
        .then(so => {
          return this.fb.updateFile(so.file, this.ws.getCurrentFile());
        })
        .catch(err => console.error(err));
      e.preventDefault();
    }



    /**
    * UNDO
    */
    if (e.key == "z" && (e.metaKey || e.ctrlKey)) {
      this.onUndo.emit();
    }



    /**
    * Toggle Design Mode to SElect Regions if in Editor Mode
    */
    if (e.key == "r" && (e.metaKey || e.ctrlKey)) {
      this.onEditorModeChange.emit('select');
    }



    /**
    * Toggle Design Mode to SElect Regions if in Editor Mode
    */
    if (e.key == "d" && (e.metaKey || e.ctrlKey)) {
      this.onEditorModeChange.emit('draw');
      e.preventDefault();
    }


    /**
* REDO
*/
    if (e.key == "y" && (e.metaKey || e.ctrlKey)) {
      this.onRedo.emit();
    }





    /**
    * Copy
    */
    if (e.key == "c" && (e.metaKey || e.ctrlKey)) {
      this.onCopySelections.emit();
    }

    /**
    * PASTE
    */
    if (e.key == "v" && (e.metaKey || e.ctrlKey)) {
      this.onPasteSelections.emit();
    }


    /**
    * Explode (move every top left position by a factor of 10 (a hack to work with older files))
    */
    if (e.key == "e" && (e.metaKey || e.ctrlKey)) {
      this.onExplode.emit();
    }



  }
}