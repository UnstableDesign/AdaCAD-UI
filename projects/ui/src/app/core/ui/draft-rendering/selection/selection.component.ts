import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { Drawdown, Interlacement, OpInput, OpParamVal, Operation } from 'adacad-drafting-lib';
import { createBlankDrawdown, createCell, generateMappingFromPattern, getCellValue, initDraftWithParams, isUp, pasteIntoDrawdown, setCellValue, warps, wefts } from 'adacad-drafting-lib/draft';
import { getLoomUtilByType, numFrames, numTreadles } from 'adacad-drafting-lib/loom';
import { BehaviorSubject } from 'rxjs';
import { DraftNodeBroadcastFlags } from '../../../model/datatypes';
import { defaults, paste_options } from '../../../model/defaults';
import { MaterialsService } from '../../../provider/materials.service';
import { OperationService } from '../../../provider/operation.service';
import { RenderService } from '../../../provider/render.service';
import { SystemsService } from '../../../provider/systems.service';
import { TreeService } from '../../../provider/tree.service';
import { ZoomService } from '../../../provider/zoom.service';

@Component({
  selector: 'app-selection',
  templateUrl: './selection.component.html',
  styleUrls: ['./selection.component.scss'],
  imports: []
})
export class SelectionComponent implements OnInit {
  ms = inject(MaterialsService);
  ss = inject(SystemsService);
  ops = inject(OperationService);
  private tree = inject(TreeService);
  render = inject(RenderService);
  zs = inject(ZoomService);


  @Input('id') id: number;
  @Input('source') source: string;
  @Input('scale') scale: number;
  @Input('draft_edit_source') draft_edit_source: string = 'drawdown';
  @Output() onSelectionEnd: any = new EventEmitter();
  @Output() forceRedraw: any = new EventEmitter();
  @Output() saveAction: any = new EventEmitter();



  //core selection variables
  private start: Interlacement;
  private end: Interlacement;
  public width: number;
  public height: number;
  public target: HTMLElement;

  public design_actions: Array<any>;
  screen_width: number;
  screen_height: number;

  hide_parent: boolean;
  hide_actions: boolean;


  public cell_size: number;
  public has_selection = false;


  has_copy: boolean = false;
  copy: Drawdown = [];

  selectionEl: HTMLElement = null;
  selectionMeta: HTMLElement = null;
  selectionContainerEl: HTMLElement = null;


  copyEl: HTMLElement = null;
  copyContainerEl: HTMLElement = null;
  copyWidth: number = 0;
  copyHeight: number = 0;
  copyStart: Interlacement = { i: 0, j: 0 };
  copyEnd: Interlacement = { i: 0, j: 0 };

  size_row: HTMLElement = null;
  action_row: HTMLElement = null;

  /**
  * reference to the parent div
  */
  parent: HTMLElement;


  selectionEventSubject: BehaviorSubject<'none' | 'started' | 'dragging' | 'stopped' | 'copy'> = new BehaviorSubject<'none' | 'started' | 'dragging' | 'stopped' | 'copy'>('none');


  constructor() {

    this.design_actions = paste_options;

    this.hide_parent = true;
    this.hide_actions = true;

    this.start = { i: 0, j: 0 };
    this.end = { i: 0, j: 0 };

    this.screen_height = 0;
    this.screen_width = 0;
    this.cell_size = defaults.draft_detail_cell_size;


  }

  ngOnInit() {
  }

  ngAfterViewInit() {
    this.selectionEl = document.getElementById("selection-" + this.id);
    this.selectionContainerEl = document.getElementById("selection-container-" + this.id);
    this.selectionMeta = document.getElementById("selection-meta");

    this.copyEl = document.getElementById("copied-pattern-" + this.id);
    this.copyContainerEl = document.getElementById("copied-container-" + this.id);

    this.size_row = document.getElementById('selection-size-row');


  }

  clearSelection() {
    this.start = { i: 0, j: 0 };
    this.end = { i: 0, j: 0 };


  }


  designActionChange(action: string) {

    switch (action) {

      case 'copy':
        this.copyArea();
        break;

      case 'erase':
        this.copyArea();
        this.onPaste('erase');
        break;

      case 'paste':
        this.onPaste('original');
        break;

      case 'invert':
        this.copyArea();
        this.onPaste('invert');
        break;

      case 'flip_x':
        this.copyArea();
        this.onPaste('flip_x');
        break;

      case 'flip_y':
        this.copyArea();
        this.onPaste('flip_y');
        break;

      case 'shift_left':
        this.copyArea();
        this.onPaste('shift_left');
        break;

      case 'shift_right':
        this.copyArea();
        this.onPaste('shift_right');
        break;

      case 'shift_up':
        this.copyArea();
        this.onPaste('shift_up');
        break;

      case 'shift_down':
        this.copyArea();
        this.onPaste('shift_down');
        break;

    }





  }

  fillEvent(id) {
    var obj: any = {};
    obj.id = id;
  }


  /**
   * Creates the copied pattern. Hack for warp and weft shuttles is that it creates a 2d array representing the 
   * threading or treadling with "true" in the frame/treadle associated with that col/row. 
   */
  public copyArea() {

    this.target.parentNode.appendChild(this.copyContainerEl);
    var style = window.getComputedStyle(this.target.parentElement);
    this.copyContainerEl.style.margin = style.padding;

    this.has_copy = true;
    this.copyStart = { i: this.start.i, j: this.start.j };
    this.copyEnd = { i: this.end.i, j: this.end.j };

    const draft = this.tree.getDraft(this.id);
    const loom = this.tree.getLoom(this.id);

    const screen_i = this.getStartingRowIndex();
    const draft_j = this.getStartingColIndex();

    var w = this.getWidth();
    var h = this.getHeight();
    this.copyWidth = w;
    this.copyHeight = h;


    // const copy = initDraftWithParams({wefts: h, warps: w, drawdown: [[createCell(false)]]}).drawdown;
    const temp_copy: Array<Array<boolean>> = [];

    if (this.getTargetId() === 'weft-systems-' + this.source + "-" + this.id) {
      for (var i = 0; i < h; i++) {
        temp_copy.push([]);
        for (var j = 0; j < this.ss.weft_systems.length; j++) {
          temp_copy[i].push(false);
        }
      }
    } else if (this.getTargetId() === 'warp-systems-' + this.source + "-" + this.id) {
      for (var i = 0; i < this.ss.warp_systems.length; i++) {
        temp_copy.push([]);
        for (var j = 0; j < w; j++) {
          temp_copy[i].push(false);
        }
      }
    } else if (this.getTargetId() === 'weft-materials-' + this.source + "-" + this.id) {
      for (var i = 0; i < h; i++) {
        temp_copy.push([]);
        for (var j = 0; j < this.ms.getShuttles().length; j++) {
          temp_copy[i].push(false);
        }
      }
    } else if (this.getTargetId() === 'warp-materials-' + this.source + "-" + this.id) {

      for (var i = 0; i < this.ms.getShuttles().length; i++) {
        temp_copy.push([]);
        for (var j = 0; j < w; j++) {
          temp_copy[i].push(false);
        }
      }
    } else {
      for (var i = 0; i < h; i++) {
        temp_copy.push([]);
        for (var j = 0; j < w; j++) {
          temp_copy[i].push(false);
        }
      }
    }

    //iterate through the selection
    for (var i = 0; i < temp_copy.length; i++) {
      for (var j = 0; j < temp_copy[0].length; j++) {

        var screen_row = screen_i + i;
        var draft_row = screen_row;
        var col = draft_j + j;

        switch (this.getTargetId()) {
          case 'drawdown-' + this.source + "-" + this.id:
            temp_copy[i][j] = isUp(draft.drawdown, draft_row, col);
            break;
          case 'threading-' + this.source + "-" + this.id:
            temp_copy[i][j] = (loom.threading[col] === screen_row);

            break;
          case 'treadling-' + this.source + "-" + this.id:
            temp_copy[i][j] = (loom.treadling[screen_row].find(el => el === col) !== undefined);
            break;
          case 'tieups-' + this.source + "-" + this.id:
            temp_copy[i][j] = loom.tieup[screen_row][col];
            break;
          case 'warp-systems-' + this.source + "-" + this.id:
            temp_copy[i][j] = (draft.colSystemMapping[col] == i);
            break;
          case 'weft-systems-' + this.source + "-" + this.id:
            temp_copy[i][j] = (draft.rowSystemMapping[draft_row] == j);
            break;
          case 'warp-materials-' + this.source + "-" + this.id:
            temp_copy[i][j] = (draft.colShuttleMapping[col] == i);
            break;
          case 'weft-materials-' + this.source + "-" + this.id:
            temp_copy[i][j] = (draft.rowShuttleMapping[draft_row] == j);
            break;
          default:
            break;
        }

      }
    }

    if (temp_copy.length == 0) return;

    const temp_dd: Drawdown = createBlankDrawdown(temp_copy.length, temp_copy[0].length);
    temp_copy.forEach((row, i) => {
      row.forEach((cell, j) => {
        temp_dd[i][j] = setCellValue(temp_dd[i][j], cell);
      })
    })

    this.copy = initDraftWithParams({ warps: warps(temp_dd), wefts: wefts(temp_dd), drawdown: temp_dd }).drawdown;
    this.redraw();
    this.selectionEventSubject.next('copy');

  }


  /**
   * applies a manipulation to the copied draft based on a type. The type is used to call an operation that manipulates the drawdown and then returns the resulting drawdown. 
   * @param op_name 
   * @returns a promise for a drawdown
   */
  public applyManipulation(op_name): Promise<Drawdown> {


    const copy_draft = initDraftWithParams({ warps: warps(this.copy), wefts: wefts(this.copy), drawdown: this.copy });

    let op: Operation;
    let drafts: Array<OpInput> = [];
    let params: Array<OpParamVal> = [];

    switch (op_name) {
      case 'original':
        return Promise.resolve(this.copy);
        break;
      case 'erase':
        op = this.ops.getOp('rectangle');
        params = [{
          param: op.params[1],
          val: warps(this.copy)
        },
        {
          param: op.params[0],
          val: wefts(this.copy)
        }];
        drafts = [{
          drafts: [initDraftWithParams({ warps: warps(this.copy), wefts: wefts(this.copy), drawdown: [[createCell(false)]] })],
          inlet_id: 0,
          inlet_params: []
        }];
        break;
      case 'invert':
        op = this.ops.getOp('invert');
        params = [];
        drafts = [{
          drafts: [copy_draft],
          inlet_id: 0,
          inlet_params: []
        }]

        break;
      case 'flip_x':
        op = this.ops.getOp('flip');
        params = [{
          param: op.params[1],
          val: 0
        },
        {
          param: op.params[0],
          val: 1
        },];
        drafts = [{
          drafts: [copy_draft],
          inlet_id: 0,
          inlet_params: []
        }]
        break;
      case 'flip_y':
        op = this.ops.getOp('flip');
        params = [{
          param: op.params[0],
          val: 1
        },
        {
          param: op.params[1],
          val: 0
        },];
        drafts = [{
          drafts: [copy_draft],
          inlet_id: 0,
          inlet_params: []
        }]
        break;

      case 'shift_left':
        op = this.ops.getOp('shift');
        params = [{
          param: op.params[0],
          val: -1
        },
        {
          param: op.params[1],
          val: 0
        },];
        drafts = [{
          drafts: [copy_draft],
          inlet_id: 0,
          inlet_params: []
        }]
        break;
      case 'shift_up':
        op = this.ops.getOp('shift');
        params = [{
          param: op.params[0],
          val: 0
        },
        {
          param: op.params[1],
          val: 1
        },];
        drafts = [{
          drafts: [copy_draft],
          inlet_id: 0,
          inlet_params: []
        }]
        break;
      case 'shift_right':
        op = this.ops.getOp('shift');
        params = [{
          param: op.params[0],
          val: 1
        },
        {
          param: op.params[1],
          val: 0
        },];
        drafts = [{
          drafts: [copy_draft],
          inlet_id: 0,
          inlet_params: []
        }]
        break;
      case 'shift_down':
        op = this.ops.getOp('shift');
        params = [{
          param: op.params[0],
          val: 0
        },
        {
          param: op.params[1],
          val: -1
        },];
        drafts = [{
          drafts: [copy_draft],
          inlet_id: 0,
          inlet_params: []
        }]
        break;
      default:
        break;
    }
    return op.perform(params, drafts)
      .then(manipulated_draft => {

        if (manipulated_draft.length == 0) return Promise.reject('no draft returned')
        const dd = manipulated_draft[0].draft.drawdown;

        return Promise.resolve(dd)
      })






  }


  public onPaste(type: string) {
    const before = this.tree.getDraftNodeState(this.id);

    const draft = this.tree.getDraft(this.id);
    const loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);
    const loom_util = getLoomUtilByType(loom_settings.type);

    let pattern: Array<number> = [];
    let mapping: Array<number> = [];


    //manipulate the copy in any way required 
    this.applyManipulation(type)
      .then(manipulated_copy => {
        this.copy = manipulated_copy;
        this.selectionEventSubject.next('copy');


        switch (this.getTargetId()) {
          case 'drawdown-' + this.source + "-" + this.id:
            draft.drawdown = pasteIntoDrawdown(
              draft.drawdown,
              this.copy,
              this.getStartingRowIndex(),
              this.getStartingColIndex(),
              this.getWidth(),
              this.getHeight());


            //if you do this when updates come from loom, it will erase those updates
            this.tree.setDraftAndRecomputeLoom(this.id, draft, loom_settings)
              .then(loom => {
                this.saveAction.emit(before);
              });
            break;

          case 'threading-' + this.source + "-" + this.id:
            loom_util.pasteThreading(loom, this.copy, { i: this.getStartingRowIndex(), j: this.getStartingColIndex(), val: null }, this.getWidth(), this.getHeight());
            this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
              .then(draft => {
                this.saveAction.emit(before);
              });
            break;
          case 'tieups-' + this.source + "-" + this.id:

            loom_util.pasteTieup(loom, this.copy, { i: this.getStartingRowIndex(), j: this.getStartingColIndex(), val: null }, this.getWidth(), this.getHeight());
            this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
              .then(draft => {
                this.saveAction.emit(before);
              });
            break;
          case 'treadling-' + this.source + "-" + this.id:
            loom_util.pasteTreadling(loom, this.copy, { i: this.getStartingRowIndex(), j: this.getStartingColIndex(), val: null }, this.getWidth(), this.getHeight());

            this.tree.setLoomAndRecomputeDrawdown(this.id, loom, loom_settings)
              .then(draft => {
                this.saveAction.emit(before);
              });
            break;

          case 'warp-systems-' + this.source + "-" + this.id:

            pattern = [];
            for (let j = 0; j < this.copy[0].length; j++) {
              const assigned_to = this.copy.findIndex(sys => getCellValue(sys[j]) == true);
              pattern.push(assigned_to);
            }
            mapping = generateMappingFromPattern(draft.drawdown, pattern, 'col');

            draft.colSystemMapping = mapping.map((el, ndx) => {
              if (ndx >= this.getStartingColIndex() && ndx < this.getStartingColIndex() + this.getWidth()) {
                return el;
              } else {
                return draft.colSystemMapping[ndx];
              }
            });

            let flags: DraftNodeBroadcastFlags = {
              meta: false,
              draft: true,
              loom: false,
              loom_settings: false,
              materials: false
            };
            this.tree.setDraft(this.id, draft, flags, true, true);
            this.saveAction.emit(before);


            break;
          case 'warp-materials-' + this.source + "-" + this.id:

            pattern = [];
            for (let j = 0; j < this.copy[0].length; j++) {
              const assigned_to = this.copy.findIndex(sys => getCellValue(sys[j]) == true);
              pattern.push(assigned_to);
            }
            mapping = generateMappingFromPattern(draft.drawdown, pattern, 'col');

            draft.colShuttleMapping = mapping.map((el, ndx) => {
              if (ndx >= this.getStartingColIndex() && ndx < this.getStartingColIndex() + this.getWidth()) {
                return el;
              } else {
                return draft.colShuttleMapping[ndx];
              }
            });

            const warp_materials_flags: DraftNodeBroadcastFlags = {
              meta: false,
              draft: false,
              loom: false,
              loom_settings: false,
              materials: true
            };
            this.tree.setDraft(this.id, draft, warp_materials_flags);
            this.saveAction.emit(before);


            break;

          case 'weft-systems-' + this.source + "-" + this.id:

            pattern = [];
            for (let i = 0; i < this.copy.length; i++) {
              const assigned_to = this.copy[i].findIndex(sys => getCellValue(sys) == true);
              pattern.push(assigned_to);
            }
            mapping = generateMappingFromPattern(draft.drawdown, pattern, 'row');

            draft.rowSystemMapping = mapping.map((el, ndx) => {
              if (ndx >= this.getStartingRowIndex() && ndx < this.getStartingRowIndex() + this.getHeight()) {
                return el;
              } else {
                return draft.rowSystemMapping[ndx];
              }
            });
            const weft_systems_flags: DraftNodeBroadcastFlags = {
              meta: false,
              draft: true,
              loom: false,
              loom_settings: false,
              materials: false
            };
            this.tree.setDraft(this.id, draft, weft_systems_flags, true, true);
            this.saveAction.emit(before);


            break;

          case 'weft-materials-' + this.source + "-" + this.id:

            pattern = [];
            for (let i = 0; i < this.copy.length; i++) {
              const assigned_to = this.copy[i].findIndex(sys => getCellValue(sys) == true);
              pattern.push(assigned_to);
            }
            mapping = generateMappingFromPattern(draft.drawdown, pattern, 'row');

            draft.rowShuttleMapping = mapping.map((el, ndx) => {
              if (ndx >= this.getStartingRowIndex() && ndx < this.getStartingRowIndex() + this.getHeight()) {
                return el;
              } else {
                return draft.rowShuttleMapping[ndx];
              }
            });
            const weft_materials_flags: DraftNodeBroadcastFlags = {
              meta: false,
              draft: false,
              loom: false,
              loom_settings: false,
              materials: true
            };
            this.tree.setDraft(this.id, draft, weft_materials_flags, true, true);
            this.saveAction.emit(before);


            break;
        }
      })

  }


  /**
   * Tell the weave directive to fill selection with pattern.
   * @extends WeaveComponent
   * @param {Event} e - fill event from design component.
   * @returns {void}
   */
  //  public onFill(e) {

  //   let p:Pattern = this.ps.getPattern(e.id);

  //   this.weave.fillArea(this.selection, p, 'original', this.render.visibleRows, this.loom);

  //   this.loom.recomputeLoom(this.weave, this.loom.type);

  //   if(this.render.isYarnBasedView()) this.weave.computeYarnPaths(this.ms.getShuttles());

  //   this.copyArea();

  //   this.redraw({drawdown:true, loom:true});

  //   this.timeline.addHistoryState(this.weave);

  // }

  clearEvent(b: boolean) {
  }


  /**
   * different areas of the draft allow for different kinds of actions. This updates the action list based on the 
   * target of the selection. 
   * @param target 
   */
  updateActions(target: string) {

    switch (target) {
      case 'drawdown-' + this.source + "-" + this.id:
        this.design_actions = paste_options.filter(opt => opt.drawdown == true);
        break;


      case 'threading-' + this.source + "-" + this.id:
        this.design_actions = paste_options.filter(opt => opt.threading == true);
        break;


      case 'tieups-' + this.source + "-" + this.id:
        this.design_actions = paste_options.filter(opt => opt.tieups == true);
        break;


      case 'treadling-' + this.source + "-" + this.id:
        this.design_actions = paste_options.filter(opt => opt.treadling == true);
        break;



      case 'weft-system-' + this.source + "-" + this.id:
      case 'warp-systems-' + this.source + "-" + this.id:
        this.design_actions = paste_options.filter(opt => opt.systems == true);
        break;



      case 'weft-materials-' + this.source + "-" + this.id:
      case 'warp-materials-' + this.source + "-" + this.id:
        this.design_actions = paste_options.filter(opt => opt.systems == true);
        break;


    }
  }

  /**
  * set parameters and view when starting a new selections
  * @param target he HTML target that receieved the mouse down event
  * @param start the interlacement upon that target that received the mouse click
  * @returns 
  */
  onSelectStart(target: HTMLElement, start: Interlacement) {
    if (!target) return;

    this.selectionEventSubject.next('started');
    this.hide_actions = true;
    const draft = this.tree.getDraft(this.id);
    this.cell_size = this.render.calculateRawPixelCellSize(draft, 'canvas');

    //clear existing params
    this.unsetParameters();

    this.target = target;
    this.updateActions(this.target.id);


    this.target.parentNode.appendChild(this.selectionContainerEl);


    //pad the selection container to match the padding of the parent. 
    var style = window.getComputedStyle(this.target.parentElement);
    var matrix = new WebKitCSSMatrix(style.transform);
    this.size_row.style.transform = 'matrix(' + matrix.a + ',' + matrix.b + ',' + matrix.c + ',' + matrix.d + ',' + matrix.e + ',' + matrix.f + ')';


    //make sure the transform is applied to correct the origination of the text and action icons
    this.selectionContainerEl.style.padding = style.padding;




    const loom = this.tree.getLoom(this.id);
    const loom_settings = this.tree.getLoomSettings(this.id);


    this.start = start;
    this.hide_parent = false;

    switch (target.id) {

      case 'treadling-' + this.source + "-" + this.id:
        this.width = Math.max(numTreadles(loom), loom_settings.treadles);
        break;

      case 'threading-' + this.source + "-" + this.id:
        this.height = Math.max(numFrames(loom), loom_settings.frames);
        break;

      case 'weft-system-' + this.source + "-" + this.id:
      case 'weft-materials-' + this.source + "-" + this.id:
        this.width = 1;
        break;

      case 'warp-systems-' + this.source + "-" + this.id:
      case 'warp-materials-' + this.source + "-" + this.id:
        this.height = 1;
        break;

      case 'drawdown-' + this.source + "-" + this.id:
        break;
      case 'tieups-' + this.source + "-" + this.id:
        break;

    }

    this.end = this.start;

    this.recalculateSize();


    this.has_selection = true;
    this.redraw();



  }




  /**
  * updates selectiono parameters when the user drags the selected area
  * @param pos the mouse position
  * @returns boolean to specify if the point was in range or not
  */
  onSelectDrag(pos: Interlacement): boolean {


    if (this.target === undefined) return;


    // if(pos.si > this.render.visibleRows.length){
    //   pos.si = this.render.visibleRows.length;
    //   return false
    // } 




    this.selectionEventSubject.next('dragging');

    this.end = pos;

    switch (this.target.id) {

      case 'treadling-' + this.source + "-" + this.id:
        this.end.i = pos.i;
        break;

      case 'threading-' + this.source + "-" + this.id:
        this.end.j = pos.j;
        break;

      case 'weft-systems':
      case 'weft-materials':
      case 'warp-systems':
      case 'warp-materials':
      case 'drawdown-editor':
      case 'tieups-editor':

        break;
    }

    this.recalculateSize()
    this.redraw();
  }

  /**
  * triggers view changes when the selection event ends OR mouse leaves valid view
  */
  onSelectStop(leave: boolean = false) {

    if (this.target === undefined) return;
    this.hide_actions = false;
    this.selectionEventSubject.next('stopped');
    this.onSelectionEnd.emit();
  }

  onSelectCancel() {
    this.selectionEventSubject.next('none');
    this.has_copy = false;
    this.copy = [];
    this.unsetParameters();
  }



  getStartingRowIndex(): number {
    return Math.min(this.start.i, this.end.i);
  }

  getStartingColIndex(): number {
    return Math.min(this.start.j, this.end.j);
  }

  getEndingRowIndex(): number {
    return Math.max(this.start.i, this.end.i);
  }

  getEndingColIndex(): number {
    return Math.max(this.start.j, this.end.j);
  }


  // getEndingIndex(): number{
  //   return Math.min(this.start.j, this.end.j);
  // }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }



  setEnd(end: Interlacement) {
    this.end = end;
    this.recalculateSize();
  }

  setStart(start: Interlacement) {


    this.hide_parent = false;
    this.hide_actions = true;
    this.start = start;
    this.recalculateSize();


  }

  recalculateSize() {

    this.width = Math.abs(this.end.j - this.start.j) + 1; //make this inclusive
    this.height = Math.abs(this.end.i - this.start.i) + 1;
    this.screen_width = this.width * this.cell_size;
    this.screen_height = this.height * this.cell_size;


  }



  removeCopy() {
    this.copy = [];
    this.copyWidth = 0;
    this.copyHeight = 0;
    this.copyStart = { i: 0, j: 0 };
    this.copyEnd = { i: 0, j: 0 };
    this.copyContainerEl.style.display = 'none';
    this.copyEl.style.display = 'none';
  }

  unsetParameters() {
    if (this.target !== null && this.target !== undefined) {
      this.selectionEventSubject.next('none');
      let parent = this.selectionContainerEl.parentNode;
      if (parent !== null && parent !== undefined) parent.removeChild(this.selectionContainerEl)
    }

    this.has_selection = false;
    this.width = -1;
    this.height = -1;
    //this.hide_parent = true;
    // this.hide_options = true;
  }

  hasSelection() {
    return (this.width > 0 && this.height > 0 && this.has_selection);
  }

  hasCopy() {
    return this.copy.length > 0 && this.has_copy;
  }

  getTop() {
    return Math.min(this.start.i, this.end.i);
  }

  getLeft() {
    return Math.min(this.start.j, this.end.j);
  }

  setTarget(t) {
    this.target = t;
  }

  getTarget() {
    return this.target;
  }


  getTargetId() {
    if (this.target !== undefined) return this.target.id;
    return undefined;
  }


  redraw() {

    let top_ndx = Math.min(this.copyStart.i, this.copyEnd.i);
    let left_ndx = Math.min(this.copyStart.j, this.copyEnd.j);

    //this needs to take the transform of the current element into account
    let in_div_top: number = top_ndx * this.cell_size * this.scale;
    let in_div_left: number = left_ndx * this.cell_size * this.scale;


    if (this.copyContainerEl !== null && this.copyEl !== null) {

      this.copyContainerEl.style.display = 'flex';
      this.copyEl.style.display = 'block';
      this.copyContainerEl.style.top = in_div_top + "px"
      this.copyContainerEl.style.left = in_div_left + "px";
      this.copyContainerEl.style.width = this.copyWidth * this.cell_size * this.scale + "px";
      this.copyContainerEl.style.height = this.copyHeight * this.cell_size * this.scale + "px";

    }



    if (this.hasSelection()) {

      this.hide_parent = false;


      let top_ndx = Math.min(this.start.i, this.end.i);
      let left_ndx = Math.min(this.start.j, this.end.j);

      //this needs to take the transform of the current element into account
      let in_div_top: number = top_ndx * this.cell_size * this.scale;
      let in_div_left: number = left_ndx * this.cell_size * this.scale;


      if (this.selectionContainerEl !== null && this.selectionEl !== null) {

        this.selectionContainerEl.style.top = in_div_top + "px"
        this.selectionContainerEl.style.left = in_div_left + "px";
        this.selectionEl.style.width = this.screen_width * this.scale - 5 + "px";
        this.selectionEl.style.height = this.screen_height * this.scale - 5 + "px";
        this.selectionMeta.style.scale = this.scale + "";
      }

    } else {
      this.hide_parent = true;
    }


  }

}
