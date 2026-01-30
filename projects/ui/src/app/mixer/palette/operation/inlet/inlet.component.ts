import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { FormsModule, UntypedFormControl } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { DynamicOperation, OperationInlet } from 'adacad-drafting-lib';
import { getDraftName } from 'adacad-drafting-lib/draft';
import { OpNode } from '../../../../core/model/datatypes';
import { OperationService } from '../../../../core/provider/operation.service';
import { SystemsService } from '../../../../core/provider/systems.service';
import { TreeService } from '../../../../core/provider/tree.service';


@Component({
  selector: 'app-inlet',
  templateUrl: './inlet.component.html',
  styleUrls: ['./inlet.component.scss'],
  imports: [MatButton, MatTooltip, FormsModule]
})
export class InletComponent implements OnInit {
  tree = inject(TreeService);
  private systems = inject(SystemsService);
  private ops = inject(OperationService);


  @Input() opid: number;
  @Input() inletid: number;
  @Input() dynamic: boolean;
  @Output() onInputSelected = new EventEmitter<any>();
  @Output() onInputVisibilityChange = new EventEmitter<any>();
  @Output() onConnectionRemoved = new EventEmitter<any>();
  @Output() onInletChange = new EventEmitter<any>();
  @Output() onInletLoaded = new EventEmitter<any>();

  fc: UntypedFormControl;
  textValidate: any;
  number_opts: Array<number>;
  opnode: OpNode;
  inlet: OperationInlet;
  selectedValue: number;
  inlet_desc: string;
  show_connection_name: number = -1;
  inlet_open = true;
  show_inlet_desc = false;
  inlet_for_drafts = true;
  inlet_name = "";

  ngOnInit(): void {
    this.opnode = this.tree.getOpNode(this.opid);


    const op = this.ops.getOp(this.opnode.name);

    this.number_opts = [];
    for (let i = 1; i < 50; i++) {
      this.number_opts.push(i);
    }

    // initalize any dyanmic inlets
    if (this.opnode.inlets.length > 0 && this.inletid >= op.inlets.length && this.dynamic) {

      const type = (<DynamicOperation>op).dynamic_param_type;
      this.inlet = <OperationInlet>{
        type: type,
        name: '',
        value: this.parseDefaultInletValue(type, this.opnode.inlets[this.inletid]),
        uses: 'draft',
        num_drafts: 1,
        dx: ''
      }
    } else {
      this.inlet = op.inlets[this.inletid];
    }

    if (this.inlet === undefined) {
      this.inlet = <OperationInlet>{
        type: 'null',
        name: '',
        value: -1,
        uses: 'draft',
        num_drafts: 1,
        dx: 'input'
      }
    }


    this.fc = new UntypedFormControl(this.parseDefaultInletValue(this.inlet.type, this.opnode.inlets[this.inletid]));
    this.inlet_desc = "input " + this.inlet.dx;
    this.inlet_for_drafts = this.inlet.uses === 'draft';
    this.inlet_name = this.inlet.name;

  }

  ngAfterViewInit() {
    this.onInletLoaded.emit({ ndx: this.inletid, val: this.opnode.inlets[this.inletid] });
  }


  checkIfInletIsOpen() {
    this.inlet_open = this.inlet.num_drafts == -1 || (this.tree.getInputsAtNdx(this.opid, this.inletid).length < this.inlet.num_drafts);

  }

  parseDefaultInletValue(type: string, value: any): any {
    switch (type) {
      case 'number':
      case 'system':
      case 'draft':
        return parseInt(value);
        break;
      case 'notation':
      case 'string':
        return value.slice();
        break;

      case 'color':
        return value;
        break;

    }
  }



  toggleVisibility(input_ndx: number) {
    if (input_ndx == this.show_connection_name) {
      this.onInputVisibilityChange.emit({ inletid: this.inletid, ndx_in_inlets: input_ndx, show: false });
      this.show_connection_name = -1;
    } else {
      this.show_connection_name = input_ndx;
      this.onInputVisibilityChange.emit({ inletid: this.inletid, ndx_in_inlets: input_ndx, show: true });

    }

  }


  inputSelected() {


    this.onInputSelected.emit({ inletid: this.inletid, val: this.opnode.inlets[this.inletid] });
    this.show_connection_name = -1;

  }

  /**
   * 
   * @param sd_id this is neer called becauise the connection is deleted by the connection component
   */
  removeConnectionTo(sd_id: number) {



    this.onConnectionRemoved.emit({ from: sd_id, to: this.opid, inletid: this.inletid });
    this.checkIfInletIsOpen();

  }

  getInputName(id: number): string {
    const sd = this.tree.getDraft(id);
    if (sd === null || sd === undefined) return "null draft"
    return getDraftName(sd);
  }

  inletChange() {

    this.onInletChange.emit({ id: this.inletid, val: this.opnode.inlets[this.inletid] });

  }






}
