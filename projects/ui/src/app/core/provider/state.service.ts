import { Injectable, inject } from '@angular/core';
import { Draft } from 'adacad-drafting-lib';
import { Subject } from 'rxjs';
import { ConnectionExistenceChange, ConnectionStateEvent, DraftExistenceChange, DraftStateAction, DraftStateChange, DraftStateEvent, DraftStateNameOrNotesChange, FileMetaStateAction, FileMetaStateChange, MaterialsStateAction, MaterialsStateChange, MixerStateChangeEvent, MixerStateDeleteEvent, MixerStateMove, MixerStateMoveAction, MixerStatePasteAction, MixerStatePasteEvent, MixerStateRemoveAction, MoveAction, NodeAction, NoteAction, NoteStateChange, NoteStateMove, NoteValueChange, OpExistenceChanged, OpStateEvent, OpStateMove, OpStateParamChange, ParamAction, RenameAction, SaveObj, StateAction, StateChangeEvent } from '../model/datatypes';
import { FileService } from './file.service';
import { FirebaseService } from './firebase.service';
import { TreeService } from './tree.service';
import { WorkspaceService } from './workspace.service';

/**
 * stores a state within the undo/redo timeline
 * weaver uses draft, mixer uses ada
 */
interface HistoryState {
  draft: Draft;
  ada: SaveObj;
}

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private tree = inject(TreeService);
  private fb = inject(FirebaseService);
  private ws = inject(WorkspaceService);
  private fs = inject(FileService);
  // public readonly testDocValue$: Observable<any>;


  active_id = 0;
  last_saved_time: string = "";
  history: Array<StateChangeEvent> = [];

  // Global debug flag to show component IDs
  showComponentIds: boolean = false;

  // Draft undo event streams

  /**
   * GENERAL CALL FOR ANY STATE CHANGE EVENT ADDED OR REMOVED FROM THE HISTORY
   */
  stateChangeSubject = new Subject<void>();
  stateChange$ = this.stateChangeSubject.asObservable();

  /**
   * DRAFT EVENTS
   */
  private draftMoveUndoSubject = new Subject<StateAction>();
  draftMoveUndo$ = this.draftMoveUndoSubject.asObservable();

  private draftValueChangeUndoSubject = new Subject<StateAction>();
  draftValueChangeUndo$ = this.draftValueChangeUndoSubject.asObservable();

  private draftLoomChangeUndoSubject = new Subject<StateAction>();
  draftLoomChangeUndo$ = this.draftLoomChangeUndoSubject.asObservable();

  private draftLoomSettingsChangeUndoSubject = new Subject<StateAction>();
  draftLoomSettingsChangeUndo$ = this.draftLoomSettingsChangeUndoSubject.asObservable();

  private draftNameChangeUndoSubject = new Subject<StateAction>();
  draftNameChangeUndo$ = this.draftNameChangeUndoSubject.asObservable();

  private draftCreatedUndoSubject = new Subject<NodeAction>();
  draftCreatedUndo$ = this.draftCreatedUndoSubject.asObservable();

  private draftRemovedUndoSubject = new Subject<NodeAction>();
  draftRemovedUndo$ = this.draftRemovedUndoSubject.asObservable();

  /**
   * OPERATION EVENTS
   */  private opMoveUndoSubject = new Subject<StateAction>();
  opMoveUndo$ = this.opMoveUndoSubject.asObservable();

  private opParamChangeUndoSubject = new Subject<ParamAction>();
  opParamChangeUndo$ = this.opParamChangeUndoSubject.asObservable();

  private opLocalZoomUndoSubject = new Subject<StateAction>();
  opLocalZoomUndo$ = this.opLocalZoomUndoSubject.asObservable();

  private opCreatedUndoSubject = new Subject<NodeAction>();
  opCreatedUndo$ = this.opCreatedUndoSubject.asObservable();

  private opRemovedUndoSubject = new Subject<NodeAction>();
  opRemovedUndo$ = this.opRemovedUndoSubject.asObservable();

  /**
   * CONNECTION EVENTS
   */
  private connectionCreatedUndoSubject = new Subject<NodeAction>();
  connectionCreatedUndo$ = this.connectionCreatedUndoSubject.asObservable();

  private connectionRemovedUndoSubject = new Subject<NodeAction>();
  connectionRemovedUndo$ = this.connectionRemovedUndoSubject.asObservable();

  /**
   * NOTE EVENTS
   */
  private noteCreatedUndoSubject = new Subject<NoteAction>();
  noteCreatedUndo$ = this.noteCreatedUndoSubject.asObservable();

  private noteRemovedUndoSubject = new Subject<NoteAction>();
  noteRemovedUndo$ = this.noteRemovedUndoSubject.asObservable();

  private noteUpdatedUndoSubject = new Subject<NoteAction>();
  noteUpdatedUndo$ = this.noteUpdatedUndoSubject.asObservable();

  private noteMoveUndoSubject = new Subject<MoveAction>();
  noteMoveUndo$ = this.noteMoveUndoSubject.asObservable();


  /**
   * MATERIALS EVENTS
   */
  private materialsUpdatedUndoSubject = new Subject<MaterialsStateAction>();
  materialsUpdatedUndo$ = this.materialsUpdatedUndoSubject.asObservable();


  /**
   * MIXER EVENTS
   */
  private mixerPasteUndoSubject = new Subject<MixerStateRemoveAction>();
  mixerPasteUndo$ = this.mixerPasteUndoSubject.asObservable();
  private mixerDeleteUndoSubject = new Subject<MixerStatePasteAction>();
  mixerDeleteUndo$ = this.mixerDeleteUndoSubject.asObservable();
  private mixerMoveUndoSubject = new Subject<MixerStateMoveAction>();
  mixerMoveUndo$ = this.mixerMoveUndoSubject.asObservable();


  /**
   * FILEMETA EVENTS
   */
  private fileMetaChangeUndoSubject = new Subject<FileMetaStateAction>();
  fileMetaChangeUndo$ = this.fileMetaChangeUndoSubject.asObservable();



  constructor() {



  }

  hasTimeline() {
    return this.history.length > 0;
  }

  clearTimeline() {
    this.history = [];
  }


  printValue(value: any) {
    console.log("printing", value);
  }


  validateWriteData(cur_state: any): any {
    return cur_state;
  }


  public getFileSize(name: string, obj: any): number {
    const str = JSON.stringify(obj);
    const size = new Blob([str]).size;
    console.log(name + " is ", size);
    return size;

  }


  private writeStateToFirebase() {
    if (this.fb.auth.currentUser != null) {
      this.fs.saver.ada()
        .then(so => {
          return this.fb.updateFile(so.file, this.ws.getCurrentFile());
        })
        .catch(err => console.error(err));
    }
  }

  public addStateChange(change: StateChangeEvent) {

    this.history.push(change);
    console.log("HISTORY IS ", this.history)
    this.writeStateToFirebase();

    this.stateChangeSubject.next();

  }


  private handleDraftUndo(change: DraftStateEvent) {
    switch (change.type) {
      case 'MOVE':
        this.draftMoveUndoSubject.next(<MoveAction>{
          type: 'CHANGE',
          id: (<OpStateMove>change).id,
          before: (<OpStateMove>change).before,
          after: (<OpStateMove>change).after
        });
        break;
      case 'VALUE_CHANGE':
        this.draftValueChangeUndoSubject.next(
          <DraftStateAction>{
            type: 'CHANGE',
            id: (<DraftStateChange>change).id,
            before: (<DraftStateChange>change).before,
            after: (<DraftStateChange>change).after
          }
        );
        break;
      case 'NAME_OR_NOTES_CHANGE':

        this.draftNameChangeUndoSubject.next(<RenameAction>{
          type: 'CHANGE',
          id: (<DraftStateNameOrNotesChange>change).id,
          before: (<DraftStateNameOrNotesChange>change).before,
          after: (<DraftStateNameOrNotesChange>change).after
        });
        break;
      case 'CREATED':
        const a: NodeAction = {
          type: 'REMOVE',
          node: (<DraftExistenceChange>change).node,
          inputs: (<DraftExistenceChange>change).inputs,
          outputs: (<DraftExistenceChange>change).outputs,

        }
        this.draftCreatedUndoSubject.next(a);
        break;
      case 'REMOVED':
        this.draftRemovedUndoSubject.next({
          type: "CREATE",
          node: (<DraftExistenceChange>change).node,
          inputs: (<DraftExistenceChange>change).inputs,
          outputs: (<DraftExistenceChange>change).outputs
        });
        break;
    }
  }

  private handleOpUndo(change: OpStateEvent) {
    switch (change.type) {
      case 'MOVE':
        this.opMoveUndoSubject.next(<MoveAction>{
          type: 'CHANGE',
          id: (<OpStateMove>change).id,
          before: (<OpStateMove>change).before,
          after: (<OpStateMove>change).after
        });
        break;
      case 'PARAM_CHANGE':
        this.opParamChangeUndoSubject.next(
          {
            type: 'CHANGE',
            opid: (<OpStateParamChange>change).opid,
            paramid: (<OpStateParamChange>change).paramid,
            value: (<OpStateParamChange>change).before
          });
        break;
      case 'CREATED':
        this.opCreatedUndoSubject.next({
          type: "REMOVE",
          node: (<OpExistenceChanged>change).node,
          inputs: (<OpExistenceChanged>change).inputs,
          outputs: (<OpExistenceChanged>change).outputs
        });
        break;
      case 'REMOVED':
        this.opRemovedUndoSubject.next({
          type: "CREATE",
          node: (<OpExistenceChanged>change).node,
          inputs: (<OpExistenceChanged>change).inputs,
          outputs: (<OpExistenceChanged>change).outputs,
          media: (<OpExistenceChanged>change).media
        });
        break;
    }
  }

  private handleConnectionUndo(change: ConnectionStateEvent) {
    switch (change.type) {
      case 'CREATED':
        this.connectionCreatedUndoSubject.next({
          type: 'REMOVE',
          node: (<ConnectionExistenceChange>change).node,
          inputs: (<ConnectionExistenceChange>change).inputs,
          outputs: (<ConnectionExistenceChange>change).outputs
        })
        break;
      case 'REMOVED':
        this.connectionRemovedUndoSubject.next({
          type: 'CREATE',
          node: (<ConnectionExistenceChange>change).node,
          inputs: (<ConnectionExistenceChange>change).inputs,
          outputs: (<ConnectionExistenceChange>change).outputs
        })
        break;
    }
  }

  private handleNoteUndo(change: NoteStateChange) {
    switch (change.type) {
      case 'CREATED':
        this.noteCreatedUndoSubject.next({
          type: 'REMOVE',
          before: (<NoteValueChange>change).before,
          after: (<NoteValueChange>change).after,
          id: (<NoteValueChange>change).id
        });
        break;
      case 'REMOVED':
        this.noteRemovedUndoSubject.next({
          type: 'CREATE',
          before: (<NoteValueChange>change).before,
          after: (<NoteValueChange>change).after,
          id: (<NoteValueChange>change).id
        });
        break;
      case 'UPDATED':
        this.noteUpdatedUndoSubject.next({
          type: 'CHANGE',
          before: (<NoteValueChange>change).before,
          after: (<NoteValueChange>change).after,
          id: (<NoteValueChange>change).id
        });
        break;
      case 'MOVE':
        this.noteMoveUndoSubject.next(<MoveAction>{
          type: 'CHANGE',
          before: (<NoteStateMove>change).before,
          after: (<NoteStateMove>change).after,
          id: (<NoteStateMove>change).id
        });
        break;
    }
  }

  private handleMaterialsUndo(change: MaterialsStateChange) {
    switch (change.type) {
      case 'UPDATED':
        console.log("MATERIALS UPDATED UNDO CALLED ", change.before[0].color);
        this.materialsUpdatedUndoSubject.next(
          {
            type: 'CHANGE',
            before: (<MaterialsStateChange>change).before,
            after: (<MaterialsStateChange>change).after
          });
        break;

    }
  }

  private handleMixerUndo(change: MixerStateChangeEvent) {
    switch (change.type) {
      case 'PASTE':
        this.mixerPasteUndoSubject.next(<MixerStateRemoveAction>{
          type: 'REMOVE',
          ids: (<MixerStatePasteEvent>change).ids
        });
        break;
      case 'DELETE':
        this.mixerDeleteUndoSubject.next(<MixerStatePasteAction>{
          type: 'CREATE',
          obj: (<MixerStateDeleteEvent>change).obj
        });
        break;
      case 'MOVE':
        this.mixerMoveUndoSubject.next(<MixerStateMoveAction>{
          type: 'CHANGE',
          moving_id: (<MixerStateMove>change).moving_id,
          relative_position: (<MixerStateMove>change).relative_position_before,
          selected: (<MixerStateMove>change).selected_before,
        });
        break;
    }
  }

  private handleFileMetaUndo(change: FileMetaStateChange) {

    switch (change.type) {
      case 'META_CHANGE':
        this.fileMetaChangeUndoSubject.next(<FileMetaStateAction>{
          type: 'CHANGE',
          id: (<FileMetaStateChange>change).id,
          before: (<FileMetaStateChange>change).before,
          after: (<FileMetaStateChange>change).after
        });
        break;
    }


  }



  private handleUndo(change: StateChangeEvent) {
    switch (change.originator) {

      case 'OP':
        this.handleOpUndo(<OpStateEvent>change);
        break;
      case 'DRAFT':
        this.handleDraftUndo(<DraftStateEvent>change);
        break;
      case 'CONNECTION':
        this.handleConnectionUndo(<ConnectionStateEvent>change);
        break;
      case 'NOTE':
        this.handleNoteUndo(<NoteStateChange>change);
        break;
      case 'MATERIALS':
        this.handleMaterialsUndo(<MaterialsStateChange>change);
        break;
      case 'MIXER':
        this.handleMixerUndo(<MixerStateChangeEvent>change);
        break;
      case 'FILEMETA':
        this.handleFileMetaUndo(<FileMetaStateChange>change);
        break;

    }

    this.stateChangeSubject.next();

  }


  public undo() {


    const last = this.history.pop();
    if (last) {
      this.handleUndo(last);
      this.writeStateToFirebase();
    }

  }










}



