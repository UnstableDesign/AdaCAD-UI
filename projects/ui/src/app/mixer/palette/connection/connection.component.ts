import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { MatMiniFabButton } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { ConnectionExistenceChange, ConnectionNode, DraftNode, OpNode, Point } from '../../../core/model/datatypes';
import { OperationService } from '../../../core/provider/operation.service';
import { StateService } from '../../../core/provider/state.service';
import { TreeService } from '../../../core/provider/tree.service';
import { ZoomService } from '../../../core/provider/zoom.service';

@Component({
  selector: 'app-connection',
  templateUrl: './connection.component.html',
  styleUrls: ['./connection.component.scss'],
  imports: [MatMiniFabButton]
})
export class ConnectionComponent implements OnInit {
  tree = inject(TreeService);
  private ops = inject(OperationService);
  zs = inject(ZoomService);
  ss = inject(StateService);



  @Input() id: number;
  @Input() scale: number;
  @Output() onConnectionRemoved = new EventEmitter<any>();


  /** the id of the node that this connection goes from */
  from: number;
  fromPositionChange: Subscription;

  /** the id of the node that this connection goes to */
  to: number;
  toPositionChange: Subscription;

  private b_from: Point;
  private b_to: Point;


  disable_drag: boolean = true;
  orientation_x: boolean = true;
  orientation_y: boolean = true;

  topleft: Point = { x: 0, y: 0 };
  width: number = 0;
  height: number = 0;

  svg: SVGSVGElement;
  path_main: SVGPathElement;
  connector: HTMLElement;
  anim: any;

  no_draw: boolean;

  path_text: string = '';

  show_path_text: boolean = false;
  show_disconnect: boolean = true;

  //styling flags
  upstream: boolean = false;
  downstream: boolean = false;
  recomputing: boolean = false;

  upstreamSubscription: Subscription;
  downstreamSubscription: Subscription;
  fromDraftChangeSubscription: Subscription;


  recomputingSubscription: Subscription;


  constructor() {






  }


  ngOnInit() {



    const treenode = this.tree.getTreeNode(this.id);
    const from_io = treenode.inputs[0];
    const to_io = treenode.outputs[0];

    this.from = from_io.tn.node.id;
    this.to = to_io.tn.node.id;


    this.no_draw = this.tree.getType(this.from) === 'op' && this.tree.hasSingleChild(this.from);
    this.show_disconnect = !(this.tree.getType(this.from) === 'op' && !(this.tree.hasSingleChild(this.from)));

    this.updatePathText()

    const connectionNode = <ConnectionNode>this.tree.getNode(this.id);

    this.upstreamSubscription = connectionNode.upstreamOfSelected.subscribe((value) => {
      this.upstream = value;
      this.updateConnectionStyling();
    });
    this.downstreamSubscription = connectionNode.downstreamOfSelected.subscribe((value) => {
      this.downstream = value;
      this.updateConnectionStyling();
    });







  }



  ngAfterViewInit() {


    const ns = "http://www.w3.org/2000/svg";
    this.svg = document.createElementNS(ns, "svg");
    this.path_main = document.createElementNS(ns, "path");
    this.svg.appendChild(this.path_main);
    document.getElementById("scale-" + this.id).appendChild(this.svg);


    //this.svg = document.getElementById('svg-'+this.id.toString());
    this.connector = document.getElementById('connector-' + this.id.toString());

    this.anim = this.path_main.animate(
      [
        { strokeDashoffset: "0" },
        { strokeDashoffset: "20" }
      ],
      {
        duration: 1000,
        iterations: Infinity,
        easing: "linear"
      }
    );
    this.anim.pause();
    const color = "#000000"
    const stroke_width = 2;
    this.path_main.setAttribute("fill", "none");
    this.path_main.setAttribute("stroke", color);
    this.path_main.setAttribute("stroke-width", "4"); //2
    this.path_main.setAttribute("stroke-linecap", "round");
    this.path_main.setAttribute("stroke-dasharray", "10 10"); //4 2 
    this.path_main.setAttribute("stroke-dashoffset", "0");



    let to_withdata = this.tree.getConnectionOutputWithIndex(this.id);
    this.to = to_withdata.id;
    this.from = this.tree.getConnectionInput(this.id);


    // Use double requestAnimationFrame to wait for child components to render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.updateFromPosition();
        this.updateToPosition(to_withdata.inlet, to_withdata.arr);
        this.drawConnection();
      });
    });


    const fromNode = <DraftNode>this.tree.getNode(this.from);
    this.fromPositionChange = fromNode.positionChange.subscribe((pos) => {
      if (pos === null) return;
      // Defer DOM read until after browser has updated
      requestAnimationFrame(() => {
        this.updateFromPosition();
        this.calculateBounds();
        this.drawConnection();
      });
    });

    const toNode = <OpNode>this.tree.getNode(this.to);
    this.toPositionChange = toNode.positionChange.subscribe((pos) => {
      if (pos === null) return;
      let to_withdata = this.tree.getConnectionOutputWithIndex(this.id);

      // Defer DOM read until after browser has updated
      requestAnimationFrame(() => {
        this.updateToPosition(to_withdata.inlet, to_withdata.arr);
        this.calculateBounds();
        this.drawConnection();
      });
    });


    this.fromDraftChangeSubscription = fromNode.onValueChange.subscribe((el) => {
      requestAnimationFrame(() => {
        this.updateFromPosition();
        this.calculateBounds();
        this.drawConnection();
      });
    });





  }

  onNgDestroy() {
    this.upstreamSubscription.unsubscribe();
    this.downstreamSubscription.unsubscribe();
    this.recomputingSubscription.unsubscribe();
    this.fromPositionChange.unsubscribe();
    this.toPositionChange.unsubscribe();
    this.fromDraftChangeSubscription.unsubscribe();

  }



  disconnect() {
    let to = this.tree.getConnectionOutputWithIndex(this.id);
    let from = this.tree.getConnectionInput(this.id);

    const change: ConnectionExistenceChange = {
      originator: 'CONNECTION',
      type: 'REMOVED',
      node: this.tree.getNode(this.id),
      inputs: [{ from_id: from, inlet_id: 0 }],
      outputs: [{ identity: 'OP', outlet_id: 0, to_id: to.id, inlet_id: to.inlet }]
    }

    this.ss.addStateChange(change);
    this.onConnectionRemoved.emit({ id: this.id });
  }


  updatePathText() {
    const treenode = this.tree.getTreeNode(this.id);
    //  const from_io = treenode.inputs[0];
    const to_io = treenode.outputs[0];
    //  const from = from_io.tn.node.id;
    const to = to_io.tn.node.id;
    if (this.tree.getNode(to).type == "op") {
      //    const from_node = <DraftNode> this.tree.getNode(from);
      const op_node = <OpNode>this.tree.getNode(to);
      const op_info = this.ops.getOp(op_node.name);
      const inlet = this.tree.getInletOfCxn(op_node.id, this.id);
      if (op_info.inlets[inlet] !== undefined && op_info.inlets[inlet].uses !== 'draft') {
        this.path_text = "inlet uses only " + op_info.inlets[inlet].uses;
      }
      else this.path_text = "";

    }
  }



  disableDrag() {
    this.disable_drag = true;
  }

  enableDrag() {
    //there is never a case where this should be enabled so set to true
    this.disable_drag = true;
  }

  /**
   * if every connection goes from one node to another, the to node is always the topleft corner
   * unless the to node is a dynamic operation, in which case we must move to an inlet. 
   * @param to the id of the component this connection goes to
   */
  private updateToPosition(inlet_id: number, arr_id: number) {

    let parent = document.getElementById('scrollable-container');
    let parent_rect = parent.getBoundingClientRect();
    let to_container = document.getElementById("inlet" + this.to + "-" + inlet_id + "-" + arr_id);

    if (to_container == null || to_container == undefined) return;

    let to_rect = to_container.getBoundingClientRect();

    const zoom_factor = 1 / this.zs.getMixerZoom();

    //on screen position relative to palette
    let screenX = to_rect.x - parent_rect.x + parent.scrollLeft;
    let scaledX = screenX * zoom_factor;

    //on screen position relative to palette
    let screenY = to_rect.y - parent_rect.y + parent.scrollTop;
    let scaledY = screenY * zoom_factor;



    this.b_to = {
      x: scaledX + to_rect.width / 2,
      y: scaledY + to_rect.height / 2
    }


    this.calculateBounds();
    this.drawConnection();
  }


  /*this enambes force calling to redraw outside of subscriptions (e.g. like when a rescale changes)
  */
  refreshConnection() {
    this.updateFromPosition();
    let to = this.tree.getConnectionOutputWithIndex(this.id)
    this.updateToPosition(to.inlet, to.arr);
    this.calculateBounds();
    this.drawConnection();
  }


  /**
   * connections can come from a subdraft or an operation component 
   * @param from the id of the component this connection goes to
   */
  private updateFromPosition() {
    let parent = document.getElementById('scrollable-container');
    let parent_rect = parent.getBoundingClientRect();
    let sd_element = document.getElementById(this.from + '-out');


    if (sd_element === null) return;

    let sd_container = sd_element.getBoundingClientRect();
    const zoom_factor = 1 / this.zs.getMixerZoom();
    //on screen position relative to palette
    let screenX = sd_container.x - parent_rect.x + parent.scrollLeft;
    let scaledX = screenX * zoom_factor;

    //on screen position relative to palette
    let screenY = sd_container.y - parent_rect.y + parent.scrollTop;
    let scaledY = screenY * zoom_factor;



    //draw from the center of the icon
    this.b_from = {
      x: scaledX + (sd_container.width / 2) * zoom_factor,
      y: scaledY + sd_container.height * zoom_factor
    }



    this.calculateBounds();
    this.drawConnection();

  }



  private calculateBounds() {

    let p1: Point = this.b_from;
    let p2: Point = this.b_to;
    let bottomright: Point = { x: 0, y: 0 };

    if (p1 === undefined || p2 === undefined) return;


    this.orientation_x = true;
    this.orientation_y = true;

    if (p2.x < p1.x) this.orientation_x = !this.orientation_x;
    if (p2.y < p1.y) this.orientation_y = !this.orientation_y;

    bottomright.x = Math.max(p1.x, p2.x);
    bottomright.y = Math.max(p1.y, p2.y);


    this.topleft = { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) };

    let cxn_container = document.getElementById('scale-' + this.id);
    cxn_container.style.transform = 'none'; //negate angulars default positioning mechanism
    cxn_container.style.top = this.topleft.y + "px";
    cxn_container.style.left = this.topleft.x + "px";

    this.width = bottomright.x - this.topleft.x + 2; //add two so a line is drawn when horiz or vert
    this.height = bottomright.y - this.topleft.y + 2;
  }


  onMouseOver() {
    if (this.path_main === null || this.path_main === undefined) return;
    this.path_main.style.stroke = '#ff4081';
    this.path_main.style.zIndex = '1000';

    this.path_main.setAttribute("stroke-width", "16"); //2
    this.path_main.setAttribute("stroke-dasharray", "20 20"); //4 2 

  }

  onMouseOut() {
    if (this.path_main === null || this.path_main === undefined) return;
    this.path_main.style.stroke = '#000000';

    this.updateConnectionStyling();

  }


  updateConnectionStyling() {
    if (this.path_main === null || this.path_main === undefined) return;



    if (this.upstream || this.downstream) {
      this.path_main.style.zIndex = '1000';
      this.path_main.setAttribute("stroke-width", "16"); //2
      this.path_main.setAttribute("stroke-dasharray", "20 20"); //4 2 

    } else {
      this.path_main.style.zIndex = '0'
      this.path_main.setAttribute("stroke-width", "4"); //2
      this.path_main.setAttribute("stroke-dasharray", "10 10"); //4 2 
    }

    if (this.recomputing) {
      if (this.anim !== null && this.anim !== undefined) this.anim.play();
    } else {
      if (this.anim !== null && this.anim !== undefined) this.anim.pause();
    }
  }





  drawConnection() {

    if (this.no_draw) return;
    if (this.svg === null || this.svg == undefined) return;

    const stublength = 100; // Length of straight segments
    const yOffset = -40;
    const xOffset = -28;

    if (this.b_to === undefined || this.b_to === null) return;
    if (this.b_from === undefined || this.b_from === null) return;
    if (this.topleft === undefined || this.topleft === null) return;
    // Calculate relative positions within the connection container
    const startX = this.b_from.x - this.topleft.x;
    const startY = this.b_from.y - this.topleft.y;
    const endX = this.b_to.x - this.topleft.x;
    const endY = this.b_to.y - this.topleft.y;

    // Point 100px down from outlet
    const downPointX = startX;
    const downPointY = startY + (stublength * 2);

    // Point 100px above inlet
    const aboveInletX = endX;
    const aboveInletY = endY - (stublength * 4);

    // Point where the path ends (before the connector opening)
    const pathEndX = endX;
    const pathEndY = endY - stublength;

    const path_start = `M ${startX} ${startY}`;
    const path_curve = `C ${downPointX} ${downPointY}, ${aboveInletX} ${aboveInletY}, ${pathEndX} ${pathEndY}`;
    const path_end = `L ${endX} ${endY}`;
    const path = `${path_start} ${path_curve} ${path_end}`;



    this.path_main.setAttribute("d", path);

    // Draw the stub line from path end to the actual inlet
    // this.line_stub.setAttribute("x1", pathEndX + "");
    // this.line_stub.setAttribute("y1", pathEndY + "");
    // this.line_stub.setAttribute("x2", endX + "");
    // this.line_stub.setAttribute("y2", endY + "");

    // Position connector button at the inlet (in the opening)
    // this.connector.style.display = 'block';
    this.connector.style.top = (pathEndY + yOffset) + 'px';
    this.connector.style.left = (pathEndX + xOffset) + 'px';
  }

  drawForPrint(canvas, cx, scale: number) {

    // cx.beginPath();
    // cx.strokeStyle = "#ff4081";
    // cx.setLineDash([scale, 2]);
    // cx.lineWidth = 2;
    // // this.cx.strokeRect(0,0, this.bounds.width, this.bounds.height);
    // if(this.orientation){
    //   cx.moveTo(this.bounds.topleft.x, this.bounds.topleft.y);
    //   cx.lineTo(this.bounds.width + this.bounds.topleft.x, this.bounds.topleft.y + this.bounds.height);
    // }else{
    //   cx.moveTo(this.bounds.topleft.x, this.bounds.height+ this.bounds.topleft.y);
    //   cx.lineTo(this.bounds.width + this.bounds.topleft.x, this.bounds.topleft.y);
    // }
    // cx.stroke();
  }

  /**
   * rescales this compoment. 
   * Call after the operation and subdraft connections have been updated. 
   * @param scale 
   */
  rescale() {

  }


}
