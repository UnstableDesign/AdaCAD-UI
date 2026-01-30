import { Point } from '@angular/cdk/drag-drop';
import { inject, Injectable, ViewRef } from '@angular/core';
import { copyLoom, copyLoomSettings, defaults, DynamicOperation, generateId, getLoomUtilByType, Img, Loom, LoomSettings, Operation, OpInletValType, OpInput, OpOutput, OpParamVal, OpParamValType } from 'adacad-drafting-lib';
import { compressDraft, copyDraft, createDraft, Draft, Drawdown, getDraftName, initDraft, warps, wefts } from 'adacad-drafting-lib/draft';
import { BehaviorSubject } from 'rxjs';
import { SystemsService } from '../../core/provider/systems.service';
import { WorkspaceService } from '../../core/provider/workspace.service';
import { ConnectionComponent } from '../../mixer/palette/connection/connection.component';
import { OperationComponent } from '../../mixer/palette/operation/operation.component';
import { SubdraftComponent } from '../../mixer/palette/subdraft/subdraft.component';
import { Bounds, ConnectionNode, DraftNode, DraftNodeBroadcast, DraftNodeBroadcastFlags, DraftNodeProxy, DraftNodeState, InwardConnectionProxy, IOTuple, Node, NodeComponentProxy, OpComponentProxy, OpNode, OutwardConnectionProxy, TreeNode, TreeNodeProxy } from '../model/datatypes';
import { ErrorBroadcasterService } from './error-broadcaster.service';
import { MediaService } from './media.service';
import { OperationService } from './operation.service';





/**
 * this class registers the relationships between subdrafts, operations, and connections
 */


@Injectable({
  providedIn: 'root'
})

export class TreeService {
  private ws = inject(WorkspaceService);
  private ops = inject(OperationService);
  private media = inject(MediaService);
  private systemsservice = inject(SystemsService);
  private errorBroadcaster = inject(ErrorBroadcasterService);

  nodes: Array<Node> = []; //an unordered list of all the nodes
  tree: Array<TreeNode> = []; //a representation of the node relationships
  private open_connection: number = -1;



  /**
   * go through the list of nodes being loaded and replace any with names that have been outdated.  
   * **/

  async replaceOutdatedOps(nodes: Array<any>): Promise<Array<any>> {

    const correctedNodes = nodes.map(node => {
      if (this.ops.getOp(node.name) === null) {
        const op = this.ops.getOpByOldName(node.name);
        node.name = op.name
        node.inlets = op.inlets;
      }
      return node;
    });

    return Promise.resolve(correctedNodes);
  }



  /** scan through nodes and return all that our valid */
  async validateNodes(): Promise<boolean> {


    const err_ops: Array<Node> = this.nodes
      .filter(el => el.type === "op")
      .filter(el => this.ops.getOp((<OpNode>el).name) === undefined)

    //console.error("found invalid op nodes", err_ops);


    err_ops.forEach(node => {
      this.removeOperationNode(node.id);
    });

    ///also check to see that all connections exist
    const cxns = this.getUnusuedConnections();

    // console.log("unusued connections found", cxns);
    cxns.forEach(el => this.removeNode(el));


    return (err_ops.length === 0);

  }


  /**
   * this fires when any part of the draft node changes and sends a message describing the change. 
   * @param id 
   * @param flags 
   */
  broadcastDraftNodeValueChange(id: number, flags: DraftNodeBroadcastFlags) {
    const node = this.getNode(id);
    if (node.type === 'draft') {
      const draft = (<DraftNode>node).draft;
      const size = draft ? `${warps(draft.drawdown)}x${wefts(draft.drawdown)}` : 'null';


      (<DraftNode>node).onValueChange.next({ id: id, draft: draft, loom: (<DraftNode>node).loom, loom_settings: (<DraftNode>node).loom_settings, flags: flags });
    }
  }


  setOpParams(id: number, params: Array<OpParamValType>, inlets: Array<OpInletValType>) {
    this.getOpNode(id).params = params.slice();
    this.getOpNode(id).inlets = inlets.slice();
  }

  /**
   * this is called when a dynamic operation's parameter updates and therefore, must change inlet values
   * @param node_id an object containing the id of hte parameter that has changed
   * @param param_id the id of the parameter that changed
   * @param value the value at that parameter
   * @returns a list of inlet values to add.
   */
  onDynanmicOperationParamChange(opid: number, name: string, inlets: Array<any>, param_id: number, param_val: any): Array<any> {

    const op = <DynamicOperation>this.ops.getOp(name);
    const param_type = op.params[param_id].type
    const opnode = this.getOpNode(opid);

    if (!this.ops.isDynamic(name)) return;


    if (op.dynamic_param_id !== param_id) return;


    let param_vals: Array<OpParamVal> = opnode.params.map((el, ndx) => {
      return { op_name: name, param: op.params[ndx], val: el }
    });


    inlets = op.onParamChange(param_vals, op.inlets, inlets, param_id, param_val);

    return inlets;
  }





  /**
   * loads data into an operation node from a file load, or when an operation is first instantiated,  or undo/redo event
   * @param entry the upload entry associated with this node or null if there was no upload associated
   * @param name the name of the operation
   * @param params the parameters to input
   * @param inlets an array containing the paramteres that get mapped to inputs at each inlets
   * @returns the node and the entry
   */
  loadOpData(entry: { prev_id: number, cur_id: number }, name: string, params: Array<any>, inlets: Array<any>): Promise<{ on: OpNode, entry: { prev_id: number, cur_id: number } }> {


    const nodes = this.nodes.filter(el => el.id === entry.cur_id);
    let op = this.ops.getOp(name);

    if (nodes.length !== 1) {
      return Promise.reject("found 0 or more than 1 nodes at id " + entry.cur_id);
    }

    const node = nodes[0];

    if (op === undefined || op === null) {
      return Promise.reject("no op of name:" + name + " exists");

    }



    if (params === undefined) {
      params = [];
    }

    if (params === undefined) {
      inlets = [];
    }

    const param_types = op.params.map(el => el.type);


    const formatted_params = param_types.map((type, ndx) => {
      switch (type) {
        case "boolean":
          return (params[ndx]) ? 1 : 0;

        case "file":
          const id_and_data = this.media.getMedia(params[ndx]);
          if (id_and_data === null || id_and_data.img === null) return { id: params[ndx], data: null }
          else return { id: params[ndx], data: id_and_data.img };

        default:
          return params[ndx];
      }
    });

    const default_param_values = this.ops.getOp(name).params.map(el => el.value);

    //this gets teh default values for the opration
    //this overwrites some of those with any value that has been previous added
    const params_out = default_param_values.map((p, ndx) => {
      if (ndx < params.length) return formatted_params[ndx];
      else return p;
    });

    const default_inlet_values = this.ops.getOp(name).inlets.map(el => el.value);

    if (inlets === undefined || inlets.length == 0) {
      inlets = default_inlet_values.slice();
      if (this.ops.isDynamic(name)) {
        const op = <DynamicOperation>this.ops.getOp(name);
        (<OpNode>node).params = params_out.slice()
        //this just forces the inlets to generate by simulating a parameter change
        let dynamic_inlets = this.onDynanmicOperationParamChange(node.id, name, inlets, op.dynamic_param_id, op.params[op.dynamic_param_id].value);

        inlets = dynamic_inlets.slice();
      }
    }

    inlets = inlets.map(el => (el === null) ? 0 : el);


    node.dirty = false;
    (<OpNode>node).name = name;
    (<OpNode>node).params = params_out.slice();
    (<OpNode>node).inlets = inlets.slice();

    return Promise.resolve({ on: <OpNode>nodes[0], entry });




  }

  /**
   * recomputes the value of every loom. 
   */
  updateLooms() {
    this.getDraftNodes().forEach(dn => {

      const loom_utils = getLoomUtilByType(dn.loom_settings.type);
      loom_utils.computeLoomFromDrawdown(dn.draft.drawdown, dn.loom_settings).then(loom => {
        dn.loom = loom;
      });
    });

  }




  /**
   * returns a list of all the node ids of drafts that are dirty (including preview)
   */
  getDirtyDrafts(): Array<number> {

    return this.nodes.filter(el => el.type === "draft")
      .filter(el => el.dirty)
      .map(el => el.id);
  }


  /**
   * load the data into the draft node
   * @param entry the map entry associated with this node, null if not supplied
   * @param id the id of this node, which should match the component
   * @param draft the draft to associate with this node
   * @param loom the loom to associate with this node
   * @returns the created draft node and the entry associated with this
   */
  loadDraftData(entry: { prev_id: number, cur_id: number }, draft: Draft, loom: Loom, loom_settings: LoomSettings, render_colors: boolean, scale: number, draft_visible: boolean): Promise<{ dn: DraftNode, entry: { prev_id: number, cur_id: number } }> {

    console.log("[loadDraftData] LOADING DRAFT DATA", entry, draft, loom, loom_settings, render_colors, scale, draft_visible);
    console.log("[loadDraftData] Loom being loaded:", loom ? {
      threading: loom.threading,
      treadling: loom.treadling,
      tieup: loom.tieup
    } : null);
    console.log("[loadDraftData] Loom settings being loaded:", loom_settings);
    const nodes = this.nodes.filter(el => el.id === entry.cur_id);
    if (nodes.length !== 1) return Promise.reject("found 0 or more than 1 nodes at id " + entry.cur_id);

    const draftNode: DraftNode = <DraftNode>nodes[0];

    draftNode.dirty = true;
    draft.id = entry.cur_id;
    draft.gen_name = draft.gen_name ?? 'drafty';
    draft.ud_name = draft.ud_name ?? '';
    draft.notes = draft.notes ?? '';

    const flags: DraftNodeBroadcastFlags = {
      meta: true,
      draft: true,
      loom: true,
      loom_settings: true,
      materials: true
    };

    if (loom_settings === null || loom_settings == undefined) {
      console.log("[loadDraftData] Loom settings are null/undefined, using workspace defaults");
      this.setLoomSettings(entry.cur_id, {
        type: this.ws.type,
        epi: this.ws.epi,
        ppi: this.ws.ppi,
        units: this.ws.units,
        frames: this.ws.min_frames,
        treadles: this.ws.min_treadles
      }, false);

    } else {
      console.log("[loadDraftData] Setting loom settings from loaded data:", loom_settings);
      draftNode.loom_settings = loom_settings;
      draftNode.loom_settings.ppi = loom_settings.ppi ?? defaults.loom_settings.ppi;
    }


    if (loom === null || loom == undefined || loom_settings.type === "jacquard") {
      console.log("[loadDraftData] Loom is null/undefined, setting null loom");
      this.setLoom(entry.cur_id, null, false);
    } else {
      console.log("[loadDraftData] Setting loom from loaded data");
      this.setLoom(entry.cur_id, copyLoom(loom), false);
    }

    if (render_colors === undefined || render_colors === null) draftNode.render_colors = false;
    else draftNode.render_colors = render_colors;

    if (scale === undefined || scale === null) draftNode.scale = 1;
    else draftNode.scale = scale;

    if (draft_visible == undefined || draft_visible == null) draftNode.visible = true;
    else draftNode.visible = draft_visible;

    this.setDraft(entry.cur_id, copyDraft(draft), flags, true, false);

    return Promise.resolve({ dn: draftNode, entry });
  }


  /**
   * loads in data to the nodes, from undo/redo or new file additions.
   * when loading new files or states, the tree will have been previously cleared. \
   * when loading new nodes from a file into an existing workspace,new ids must be assigned to ensure they are unique
   * nodes are loaded before the view has been inititialized 
   * when new data is loaded, it makes sure each of the ids generated is unique
   * @param type the type of node to create
   * @param id the current id of the 
   * @returns a map representating any id changes
   */
  loadNode(type: 'draft' | 'op' | 'cxn', id: number): { prev_id: number, cur_id: number } {

    let node: Node;
    let new_id: number;

    switch (type) {
      case 'draft':
        new_id = this.createNode('draft', null, null);
        break;
      case 'op':
        new_id = this.createNode('op', null, null);
        break;
      case 'cxn':
        new_id = this.createNode('cxn', null, null);
        break;
    }

    return { prev_id: id, cur_id: new_id };
  }





  getConnectionsInvolving(node_id: number): { from: number, to: number } {

    const tn = this.getTreeNode(node_id);
    if (tn.outputs.length !== 1) console.error("connection node has more than one to");
    if (tn.inputs.length !== 1) console.error("connection node has more than one from");

    return { from: tn.inputs[0].tn.node.id, to: tn.outputs[0].tn.node.id };


  }


  /**
   * given an operation and a connection, return the inlet to which this connection inserts 
   * @param op_id 
   * @param cxn_id 
   * @param returns the position index of the cxn or -1 if not found
   */
  getInletOfCxn(op_id: number, cxn_id): number {
    const inputs = this.getInputsWithNdx(op_id);
    const ndx: Array<number> = inputs
      .filter(el => el.tn.node.id === cxn_id)
      .map(el => el.ndx);

    if (ndx.length === 0) return -1;
    if (ndx.length === 1) return ndx[0];

    console.error("connection found at more than one inlet");
    return -1;

  }

  /**
   * before performing a dynamic op, make sure that their are no connections that are pointing to an inlet that nolonger exists
   * @param id - the object id we are checking
   * @param prior_inlet_vals the prior value of the inlets, used for reorienting connections
   * @returns an array of viewRefs for Connections to remove.
   */
  sweepInlets(id: number, prior_inlet_vals: Array<any>): Promise<Array<ViewRef>> {

    const opnode: OpNode = this.getOpNode(id);
    if (!this.ops.isDynamic(opnode.name)) return Promise.resolve([]);



    const inputs_to_op: Array<IOTuple> = this.getInputsWithNdx(id);




    const viewRefs: Array<ViewRef> = [];

    inputs_to_op.forEach((iotuple) => {

      //what was the value of the inlet
      if (prior_inlet_vals.length !== 0) {
        let prior_val = prior_inlet_vals[iotuple.ndx];

        let new_ndx = opnode.inlets.findIndex(el => {
          let new_string = el.toString();
          return new_string.includes(prior_val.toString());
        });


        if (new_ndx == -1) {
          this.removeConnectionNode(iotuple.tn.inputs[0].tn.node.id, iotuple.tn.outputs[0].tn.node.id, iotuple.ndx);
          viewRefs.push(iotuple.tn.node.ref)
        } else {
          iotuple.ndx = new_ndx;
        }
      }
    })

    return Promise.resolve(viewRefs);

  }


  /**
   * when an operation has a variable amount of outputs, there may be cases where we need to delete one of the outputs 
   * if it is no longer needed
   * @param id the operation id, 
  * @returns 
   */
  sweepOutlets(id: number): Promise<Array<ViewRef>> {

    const drafts: Array<number> = this.getNonCxnOutputs(id);
    const viewRefs: Array<ViewRef> = [];

    drafts.forEach(did => {
      let draft = <DraftNode>this.getNode(did);
      if (draft.mark_for_deletion) {
        viewRefs.push(draft.ref);
        this.removeConnectionNode(id, did, 0);
        this.removeSubdraftNode(did);
      }
    })


    return Promise.resolve(viewRefs);

  }


  /**
   * sets the open connection
   * @param id the value to set the open connection to
   * @returns  true if the id maps to a subdraft
   */
  setOpenConnection(id: number): boolean {
    if (this.getType(id) !== 'draft') return false;
    this.open_connection = id;
    return true;
  }

  hasOpenConnection(): boolean {
    return this.open_connection !== -1;
  }

  getOpenConnection(): SubdraftComponent {
    return <SubdraftComponent>this.getComponent(this.open_connection);
  }

  getOpenConnectionId(): number {
    return this.open_connection;
  }


  /**
   * TEMP DISABLE DUE TO CAUSING PROBLEMS 
   * unsets the open connection
   * @returns  true if it indeed changed the value
   */
  unsetOpenConnection(): boolean {
    this.open_connection = -1;
    return true;
  }

  setNodeComponent(id: number, c: SubdraftComponent | OperationComponent | ConnectionComponent) {
    const node: Node = this.getNode(id);
    node.component = c;
  }

  setNodeViewRef(id: number, v: ViewRef) {
    const node: Node = this.getNode(id);
    node.ref = v;
  }

  /** clears all the data associated with this tree */
  clear() {
    this.tree = [];
    this.nodes = [];
  }


  /** depends on having nodes created first so that all tree nodes are present */


  /**
   * this function is called from the mixer when processing file data. It depends on having all nodes created first. 
   * @param id_map this is a map created on upload that maps uploaded ids to the current ids. 
   * @param node_id the current node_id
   * @param parent_id the current treenode id of the parent node
   * @param inputs the current treenode ids for all inputs
   * @param outputs the current treenode ids for all outputs
   * @returns an object that holds the tree node as well as its associated map entry
   */

  async loadTreeNodeData(id_map: any, node_id: number, parent_id: number, inputs: Array<{ tn: number, ndx: number }>, outputs: Array<{ tn: number, ndx: number }>): Promise<{ tn: TreeNode, entry: { prev_id: number, cur_id: number } }> {

    const entry = id_map.find(el => el.cur_id === node_id);

    const tn: TreeNode = this.getTreeNode(node_id);
    tn.parent = (parent_id === -1) ? null : this.getTreeNode(parent_id);
    tn.inputs = inputs
      .filter(input => input !== undefined)
      .map(input => { return { tn: this.getTreeNode(input.tn), ndx: input.ndx } });
    tn.outputs = outputs
      .filter(output => output !== undefined)
      .map(output => {
        return { tn: this.getTreeNode(output.tn), ndx: output.ndx }
      });
    return Promise.resolve({ tn, entry });


  }


  private createDraftNode(ref: ViewRef, component: SubdraftComponent, draft: Draft, loom: Loom, loom_settings: LoomSettings, render_colors: boolean, scale: number, visible: boolean): DraftNode {

    const dnb: DraftNodeBroadcast = {
      id: generateId(8),
      draft: draft,
      loom: loom,
      loom_settings: loom_settings,
      flags: {
        meta: true,
        draft: true,
        loom: true,
        loom_settings: true,
        materials: true
      }
    }

    const node: DraftNode = {
      type: 'draft',
      ref: ref,
      id: generateId(8),
      component: component,
      dirty: false,
      draft: draft,
      loom: loom,
      loom_settings: loom_settings,
      render_colors: render_colors,
      scale: scale,
      visible: visible,
      mark_for_deletion: false,
      onValueChange: new BehaviorSubject<DraftNodeBroadcast>(dnb),
      canvases: null,
      positionChange: new BehaviorSubject<Point>(null)
    }
    return node;
  }

  createOpNode(ref: ViewRef, component: OperationComponent, name: string, params: Array<any>, inlets: Array<any>): OpNode {
    const node: OpNode = {
      type: 'op',
      ref: ref,
      id: generateId(8),
      component: component,
      inlets: inlets,
      dirty: false,
      params: params,
      name: name,
      recomputing: new BehaviorSubject<boolean>(false),
      checkChildren: new BehaviorSubject<boolean>(true),
      positionChange: new BehaviorSubject<Point>(null)
    }
    return node;
  }

  private createConnectionNode(ref: ViewRef, component: ConnectionComponent): ConnectionNode {

    const recomputing = new BehaviorSubject<boolean>(false);
    const upstreamOfSelected = new BehaviorSubject<boolean>(false);
    const downstreamOfSelected = new BehaviorSubject<boolean>(false);

    const node: ConnectionNode = {
      type: 'cxn',
      ref: ref,
      id: generateId(8),
      component: component,
      dirty: false,
      upstreamOfSelected: upstreamOfSelected,
      downstreamOfSelected: downstreamOfSelected
    }
    return node;
  }


  /**
   * create an node and add it to the tree (without relationships)
   * THIS IS THE ONLY FUNCTION THAT IS ABLE TO CREATE NODES AND ADD THEM TO THE TREE
   * @param id a unique id for this component, ideally created by the viewCompomentRef 
   * @param type the type of component
   * @param component the compoenent instance
   * @returns the id assigned
   */
  createNode(type: 'draft' | 'op' | 'cxn', component: SubdraftComponent | OperationComponent | ConnectionComponent, ref: ViewRef): number {


    let node: Node;

    switch (type) {
      case 'draft':
        node = this.createDraftNode(ref, <SubdraftComponent>component, null, null, null, false, 1, true);
        break;
      case 'op':
        node = this.createOpNode(ref, <OperationComponent>component, '', [], []);
        break;
      case 'cxn':
        node = this.createConnectionNode(ref, <ConnectionComponent>component);
        break;
    }

    this.nodes.push(node);

    this.tree.push({
      node: node,
      parent: null,
      outputs: [],
      inputs: []
    });


    return node.id;
  }

  getComponent(id: number): SubdraftComponent | ConnectionComponent | OperationComponent {
    const node: Node = this.getNode(id);
    return node.component;
  }

  getComponents(): Array<any> {
    return this.nodes.map(node => node.component);
  }

  getNode(id: number): Node {
    const ndx: number = this.getNodeIndex(id);
    if (ndx === -1) return null;
    return this.nodes[ndx];
  }



  /**
   * this function returns the smallest bounding box that can contain all of the input nodes. This function does not consider the scrolling (all measures are relative to the node parent (palette-scale-container). This means that the values will be the same no matter the scroll or the zoom. 
   * @returns The Bounds or null (if there are no nodes with which to measure)
   */
  getNodeBoundingBox(node_ids: Array<number>): Bounds | null {

    if (this.nodes.length == 0) return null;


    const raw_rects = node_ids
      .map(node => document.getElementById('scale-' + node))
      .filter(div => div != null)
      .map(div => { return { x: div.offsetLeft, y: div.offsetTop, width: div.offsetWidth, height: div.offsetHeight } });

    const min: Point = raw_rects.reduce((acc, el) => {
      let adj_x = el.x;
      let adj_y = el.y;
      if (adj_x < acc.x) acc.x = adj_x;
      if (adj_y < acc.y) acc.y = adj_y;
      return acc;
    }, { x: 1000000, y: 100000 });

    const max: Point = raw_rects.reduce((acc, el) => {
      let adj_right = el.x + el.width;
      let adj_bottom = el.y + el.height;
      if (adj_right > acc.x) acc.x = adj_right;
      if (adj_bottom > acc.y) acc.y = adj_bottom;
      return acc;
    }, { x: 0, y: 0 });


    let bounds: Bounds = {
      topleft: { x: min.x, y: min.y },
      width: max.x - min.x,
      height: max.y - min.y
    }

    // console.log('BOUNDS FOR COMPONENTS', min, max, bounds)
    return bounds;

  }



  getNodeIdList(): Array<number> {
    return this.nodes.map(node => node.id);
  }

  getNodeIndex(id: number): number {
    return this.nodes.findIndex(el => (el.id == id));
  }

  getType(id: number): string {

    const node: Node = this.getNode(id);
    if (node == null) return 'null'
    return node.type;
  }

  getViewRef(id: number): ViewRef {
    const node: Node = this.getNode(id);
    return node.ref;
  }


  /**
   * get's this subdraft's parent
   * @param sd_id 
   * @returns the parent's id, or -1 if it has no parent
   */
  getSubdraftParent(sd_id: number): number {
    const tn: TreeNode = this.getTreeNode(sd_id);
    if (tn == null || tn == undefined || tn.parent === null || tn.parent === undefined) return -1;
    else return tn.parent.node.id;
  }

  hasParent(sd_id: number): boolean {
    return (this.getSubdraftParent(sd_id) === -1) ? false : true;
  }

  /**
   * return the connection objects that are immediately attached to this object
   * @param id - the node id
   * @returns an array of id's for the immediatly connected connections
   */
  getNodeConnections(id: number): Array<number> {
    const tn: TreeNode = this.getTreeNode(id);
    const out_node: Array<Node> = tn.outputs.map(el => el.tn.node);
    const out_cxn: Array<Node> = out_node.filter(el => el.type === 'cxn');
    const in_node: Array<Node> = tn.inputs.map(el => el.tn.node);
    const in_cxn: Array<Node> = in_node.filter(el => el.type === 'cxn');
    const join: Array<Node> = out_cxn.concat(in_cxn);
    return join.map(el => el.id);
  }

  /**
   * gets a list of non-connection nodes that need to be updated if this node moves. 
   * this takes into acccount that some nodes have a parent that will move with them.
   * @param id 
   * @returns 
   */
  getNodesToUpdateOnMove(id: number) {

    const tn: TreeNode = this.getTreeNode(id);
    let to_check: Array<number> = [id];

    if (this.isMultipleParent(id) || this.isSibling(id)) return to_check;

    //the parent if there is one
    if (tn.parent !== null) to_check.push(tn.parent.node.id);

    //add the child this node generated if there is one. 
    const outputs: Array<TreeNode> = this.getNonCxnOutputs(id).map(el => this.getTreeNode(el));


    const has_parents: Array<TreeNode> = outputs.filter(el => (el.parent !== null));
    const is_child: Array<number> = has_parents.filter(el => (el.parent.node.id === id)).map(el => el.node.id);

    if (is_child.length > 0) to_check = to_check.concat(is_child);



    return to_check;

  }

  /**
   * called on an operation to check if it can accept connections from a given subdraft
   * @param id - the id of the operation in question
   * @param inlet - the inlet id we are looking at
   */
  canAcceptConnections(id: number, inlet: number): boolean {

    if (this.open_connection === -1) {
      console.error("no open connection");
      return false;    //there is no open connection
    }

    const parent_op = this.getSubdraftParent(this.open_connection);

    if (parent_op === id) {
      return false; //can't be an input to your parent
    }

    const is_already_connected = this.getInputsAtNdx(id, inlet).length > 0 && this.getInputs(id).find(el => el === this.open_connection) !== undefined;
    if (is_already_connected) {
      // console.error("already connected, draft=", this.open_connection, " opid=", id);
      return false; //these two things are already directly connected
    }



    const has_room = (this.getInputs(id).length < (<OperationComponent>this.getComponent(id)).op.inlets[inlet].num_drafts || (<OperationComponent>this.getComponent(id)).op.inlets[inlet].num_drafts == -1);
    if (!has_room) return false;

    if (parent_op === -1 && has_room) return true; //if you don't have a parent and there is room, go for it

    const upstream = this.getUpstreamOperations(parent_op);
    const no_circles = upstream.length == 0 || upstream.find(el => el === parent_op) == -1;

    return has_room && no_circles;
  }

  /**
   * test if this node has children, as opposed to just zero
   * @param id 
   * @returns a boolean 
   */
  isParent(id: number): boolean {
    const tn: TreeNode = this.getTreeNode(id);
    return (tn.outputs.length > 0);
  }

  /**
   * test if this node is a seed (e.g. has no inputs)
   * @param id 
   * @returns a boolean 
   */
  isSeedDraft(id: number): boolean {
    const tn: TreeNode = this.getTreeNode(id);
    return (this.getType(id) === "draft" && tn.inputs.length === 0);
  }

  /**
 * test if this node has just one child. 
 * @param id 
 * @returns a boolean 
 */
  hasSingleChild(id: number): boolean {
    const tn: TreeNode = this.getTreeNode(id);
    return (tn.outputs.length === 1);
  }


  /**
   * test if this node has just one child and that child subdraft is currently hidden 
   * @param id 
   * @returns a boolean 
   */
  opHasHiddenChild(id: number): boolean {
    const tn: TreeNode = this.getTreeNode(id);
    const outs = this.getNonCxnOutputs(id);

    if (outs.length === 0) return false;

    const child_id = outs.shift();
    let child_visible = this.getDraftVisible(child_id);
    return !child_visible;
  }




  /**
   * test if this node has many children, as opposed to just one
   * @param id 
   * @returns a boolean 
   */
  isMultipleParent(id: number): boolean {
    const tn: TreeNode = this.getTreeNode(id);
    return (tn.outputs.length > 1);
  }

  /**
   * test if two components are siblings (e.g. they have the same parent). 
   * if we pass the same id in for both, it will return false
   * @param id 
   * @returns a boolean 
   */
  areSiblings(a_id: number, b_id: number): boolean {

    if (a_id === b_id) return false;

    const atn: TreeNode = this.getTreeNode(a_id);
    const btn: TreeNode = this.getTreeNode(b_id);
    if (atn.parent == null || btn.parent == null) return false;
    return (atn.parent.node.id === btn.parent.node.id);
  }

  /**
 * test if this node is a sibling of the one provided
 * @param id 
 * @returns a boolean 
 */
  isSibling(id: number): boolean {
    const tn: TreeNode = this.getTreeNode(id);
    if (tn.parent == null) return false;
    return (this.getTreeNode(tn.parent.node.id).outputs.length > 1);
  }



  /**
   * given a node, recusively walks the tree and returns a list of all the operations that are affected
   * @param id 
   * @returns an array of operation ids for nodes that need recalculating
   */
  getDownstreamOperations(id: number): Array<number> {

    let ops: Array<number> = [];
    const tn: TreeNode = this.getTreeNode(id);
    if (tn.outputs.length > 0) {

      tn.outputs.forEach(el => {
        if (el.tn.node.type == 'op') {
          ops.push(el.tn.node.id);
        }
        ops = ops.concat(this.getDownstreamOperations(el.tn.node.id));
      });
    }
    return ops;
  }

  getDownstreamConnections(id: number): Array<number> {
    let nodes = this.getAllDownstreamNodes(id);
    return nodes.filter(el => this.getType(el) === 'cxn');
  }

  /**
  * given a node, recusively walks the tree and returns a list of all the nodes that branch from this parent
  * @param id 
  * @returns an array of node ids
  */
  getAllDownstreamNodes(id: number): Array<number> {

    let nodes: Array<number> = [];
    const tn: TreeNode = this.getTreeNode(id);
    if (tn.outputs.length > 0) {

      tn.outputs.forEach(el => {
        nodes.push(el.tn.node.id);
        nodes = nodes.concat(this.getAllDownstreamNodes(el.tn.node.id));
      });
    }
    return nodes;
  }

  getAllUpstreamNodes(id: number): Array<number> {
    let nodes: Array<number> = [];
    const tn: TreeNode = this.getTreeNode(id);
    if (tn.inputs.length > 0) {
      tn.inputs.forEach(el => {
        nodes.push(el.tn.node.id);
        nodes = nodes.concat(this.getAllUpstreamNodes(el.tn.node.id));
      });
    }
    return nodes;
  }

  getUpstreamConnections(id: number): Array<number> {
    let nodes = this.getAllUpstreamNodes(id);
    return nodes.filter(el => this.getType(el) === 'cxn');
  }

  /**
 * given a node, recusively walks the tree and returns a list of all the operations that are linked up the chain to this component
 * @param id 
 * @returns an array of operation ids that influence this draft
 */
  getUpstreamOperations(id: number): Array<number> {

    let ops: Array<number> = [];
    const tn: TreeNode = this.getTreeNode(id);

    if (tn.inputs.length > 0) {
      tn.inputs.forEach(el => {
        if (el.tn.node.type === 'op') {
          ops.push(el.tn.node.id);
        }
        ops = ops.concat(this.getUpstreamOperations(el.tn.node.id));
      });
    }
    return ops;
  }




  /**
 * given a node, recusively walks the tree and returns a list of all the drafts that are linked up the chain to this component
 * @param id 
 * @returns an array of draft ids that influence this draft
 */
  getUpstreamDrafts(id: number): Array<number> {
    let ops: Array<number> = [];
    const tn: TreeNode = this.getTreeNode(id);

    if (tn.inputs.length > 0) {
      tn.inputs.forEach(el => {
        if (el.tn.node.type == 'draft') {
          ops.push(el.tn.node.id);
        }
        ops = ops.concat(this.getUpstreamDrafts(el.tn.node.id));
      });
    }
    return ops;
  }

  /**
     * removes a subdraft and all associated connections from the tree, returns the nodes
     * @param id {number}  
  
     */
  removeSubdraftNode(id: number): Array<Node> {


    const deleted: Array<Node> = [];
    if (id === undefined) return;




    //get any input ops and connections
    const ops_in: Array<number> = this.getNonCxnInputs(id);
    const cxns_in: Array<number> = this.getInputs(id);

    //get output connections and subdrafts
    const cxns_out: Array<number> = this.getOutputs(id); //the connection between the op and child subdrafts
    const ops_out: Array<number> = this.getNonCxnOutputs(id); //get all 

    //get all the output connections of those subdrafts
    const op_in_cxns: Array<number> = ops_in.reduce((acc, el) => {
      return acc.concat(this.getInputs(el))
    }, []);

    // console.log("Ops in", ops_in);
    // console.log("CXNs in", cxns_in);
    // console.log("CXNs out", cxns_out);
    // console.log("OPSs out", ops_out);
    // console.log("op connections in", op_in_cxns);

    deleted.push(this.removeNode(id));

    cxns_in.forEach(el => {
      deleted.push(this.removeNode(el));
    });

    cxns_out.forEach(el => {
      deleted.push(this.removeNode(el));
    });


    ops_in.forEach(el => {
      deleted.push(this.removeNode(el));
    });


    op_in_cxns.forEach(el => {
      deleted.push(this.removeNode(el));
    });
    // deleted.concat(sds_in.map(el => this.removeNode(el)));
    // deleted.concat(cxns_in.map(el => {return this.removeNode(el)}));
    // deleted.concat(cxns_out.map(el => {return this.removeNode(el)}));
    //deleted.concat(sds_out.map(el => {return this.removeNode(el)}));
    //deleted.concat(sds_out_cxns.map(el => {return this.removeNode(el)}));

    return deleted;

  }

  /**
   * deletes an operation node and any associated subdrafts and connections
   * @param id - the operation to remove
   * @returns a list of all nodes removed as a result of this action
   */
  removeOperationNode(id: number): Array<Node> {


    const deleted: Array<Node> = [];
    if (id === undefined) return;


    //get any input subdrafts and connections
    const sds_in: Array<number> = this.getNonCxnInputs(id);

    const cxns_in: Array<number> = this.getInputs(id);

    //get output connections and subdrafts
    const cxns_out: Array<number> = this.getOutputs(id); //the connection between the op and child subdrafts
    const sds_out: Array<number> = this.getNonCxnOutputs(id); //get all 

    //get all the output connections of those subdrafts
    const sds_out_cxns: Array<number> = sds_out.reduce((acc, el) => {
      return acc.concat(this.getOutputs(el))
    }, []);

    // console.log("SDs in", sds_in);
    // console.log("CXNs in", cxns_in);
    // console.log("CXNs out", cxns_out);
    // console.log("SDs out", sds_out);
    // console.log("sd connections out", sds_out_cxns);

    deleted.push(this.removeNode(id));

    cxns_in.forEach(el => {
      deleted.push(this.removeNode(el));
    });

    cxns_out.forEach(el => {
      deleted.push(this.removeNode(el));
    });


    sds_out.forEach(el => {
      deleted.push(this.removeNode(el));
    });


    sds_out_cxns.forEach(el => {
      deleted.push(this.removeNode(el));
    });
    return deleted;

  }


  /**
   * deletes a connection between two nodes (an op and a draft)
   * @param from the id of the node this connection is coming from
   * @param to the id of the node this connection is going to
   * @param inletid the id of the inlet into which this connection is traveling. 
   * @returns 
   */
  removeConnectionNode(from: number, to: number, inletid: number): Array<Node> {


    const cxn_id: number = this.getConnectionAtInlet(from, to, inletid);

    const deleted: Array<Node> = [];
    if (cxn_id === undefined) return;

    deleted.push(this.removeNode(cxn_id));

    return deleted;

  }

  removeConnectionNodeById(cxn_id: number): Array<Node> {



    const deleted: Array<Node> = [];
    if (cxn_id === undefined) return;

    deleted.push(this.removeNode(cxn_id));

    return deleted;

  }



  /**
   * this removes a node from the list and tree
   * @param id the id of the node to be removed
   * @returns the node it removed
   */
  removeNode(id: number): Node {


    const deleted: Array<Node> = [];

    const node: Node = this.getNode(id);
    deleted.push(node);
    if (node === undefined) return;


    this.removeNodeTreeAssociations(node.id);

    const ndx: number = this.getNodeIndex(id);
    const i: number = this.tree.findIndex(el => (el.node.id == id));
    this.tree.splice(i, 1);
    this.nodes.splice(ndx, 1);

    return node;

  }




  // /**
  //  * searches within the downstream ops for all opnodes and when a "dirty" node has all possible inputs fulfilled
  //  * @returns return a list of those nodes
  //  */
  // getNodesWithDependenciesSatisfied(): Array<OpNode> {

  //   const dependency_nodes: Array<OpNode> = this.nodes
  //     .filter(el => el.dirty && el.type === "op")
  //     .map(el => <OpNode>el);

  //   // const dependency_nodes: Array<OpNode> = ds
  //   // .map(el => <OpNode> this.getNode(el))
  //   // .filter(el => el.dirty);

  //   const ready: Array<OpNode> = dependency_nodes.filter((el, ndx) => {
  //     const depends_on: Array<number> = this.getUpstreamOperations(el.id);
  //     const needs = depends_on.map(id => this.getNode(id).dirty);
  //     const find_true = needs.findIndex(el => el === true);
  //     if (find_true === -1) return el;
  //   });

  //   return ready;
  // }


  //if an operation results in an empty draft, then it is reset here
  clearDraft(dn: DraftNode) {


    dn.draft = initDraft();
    dn.draft.ud_name = "This operation needs more inputs to create a draft";


  }

  /**
   * This function runs when the operation returns. 
   * When it returns, it will return an array of drafts and optionally, looms that must be associated with those drafts. 
   * All operations must have at least 1 output in order to maintain connections in the tree so if a funciton returns an empty array
   * it needs to generate a "null" 0x0 draft. 
   * 
   * 
     * given the results of an operation, updates any associated drafts, creating or adding null drafts to no longer needed drafts
     * since this function cannot delete nodes, it makes nodes that no longer need to exist as null for later collection
     * basically it has to associate drafts with the existing or new nodes
     * @param res the list of results from perform op
     * @returns a list of the draft nodes touched. 
     */
  async updateDraftsFromResults(parent: number, outputs: Array<OpOutput>, inputs: Array<OpInput>): Promise<Array<number>> {
    console.log("UPDATING DRAFTS FROM RESULTS", parent, outputs, inputs);
    const out = this.getNonCxnOutputs(parent);
    const op_outlets = this.getOutputsWithNdx(parent);

    const touched: Array<number> = [];
    const opnode: OpNode = this.getOpNode(parent);
    const op: Operation = this.ops.getOp(opnode.name);
    const new_draft_fns = [];


    const param_vals = op.params.map((param, ndx) => {
      return {
        param: param,
        val: opnode.params[ndx]
      }
    })

    //first, cycle through the resulting nodes: 
    for (let i = 0; i < outputs.length; i++) {

      //in the case where there are multiple outcomes - get the output associated with the ndx "i"
      let active_tn_tuple = op_outlets.find(el => el.ndx == i);

      if (active_tn_tuple !== undefined) {
        let cxn_child = this.getOutputs(active_tn_tuple.tn.node.id);
        if (cxn_child.length > 0) {
          outputs[i].draft.gen_name = op.generateName(param_vals, inputs)
          if (outputs[i].loom !== undefined) this.setLoom(cxn_child[0], outputs[i].loom, false)
          if (outputs[i].loom_settings !== undefined) this.setLoomSettings(cxn_child[0], outputs[i].loom_settings, false)

          const flags: DraftNodeBroadcastFlags = {
            meta: true,
            draft: true,
            loom: true,
            loom_settings: false,
            materials: true
          };
          console.log("SETTING DRAFT a", cxn_child[0], outputs[i].draft, flags);
          this.setDraft(cxn_child[0], outputs[i].draft, flags, true, false);
          touched.push(cxn_child[0]);

        }
      } else {
        //if there are more drafts than indexes (i > is not found in outlets, we need to create a new outcome node)
        const id = this.createNode('draft', null, null);
        const cxn = this.createNode('cxn', null, null);
        this.addConnection(parent, i, id, 0, cxn);
        new_draft_fns.push(this.loadDraftData({ prev_id: -1, cur_id: id }, outputs[i].draft, (outputs[i].loom ?? null), (outputs[i].loom_settings ?? null), true, 1, !this.ws.hide_mixer_drafts));
        touched.push(id);
      }

    }

    const old_draft_objs = out.filter(el => touched.find(subel => subel == el) == undefined);
    const to_delete = old_draft_objs.slice(1);

    //now sweep through and see if there are any existing outputs we need to remove
    old_draft_objs.forEach((output) => {
      const dn = <DraftNode>this.getNode(output);
      this.clearDraft(dn);

    });

    to_delete.forEach(output => {
      const dn = <DraftNode>this.getNode(output);
      dn.mark_for_deletion = true;
    })


    return Promise.all(new_draft_fns)
      .then(drafts_loaded => {

        console.log("DRAFTS LOADED", drafts_loaded);
        const ids = drafts_loaded.map(el => el.entry.cur_id);
        ids.forEach((id, ndx) => {
          let d = this.getDraft(id);
          d.gen_name = op.generateName(param_vals, inputs);
          const dn = <DraftNode>this.getNode(id);
          const flags: DraftNodeBroadcastFlags = {
            meta: true,
            draft: true,
            loom: true,
            loom_settings: true,
            materials: true
          };
          this.setDraft(dn.id, d, flags, true, false);
          dn.dirty = true;
        })

        opnode.checkChildren?.next(true);
        return Promise.resolve(touched);
      });


  }


  /**
   * called when there have been edits made to a draft that has outputs to other operations
   * @param id 
   */
  async recomputeDraftChildren(id: number) {
    const dn = <DraftNode>this.getNode(id);
    const children = this.getNonCxnOutputs(id);
    const opList = [];
    children.forEach(child => {
      const op = this.getOpNode(child);
      op.dirty = true;
      opList.push(op.id);
    })
    console.log("RECOMPUTE DRAFT CHILDREN CALLED ON ", id)
    return this.performAndUpdateDownstream(opList);
  }




  // /**
  //  * deteremines which ops are "top level" meaning there is no op above them 
  //  * @returns 
  //  */
  // async performTopLevelOps(): Promise<any> {

  //   console.log("[performTopLevelOps] Starting top level ops");





  //   //mark all ops as dirty to start
  //   this.nodes.forEach(el => {
  //     if (el.type === "op") el.dirty = true;
  //   })

  //   const top_level_nodes =
  //     this.nodes
  //       .filter(el => el.type === 'op')
  //       .filter(el => this.getUpstreamOperations(el.id).length === 0)
  //       .map(el => el.id);

  //   const startTime = performance.now();

  //   return await this.performGenerationOps(top_level_nodes).then(result => {
  //     const duration = performance.now() - startTime;
  //     return result;
  //   }).catch(err => {
  //     console.error("Error performing top level ops", err);
  //     return Promise.reject(err);
  //   });

  // }



  public getNextGeneration(parents: Array<{ op_id: number, start_time: number, generation: number }>, generation: number, lineage: Array<{ op_id: number, start_time: number, generation: number }>): { next_generation: Array<{ op_id: number, start_time: number, generation: number }>, lineage: Array<{ op_id: number, start_time: number, generation: number }> } {


    const next_generation = [];
    parents.forEach(parent => {
      const drafts = this.getNonCxnOutputs(parent.op_id);
      drafts.forEach(draft => {
        const children = this.getNonCxnOutputs(draft);
        children.forEach(child => {
          let already_in_lineage = lineage.find(el => el.op_id === child);
          if (already_in_lineage !== undefined) {
            already_in_lineage.generation = generation + 1;
          } else {
            next_generation.push({ op_id: child, start_time: performance.now(), generation: generation + 1 });
          }
        });
      });

    });
    return { next_generation: next_generation, lineage: lineage };


  }



  /**
   * creates an ordered list of operations to perform based on the dependencies of the operations
   * @param op_id 
   * @returns 
   */
  public createSchedule(op_ids?: Array<number> | null): Promise<Array<number>> {



    let lineage = [];

    if (op_ids !== undefined && op_ids !== null && op_ids.length > 0) {
      op_ids.forEach(op_id => {
        lineage.push({ op_id: op_id, start_time: performance.now(), generation: 0 });
      });

    } else {
      const toplevel_ops = this.getTopLevelOps().map(op_id => {
        console.log("TOP LEVEL OP IS", op_id);
        return { op_id: op_id, start_time: performance.now(), generation: 0 };
      });
      lineage.push(...toplevel_ops);
    }

    let res = this.getNextGeneration(lineage, 0, lineage);
    while (res.next_generation.length > 0) {
      const cur_generation = res.next_generation[0].generation;
      lineage = res.lineage;
      lineage.push(...res.next_generation);
      res = this.getNextGeneration(res.next_generation, cur_generation, lineage);
    }
    lineage = res.lineage;



    console.log("LINEAGE IS", lineage);

    //sort by generation. 
    lineage.sort((a, b) => a.generation - b.generation);
    return Promise.resolve(lineage.map(el => el.op_id));


  }



  // async performTopLevelOps() {

  //   console.log("[performTopLevelOps] Starting top level ops (CORRECTED)");
  //   const schedule = await this.createSchedule()

  //   schedule.forEach(async op_id => {
  //     await this.performOp(op_id);
  //   });



  // }


  /**
   * this calls a function for an operation to perform and then subsequently calls all children 
   * to recalculate. After each calculation, it redraws and or creates any new subdrafts
   * @param op_id 
   * @returns 
   */
  async performAndUpdateDownstream(op_ids: Array<number>): Promise<any> {
    const schedule = await this.createSchedule(op_ids);
    for (const op_id of schedule) {
      try {
        await this.performOp(op_id);
      } catch (err) {
        console.error("Error performing and updating downstream", err);
        return Promise.reject(err);
      }
    }

  }



  isValidIOTuple(io: IOTuple): boolean {
    if (io === null || io === undefined) return false;
    const draft_tn = io.tn.inputs[0].tn;
    const cxn_tn = io.tn;
    const type = draft_tn.node.type;
    const draft: Draft = (<DraftNode>draft_tn.node).draft;
    if (draft === null || draft === undefined) return false;
    if (wefts(draft.drawdown) == 0 || warps(draft.drawdown) == 0) return false;
    return true;
  }



  /**
   * performs the given operation
   * returns the list of draft ids affected by this calculation
   * @param op_id the operation triggering this series of update
   */
  async performOp(id: number): Promise<Array<number>> {
    console.log("PERFORMING OP", id);
    const opnode = <OpNode>this.getNode(id);


    const op = this.ops.getOp(opnode.name);
    const all_inputs = this.getInputsWithNdx(id);
    this.errorBroadcaster.clearError(id); //clear before we compute again.

    if (op === null || op === undefined) return Promise.reject("Operation is null")

    let inputs: Array<OpInput> = [];

    const param_vals = op.params.map((param, ndx) => {
      return {
        param: param,
        val: opnode.params[ndx]
      }
    })


    const draft_id_to_ndx = [];

    all_inputs.filter(el => this.isValidIOTuple(el))
      .forEach((el) => {

        const draft_tn = el.tn.inputs[0].tn;
        draft_id_to_ndx.push({ ndx: el.ndx, draft: (<DraftNode>draft_tn.node).draft })
      });


    const paraminputs = draft_id_to_ndx.map(el => {
      return { drafts: [el.draft], inlet_id: el.ndx, inlet_params: [opnode.inlets[el.ndx]] }
    })
    const cleaned_inputs: Array<OpInput> = paraminputs.filter(el => el !== undefined);

    let passes_size_check = op.sizeCheck(param_vals, cleaned_inputs);
    if (!passes_size_check) {
      const errorStatement = "The " + op.name + " operation is attempting to make a draft that is larger than the maximum allowable value"
      this.errorBroadcaster.postError(id, 'SIZE_ERROR', errorStatement, this.getDownstreamOperations(id))
      return Promise.reject({ node_id: id, error: "Operation " + op.name + " size check failed" });
    }



    try {
      console.log("PERFORMING OP", opnode.name, "WITH PARAM VALUES", param_vals, "AND CLEANED INPUTS", cleaned_inputs);

      const res = await op.perform(param_vals, cleaned_inputs);
      opnode.recomputing.next(false);
      let has_err = res.find(el => el.err !== undefined);
      if (has_err !== undefined) {
        this.errorBroadcaster.postError(id, 'OTHER', has_err.err, this.getDownstreamOperations(id));
        return Promise.reject(has_err.err);
      }
      opnode.dirty = false;
      // output_connections.forEach(el => {
      //   if (el !== null) {
      //     console.log("CALLING RECOMPUTING FALSE", el.id)
      //     el.recomputing.next(false);
      //   }
      // });
      return await this.updateDraftsFromResults(id, res, cleaned_inputs);
    } catch (err) {
      console.error("Error performing op", id, err);
      return Promise.reject(err);
    }

  }



  getConnectionNodes(): Array<ConnectionNode> {
    return this.nodes.filter(el => el.type === 'cxn').map(el => <ConnectionNode>el);
  }

  getDraftNodes(): Array<DraftNode> {
    return this.nodes.filter(el => el.type === 'draft').map(el => <DraftNode>el);
  }

  getDraftVisible(id: number) {
    const dn: DraftNode = <DraftNode>this.getNode(id);
    if (dn == null) return false;
    return dn.visible;
  }

  getDrafts(): Array<SubdraftComponent> {
    const draft_nodes: Array<Node> = this.nodes.filter(el => el.type == 'draft');
    const draft_comps: Array<SubdraftComponent> = draft_nodes.map(el => <SubdraftComponent>el.component);
    return draft_comps;
  }

  getLoom(id: number): Loom {
    if (id === -1) return null;
    const dn: DraftNode = <DraftNode>this.getNode(id);
    if (dn === null || dn === undefined) return null;
    return dn.loom;
  }

  setLoom(id: number, loom: Loom, broadcast: boolean = true) {
    console.log('[setLoom] Setting loom on draft node, id:', id, 'broadcast:', broadcast);
    console.log('[setLoom] Loom data:', loom ? {
      threading: loom.threading,
      treadling: loom.treadling,
      tieup: loom.tieup,
    } : null);
    const dn: DraftNode = <DraftNode>this.getNode(id);
    if (dn !== null && dn !== undefined) {
      dn.loom = (loom === null) ? null : copyLoom(loom);
      console.log('[setLoom] Loom set on draft node:', dn.id, 'loom is null:', dn.loom === null);
    } else {
      console.error('[setLoom] Draft node not found for id:', id);
    }
    const flags: DraftNodeBroadcastFlags = {
      meta: false,
      draft: false,
      loom: true,
      loom_settings: false,
      materials: false
    };
    if (broadcast) {
      console.log('[setLoom] Broadcasting loom change for node:', dn.id);
      this.broadcastDraftNodeValueChange(dn.id, flags);
    }
  }


  recomputeDrawdown(id: number, loom: Loom, loom_settings: LoomSettings, broadcast: boolean = true): Promise<Draft> {
    const dn: DraftNode = <DraftNode>this.getNode(id);
    if (dn !== null && dn !== undefined) {
      if (loom_settings.type == 'jacquard') {
        return Promise.resolve(dn.draft);
      } else {
        const utils = getLoomUtilByType(loom_settings.type);

        return utils.computeDrawdownFromLoom(loom)
          .then(drawdown => {
            dn.draft.drawdown = drawdown;
            const flags: DraftNodeBroadcastFlags = {
              meta: false,
              draft: true,
              loom: true,
              loom_settings: false,
              materials: false
            };
            this.setDraft(dn.id, dn.draft, flags, broadcast);
            return Promise.resolve(dn.draft);
          })


      }

    }
  }

  setLoomAndRecomputeDrawdown(id: number, loom: Loom, loom_settings: LoomSettings, broadcast: boolean = true): Promise<Draft> {

    const dn: DraftNode = <DraftNode>this.getNode(id);
    if (dn !== null && dn !== undefined) {
      this.setLoom(id, loom, false);

      if (loom_settings.type == 'jacquard') {
        const flags: DraftNodeBroadcastFlags = {
          meta: false,
          draft: false,
          loom: true,
          loom_settings: false,
          materials: false
        };
        if (broadcast) this.broadcastDraftNodeValueChange(dn.id, flags);
        return Promise.resolve(dn.draft);
      } {
        const utils = getLoomUtilByType(loom_settings.type);
        return utils.computeDrawdownFromLoom(loom)
          .then(drawdown => {
            dn.draft.drawdown = drawdown;
            const flags: DraftNodeBroadcastFlags = {
              meta: false,
              draft: true,
              loom: true,
              loom_settings: false,
              materials: false
            };
            this.setDraft(dn.id, dn.draft, flags, broadcast);
            return Promise.resolve(dn.draft);
          })


      }

    }
  }

  getLoomSettings(id: number): LoomSettings {
    if (id === -1) return null;
    const dn: DraftNode = <DraftNode>this.getNode(id);
    if (dn === null || dn === undefined) return null;
    return dn.loom_settings;
  }

  setLoomSettings(id: number, loom_settings: LoomSettings, broadcast: boolean = true) {
    const dn: DraftNode = <DraftNode>this.getNode(id);
    if (dn !== null && dn !== undefined) dn.loom_settings = loom_settings;
    const flags: DraftNodeBroadcastFlags = {
      meta: false,
      draft: false,
      loom: true,
      loom_settings: true,
      materials: false
    };
    if (broadcast) this.broadcastDraftNodeValueChange(dn.id, flags);
  }


  getLooms(): Array<Loom> {
    const dns = this.getDraftNodes();
    return dns.map(el => el.loom);
  }

  getDraft(id: number): Draft {
    const dn: DraftNode = <DraftNode>this.getNode(id);
    if (dn === null || dn === undefined) return null;
    return dn.draft;
  }

  getDraftName(id: number): string {
    const dn: DraftNode = <DraftNode>this.getNode(id);
    if (dn === null || dn === undefined || dn.draft === null) return "null draft";
    return (dn.draft.ud_name === "") ? dn.draft.gen_name : dn.draft.ud_name;
  }

  getDraftNotes(id: number): string {
    const dn: DraftNode = <DraftNode>this.getNode(id);
    if (dn === null || dn === undefined || dn.draft === null) return "null draft";
    return dn.draft.notes || "";
  }

  getDraftScale(id: number): number {
    if (id === -1) return 1;
    const dn: DraftNode = <DraftNode>this.getNode(id);
    if (dn === null || dn === undefined || dn.draft === null || dn.scale === undefined) return 1;
    return dn.scale;
  }

  getConnectionNode(id: number): ConnectionNode {
    const cn: ConnectionNode = <ConnectionNode>this.getNode(id);
    if (cn === null || cn === undefined) return null;
    return cn;
  }

  getConnections(): Array<ConnectionComponent> {
    const draft_nodes: Array<Node> = this.nodes.filter(el => el.type === 'cxn');
    const draft_comps: Array<ConnectionComponent> = draft_nodes.map(el => <ConnectionComponent>el.component);
    return draft_comps;
  }

  getOperations(): Array<OperationComponent> {
    const draft_nodes: Array<Node> = this.nodes.filter(el => el.type === 'op');
    const draft_comps: Array<OperationComponent> = draft_nodes.map(el => <OperationComponent>el.component);
    return draft_comps;
  }

  getOpNodes(): Array<OpNode> {
    return this.nodes.filter(el => el.type === 'op').map(el => (<OpNode>el));
  }

  /**
   * @todo update this to handle clear nodes whole input indexes no longer exist
   * scans the connections and checks that the to and from nodes AND INDEXES still exist
   * @returns an array of connections to delete
   */

  getUnusuedConnections(): Array<number> {
    const comps: Array<Node> = this.nodes.filter(el => el.type === 'cxn');
    const nodes: Array<TreeNode> = comps.map(el => this.getTreeNode(el.id));
    const to_delete: Array<TreeNode> = [];


    nodes.forEach(el => {
      if (el.inputs.length === 0 || el.outputs.length === 0) {
        to_delete.push(el);
        return;
      }

      const null_inputs = el.inputs.filter(el => el.tn.node === null || el.tn.node === undefined);
      null_inputs.forEach(el => {
        to_delete.push(el.tn);
      })

      const null_outputs = el.outputs.filter(el => el.tn.node === null || el.tn.node === undefined);
      null_outputs.forEach(el => {
        to_delete.push(el.tn);
      })
    });

    return to_delete.map(el => el.node.id);
  }


  /**
   * gets the tree node associated with a given Node 
   * @param id the idea of the node (not the tree node id) 
   * @returns 
   */
  getTreeNode(id: number): TreeNode {
    const found = this.tree.find(el => el.node.id === id);
    if (found === undefined) {
      console.error("Tree node for ", id, "not found");
      return undefined;
    }
    return found;
  }

  /**
   * adds a connection from subddraft to operation. connections can be of the type 
   * subdraft -> op (input to op)
   * op -> subdraft (output generatedd by op)
   * @returns an array of the ids of the elements connected to this op
  
   */
  addConnection(from: number, from_ndx: number, to: number, to_ndx: number, cxn: number): Array<number> {

    let from_tn: TreeNode = this.getTreeNode(from);
    let to_tn: TreeNode = this.getTreeNode(to);
    const cxn_tn: TreeNode = this.getTreeNode(cxn);

    from_tn.outputs.push({ tn: cxn_tn, ndx: from_ndx });

    cxn_tn.inputs = [{ tn: from_tn, ndx: 0 }];
    cxn_tn.outputs = [{ tn: to_tn, ndx: 0 }];

    to_tn.inputs.push({ tn: cxn_tn, ndx: to_ndx });

    if (from_tn.node.type === 'op') to_tn.parent = from_tn;
    return this.getNonCxnInputs(to);

  }

  /**
   * this sets the parent of a subdraft to the operation that created iit
   * @returns an array of the subdraft ids connected to this operation
   */
  setSubdraftParent(sd: number, op: number) {
    const sd_tn: TreeNode = this.getTreeNode(sd);
    if (op == -1) {
      sd_tn.parent = null;

    } else {
      const op_tn: TreeNode = this.getTreeNode(op);
      sd_tn.parent = op_tn;

    }



  }



  /**
   * this removes the given id from the tree
   * given the structure of the code, this will never be called on a connection node, as only ops and subdrafts can be 
   * explicitly deleted.
   * @param id the id to delete 
   */
  private removeNodeTreeAssociations(id: number) {
    const tn: TreeNode = this.getTreeNode(id);
    if (tn === undefined) return;

    //travel to all the trreenode's inputs, and erase this from their output
    tn.inputs.forEach(el => {
      const cxn_ndx_output: number = el.tn.outputs.findIndex(out => (out.tn.node.id == id));
      el.tn.outputs.splice(cxn_ndx_output, 1);
    });

    tn.outputs.forEach(el => {
      const cxn_ndx_input: number = el.tn.inputs.findIndex(i => (i.tn.node.id == id));
      el.tn.inputs.splice(cxn_ndx_input, 1);
    });

    tn.outputs = [];
    tn.inputs = [];
  }

  //finds the connection compoment associated with the subdraft sd
  getConnectionComponentFromSubdraft(sd_id: number): ConnectionComponent {

    const sd_node: TreeNode = this.getTreeNode(sd_id);
    if (sd_node.outputs.length == 0) {
      return null;
    } else if (sd_node.outputs.length > 1) {
      return null;
    }

    const cxn_node = sd_node.outputs[0].tn.node;
    return <ConnectionComponent>cxn_node.component;

  }

  /**
  * given a from, to, and inlet index, return the connection id 
  * @param from
  * @returns the node id of the connection, or -1 if that connection is not found
  */
  getConnectionAtInlet(from: number, to: number, ndx: number): number {
    let found = -1;

    const inputs: Array<IOTuple> = this.getInputsWithNdx(to);
    const connection: Array<IOTuple> = inputs.filter(el => el.ndx == ndx);
    if (connection === undefined) return -1;

    if (connection.length == 1) return connection[0].tn.node.id;
    else {
      connection.forEach(connectionAtInlet => {
        const non_cnx_inputs = this.getInputs(connectionAtInlet.tn.node.id);
        const match_from = non_cnx_inputs.find(el => el === from);
        if (match_from !== undefined) found = connectionAtInlet.tn.node.id;
      });
    }

    return found;

  }


  /**
   * if you know two nodes are connected, and which one is the parent of the other, this walks from the parent to the child node and returns everything in between 
   * @param from
   * @param to
   */
  makeTraceBetween(from: number, to: number): Array<number> {

    if (from === to) return [];

    let trace = [];
    let from_children = this.getAllDownstreamNodes(from);
    from_children.forEach(child => {
      let child_children = this.getAllDownstreamNodes(child);
      let in_branch = child_children.find(el => el == to);
      if (in_branch !== undefined) {
        trace.push(child);
        return trace.concat(this.makeTraceBetween(child, to));
      }
    });

    return trace;

  }


  /**
   * given two nodes returns all the connection ids between these two nodes. 
   * @param a 
   * @param b 
   */
  getConnectionsBetween(a: number, b: number): Array<number> {

    let path = [];
    //get all connections that branch from a. 
    //get all connections that branch from b.
    let a_children = this.getAllDownstreamNodes(a);
    let b_children = this.getAllDownstreamNodes(b);

    let a_is_parent = a_children.find(el => el === b);
    let b_is_parent = b_children.find(el => el === a);

    if (a_is_parent !== undefined) {
      return this.makeTraceBetween(a, b);
    }

    if (b_is_parent !== undefined) {
      return this.makeTraceBetween(b, a);

    }

    return [];
  }

  /**
   * given two nodes, returns the id of the connection node connecting them
   * @param a one node
   * @param b the other node
   * @returns the node id of the connection, or -1 if that connection is not found
   */
  getConnection(a: number, b: number): number {


    const set_a = this.nodes
      .filter(el => el.type === 'cxn')
      .filter(el => (this.getOutputs(el.id).find(treenode_id => this.getTreeNode(treenode_id).node.id === a)))
      .filter(el => (this.getInputsWithNdx(el.id).find(ip => ip.tn.node.id === b)));

    const set_b = this.nodes
      .filter(el => el.type === 'cxn')
      .filter(el => (this.getOutputs(el.id).find(treenode_id => this.getTreeNode(treenode_id).node.id === b)))
      .filter(el => (this.getInputsWithNdx(el.id).find(ip => ip.tn.node.id === a)));

    const combined = set_a.concat(set_b);

    if (combined.length === 0) {
      //console.error("No connection found between", a, b);
      return -1;
    }

    if (combined.length > 1) {
      console.error("more than one connection found");
    }

    return combined[0].id;

  }

  /**
   * checks if this node receives any input values
   * @param id the node id
   * @returns a boolean describing if an input exists
   */
  hasInput(id: number): boolean {
    const tn: TreeNode = this.getTreeNode(id);
    return (tn.inputs.length > 0)
  }

  /**
   * returns the ids of all nodes connected to the input node that are not connection nodes
   * @param op_id 
   */
  getNonCxnInputs(id: number): Array<number> {
    const inputs: Array<number> = this.getInputs(id);
    const id_list: Array<number> = inputs
      .map(id => (this.getNode(id)))
      .filter(node => node.type === 'cxn')
      .map(node => this.getConnectionInput(node.id))
    // const id_list:Array<number> = node_list.map(node => (node.type === 'cxn') ? this.getConnectionInput(node.id): -1);
    return id_list;
  }


  hasNdx(stored_input: number, input_to_function: number) {
    if (input_to_function === -1) return false;
    if (stored_input === -1) return false;
    else return true;
  }

  /**
  * returns the ids of all nodes connected to the input node that are not connection nodes
  * in the case of dynamic ops, also provide the input index
  * @param op_id 
  */
  getOpComponentInputs(op_id: number, ndx: number): Array<number> {
    const inputs: Array<IOTuple> = this.getInputsWithNdx(op_id);
    const id_list: Array<number> = inputs
      .filter(param => param.ndx === ndx)
      .map(param => (param.tn.node))
      .filter(node => node.type === 'cxn')
      .map(node => this.getConnectionInput(node.id));
    // const id_list:Array<number> = node_list.map(node => (node.type === 'cxn') ? this.getConnectionInput(node.id): -1);
    return id_list;
  }

  /**
   * returns the ids of all nodes connected to the input node that are op nodes
   * @param op_id 
   */
  getOpInputs(id: number): Array<number> {
    const inputs: Array<number> = this.getInputs(id);
    const node_list: Array<Node> = inputs.map(id => (this.getNode(id)));
    //const id_list:Array<number> = node_list.map(node => (node.type === 'cxn') ? this.getConnectionInput(node.id): node.id);
    const id_list: Array<number> = node_list
      .filter(node => node.type === 'cxn')
      .map(node => this.getNode(this.getConnectionInput(node.id)))
      .filter(node => node.type === 'op')
      .map(node => node.id)
    return id_list;
  }

  /**
   * returns the ids of all nodes connected to the input node that are draft nodes
   * @param op_id 
   */
  getDraftInputs(id: number): Array<number> {
    const inputs: Array<number> = this.getInputs(id);
    const node_list: Array<Node> = inputs.map(id => (this.getNode(id)));
    //const id_list:Array<number> = node_list.map(node => (node.type === 'cxn') ? this.getConnectionInput(node.id): node.id);
    const id_list: Array<number> = node_list
      .filter(node => node.type === 'cxn')
      .map(node => this.getNode(this.getConnectionInput(node.id)))
      .filter(node => node.type === 'draft')
      .map(node => node.id)
    return id_list;
  }

  /**
  * returns the ids of all nodes connected to the output node that are not connection nodes
  * @param op_id 
  */
  getNonCxnOutputs(id: number): Array<number> {
    const outputs: Array<number> = this.getOutputs(id);
    const node_list: Array<Node> = outputs.map(id => (this.getNode(id)));
    const id_list: Array<number> = node_list
      .map(node => (this.getNode(node.id)))
      .filter(node => node.type === 'cxn')
      .map(node => this.getConnectionOutput(node.id))
    return id_list;
  }


  /**
   * if we are at an operaiton node and we want to get all of the subsequent connections from this operation node to another 
   * we need to first traverse this operations sudrafts, and then see where those subdrafts go. 
   * @param op_id 
   * @returns 
   */
  getOperationToOperationConnections(op_id: number): Array<number> {
    const subdrafts: Array<number> = this.getNonCxnOutputs(op_id);
    const ops = subdrafts.reduce((acc, el) => {
      return acc.concat(this.getOutputs(el));
    }, []);
    return ops;

  }

  /**
   * if we are at a draft, it either has no inputs  (e.g. it's a seed draft) or it has a connection between iself and it's parent
   * operation. 
   * @param draft_id 
   * @returns 
   */
  getOperationInputConnectionsFromDraft(draft_id: number): Array<number> {
    const operation: number = this.getSubdraftParent(draft_id);
    if (operation === -1) return [];

    return this.getInputs(operation);
  }



  /**
  * returns the ids of all nodes connected to the output node that are not connection nodes
  * @param op_id 
  */
  getDraftOutputs(id: number): Array<number> {
    const outputs: Array<number> = this.getOutputs(id);
    const node_list: Array<Node> = outputs.map(id => (this.getNode(id)));
    const id_list: Array<number> = node_list
      .map(node => (this.getNode(node.id)))
      .filter(node => node.type === 'cxn')
      .map(node => this.getConnectionOutput(node.id))
      .filter(node => this.getType(node) === 'draft');
    return id_list;
  }


  getInputs(node_id: number): Array<number> {
    const tn = this.getTreeNode(node_id);
    if (tn === undefined) return [];
    const input_ids: Array<number> = tn.inputs.map(child => child.tn.node.id);
    return input_ids;
  }

  getInputsWithNdx(node_id: number): Array<IOTuple> {
    const tn = this.getTreeNode(node_id);
    if (tn === undefined) return [];
    return tn.inputs;
  }

  /**
   * returns the IO Tuples associated with this nodes output
   * @param node_id the node id (not tree id)
   * @returns an Array of IO Tuples
   */
  getOutputsWithNdx(node_id: number): Array<IOTuple> {
    const tn = this.getTreeNode(node_id);
    if (tn === undefined) return [];
    return tn.outputs;
  }


  /**
   * gets the ids of all the drafts that this node receives. 
   * since only op nodes can recieve input, we assume all node_ids correspond to operations
   * 
   * @param node_id 
   */
  getInwardConnectionProxies(node_id: number): Array<InwardConnectionProxy> {
    const node = <OpNode>this.getNode(node_id);
    if (node.type !== 'op') console.error("Get Inward Connections Called on Non-Op");
    else return [];
    const proxies: Array<InwardConnectionProxy> = [];
    node.inlets.forEach((inlet, ndx) => {
      const inputs = this.getOpComponentInputs(node_id, ndx);
      inputs.forEach(input => {
        proxies.push({
          from_id: input,
          inlet_id: ndx
        });
      })

    })

    return proxies;
  }

  /**
   * outward connectinos can exist on drafts and operations. If this is an operation, it references the other operations that it will go into
   * if it is a draft, it will also reference the operations. 
   * @param node_id 
   * @returns 
   */
  getOutwardConnectionProxies(node_id: number): Array<OutwardConnectionProxy> {
    const node = <OpNode>this.getNode(node_id);
    if (node.type !== 'op' && node.type !== 'draft') console.error("Get Inward Connections Called on Non-Op");
    const proxies: Array<OutwardConnectionProxy> = [];


    const immediate_outlets = this.getOutputs(node_id);
    immediate_outlets.forEach(outlet_cxn => {

      const cxn_out = this.getOutputsWithNdx(outlet_cxn);
      cxn_out.forEach(outlet_node => {
        if (outlet_node.tn.node.type == 'draft') {

          const draft_cxn_out = this.getOutputs(outlet_node.tn.node.id);
          draft_cxn_out.forEach((draft_cxn, outlet_id) => {
            const ops_connected = this.getOutputsWithNdx(draft_cxn);
            ops_connected.forEach(op => {
              proxies.push({
                identity: 'OP',
                outlet_id: outlet_id,
                to_id: op.tn.node.id,
                inlet_id: op.ndx //need to figure out which inlet this goes into
              });
            })
          })




        } else {
          //if the connections go directly to an operation, this is a draft

          proxies.push({
            identity: 'DRAFT',
            outlet_id: 0,
            to_id: outlet_node.tn.node.id,
            inlet_id: outlet_node.ndx //need to figure out which inlet this goes into
          });
        }
      })


    })

    return proxies;
  }


  getInputsAtNdx(node_id: number, inlet_ndx: number): Array<IOTuple> {
    const tn = this.getTreeNode(node_id);
    if (tn === undefined) return [];
    return tn.inputs.filter(el => el.ndx == inlet_ndx);
  }

  getConnectionInput(node_id: number): number {
    const tn = this.getTreeNode(node_id);
    const input_ids: Array<number> = tn.inputs.map(child => child.tn.node.id);
    return input_ids[0];
  }

  getOutputs(node_id: number): Array<number> {
    const tn = this.getTreeNode(node_id);
    if (tn === undefined) return [];
    const ids: Array<number> = tn.outputs.map(child => child.tn.node.id);
    return ids;
  }


  getConnectionOutput(node_id: number): number {
    const tn = this.getTreeNode(node_id);
    const output_ids: Array<number> = tn.outputs.map(child => child.tn.node.id);
    return output_ids.pop();
  }



  /**
   * mostly used to identify which of an operation's inlet's this connection should connected to. 
   * Because inlet information is stored on the operation, it looks at the operation to identify which inlet this connection enters into, and when approriate, which number in the array of inlets this belongs to
   * @param cxn_id 
   * @returns an object storing the id, the inlet_ndx, and the array_ndx (where there is multiple values in one inlet)
   */
  getConnectionOutputWithIndex(cxn_id: number): { id: number, inlet: number, arr: number } {
    const tn = this.getTreeNode(cxn_id);
    let found = null;

    //a connectino only have one output, so this in 
    const output_tns: Array<TreeNode> = tn.outputs.map(child => child.tn);

    //how many inputs are connected to this operation 
    output_tns.forEach(output_tn => {


      let has_connection: IOTuple = output_tn.inputs.find(input => input.tn.node.id === cxn_id);

      if (has_connection !== undefined) {

        let inlet_with_connection = output_tn.inputs.filter(el => el.ndx == has_connection.ndx);
        let arr_ndx = inlet_with_connection.findIndex(inlet => inlet.tn.node.id === cxn_id);
        // console.log("inlet with connection length ", inlet_with_connection, arr_ndx)

        found = { id: output_tn.node.id, inlet: has_connection.ndx, arr: arr_ndx };
      }
    })
    if (found === null) console.error("ERROR Connection output's input does not contain this connection id ")
    return found;
  }







  /**
   * returns the ids of the total set of operations that, when performed, will chain down to the other operations
   */
  getTopLevelOps(): Array<number> {

    return this.nodes
      .filter(el => el.type === "op")
      .filter(el => this.getUpstreamOperations(el.id).length === 0)
      .map(el => el.id);
  }

  /**
   * returns a list of any drafts that have no parents
   */
  getTopLevelDrafts(): Array<number> {

    return this.nodes
      .filter(el => el.type === "draft")
      .map(el => this.getTreeNode(el.id))
      .filter(el => el.parent === null)
      .map(el => el.node.id);



  }




  getGenerationChildren(parents: Array<number>): Array<number> {

    let children: Array<number> = [];
    parents.forEach(parent => {
      const tn: TreeNode = this.getTreeNode(parent);
      children = children.concat(tn.outputs.map(io => io.tn.node.id));
    });

    return children;
  }

  /**
   * for degugging, this "prints" a list of the tree by generations
   */
  print() {
    const gens: Array<Array<number>> = this.convertTreeToGenerations();
    gens.forEach((el, ndx) => {
      el.forEach(subel => {
        const type = this.getType(subel);
      });
    });



  }

  /**
   * converts the tree into an array where each element belongs to a similar "generation" meaning the first generation had no parents/inputs, and the subsequent generations are descending from that. 
   * returns a list of ids referencing the element ids belonging to each generation
   * should return an array that has the same number of elements as the tree overall
   */
  convertTreeToGenerations(): Array<Array<number>> {

    const gens: Array<Array<number>> = [];
    let parents: Array<number> = this.tree.filter(tn => tn.inputs.length == 0).map(tn => tn.node.id);


    while (parents.length > 0) {
      gens.push(parents);
      parents = this.getGenerationChildren(parents);
    }

    return gens;
  }

  /**
   * converts all of the nodes in this tree for saving. 
   * @returns an array of objects that describe nodes
   */
  exportNodesForSaving(): Array<NodeComponentProxy> {

    const objs: Array<any> = [];

    this.nodes.forEach(node => {

      let tl: Point = { x: 0, y: 0 };
      switch (node.type) {
        case 'op':
          if ((<OperationComponent>node.component) !== null) tl = (<OperationComponent>node.component).getPosition();
          break;
        case 'draft':
          if ((<SubdraftComponent>node.component) !== null) tl = (<SubdraftComponent>node.component).getPosition();
          break;
      }


      const savable: NodeComponentProxy = {
        node_id: node.id,
        type: node.type,
        topleft: tl
      }
      objs.push(savable);

    })

    return objs;

  }

  adjustTreadlingForSaving(tread: Array<Array<number>>): Array<Array<number>> {

    if (tread == null || tread == undefined) return [];

    const adjusted: Array<Array<number>> = [];
    tread.forEach((row, i) => {
      if (row.length === 0) {
        adjusted.push([-1])
      } else {
        adjusted.push(row.slice())
      }

    })

    return adjusted;
  }

  restoreDraftNodeState(id: number, state: DraftNodeState) {
    const node: DraftNode = <DraftNode>this.getNode(id);
    node.draft = copyDraft(state.draft);
    node.visible = state.draft_visible;
    node.loom = copyLoom(state.loom);
    node.loom_settings = copyLoomSettings(state.loom_settings);
    node.scale = state.scale;

    const flags: DraftNodeBroadcastFlags = {
      meta: true,
      draft: true,
      loom: true,
      loom_settings: false,
      materials: true
    };
    this.broadcastDraftNodeValueChange(id, flags);
  }

  /**
   * creates a deep copy of the state of a draft node in case it needs to be restored thruogh an undo event
   * @param id the id of the draft node to get the state of
   * @returns 
   */
  getDraftNodeState(id: number): DraftNodeState {
    const node: DraftNode = <DraftNode>this.getNode(id);
    return {
      draft: copyDraft(node.draft),
      draft_visible: node.visible,
      loom: copyLoom(node.loom),
      loom_settings: copyLoomSettings(node.loom_settings),
      scale: node.scale
    }
  }

  /**
  * converts draft nodes into a form suited for export. 
  * drafts with parents are not saved, as their data is generated from operations on load. 
  * @returns an array of objects that describe nodes
  */
  exportDraftNodeProxiesForSaving(): Promise<Array<DraftNodeProxy>> {




    const objs: Array<any> = [];

    this.getDraftNodes().forEach(node => {


      let loom_export: Loom = null;

      if ((<DraftNode>node).loom !== null && (<DraftNode>node).loom !== undefined) {
        loom_export = {
          threading: (<DraftNode>node).loom.threading.slice(),
          tieup: (<DraftNode>node).loom.tieup.slice(),
          treadling: this.adjustTreadlingForSaving((<DraftNode>node).loom.treadling)
        }
      }
      if ((<DraftNode>node).draft !== null && (<DraftNode>node).draft !== undefined) {


        const savable: DraftNodeProxy = {
          node_id: node.id,
          draft_id: (<DraftNode>node).draft.id,
          ud_name: (<DraftNode>node).draft.ud_name,
          gen_name: (<DraftNode>node).draft.gen_name,
          notes: (<DraftNode>node).draft.notes || '',
          draft: null,
          compressed_draft: (this.hasParent(node.id)) ? null : compressDraft((<DraftNode>node).draft),
          draft_visible: ((<DraftNode>node).visible == undefined) ? !this.ws.hide_mixer_drafts : (<DraftNode>node).visible,
          loom: (loom_export === null || this.hasParent(node.id)) ? null : loom_export,
          loom_settings: node.loom_settings,
          render_colors: ((<DraftNode>node).render_colors == undefined) ? true : (<DraftNode>node).render_colors,
          scale: ((<DraftNode>node).scale == undefined) ? 1 : (<DraftNode>node).scale
        }
        objs.push(savable);
      }

    })

    return Promise.resolve(objs);



    //   //MAKE SURE ALL DRAFTS ARE ORIENTED TO TOP LEFT ON SAVE
    //   let drafts_to_flip = [];
    //   let looms_to_flip = [];
    //   const flips = utilInstance.getFlips(this.ws.selected_origin_option, 3);

    //   objs.forEach((obj) => {
    //     if(obj.draft !== null){
    //       drafts_to_flip.push(flipDraft(obj.draft, flips.horiz, flips.vert));
    //     }
    //   });

    //  return  Promise.all(drafts_to_flip)
    //   .then(drafts => {

    //     //reassign the output draft to the correct spot in the obj array
    //     drafts.forEach((draft) => {

    //       let ndx = objs.findIndex(el => el.draft_id == draft.id);
    //       if(ndx == -1 ) console.error("Couldn't find draft after flip");
    //       else objs[ndx].draft = draft;        

    //     })

    //     objs.forEach((obj) => {
    //       if(obj.loom !== null){
    //         looms_to_flip.push({id: obj.draft_id, fn: flipLoom(obj.loom, flips.horiz, flips.vert)});
    //       }
    //     });


    //     return Promise.all(looms_to_flip.map(el => el.fn));

    //   })
    //   .then(looms => {
    //     looms.forEach((loom, ndx) => {
    //       let index = objs.filter(el => el.loom !== null).findIndex(el => el.draft_id == looms_to_flip[ndx].id);
    //       if(index == -1 ) console.error("Couldn't find draft after flip");
    //       else objs[index].loom = loom;
    //     })


    //     return objs;

    //   })



  }


  /**
   * this function is used when the file loader needs to create a template for an object that doesn't yet exist in the tree
   * but will be loaded into the tree.
   * @param draft : the draft that will be loaded into this node
   * @param preloaded : a list of preloaded node ids to factor in when creating this new id.  
   */
  getNewDraftProxies(draft: Draft, preloaded: Array<number>) {

    const id = generateId(8);
    const node: NodeComponentProxy = {
      node_id: id,
      type: 'draft',
      topleft: null
    }

    const draft_node: DraftNodeProxy = {
      node_id: id,
      draft_id: draft.id,
      ud_name: '',
      gen_name: '',
      notes: '',
      draft: null,
      compressed_draft: null,
      draft_visible: true,
      loom: null,
      loom_settings: null,
      render_colors: true,
      scale: 1
    };

    const treenode: TreeNodeProxy = {
      node: node.node_id,
      parent: -1,
      inputs: [],
      outputs: []
    };

    return { node, treenode, draft_node }
  }

  setNodesClear() {
    this.nodes.forEach(node => node.dirty = false);
  }

  setDirty(id: number) {
    this.getNode(id).dirty = true;

  }

  setDraftClean(id: number) {
    if (id === -1) {
      return;
    }

    const node = this.getNode(id);
    if (node === undefined) {
      console.error("no node found at ", id);
      return;
    }
    node.dirty = false;
  }


  /**
   * udpates the draft on the draft node. Broadcasts that a change has been made( which triggers a redraw)
   * and then checks to see if the children of this draft need to be reperformed. 
   * there is a possible performance issue here in that recomputation might happen at the speed of mouse interaction
   * (e.g. if someone is drawing on a drawdown that is connected to lots of operations, it will keep recomputing/redrawing)
   * @param id 
   * @param draft 
   * @param flags 
   * @param broadcast 
   */
  setDraft(id: number, draft: Draft, flags: DraftNodeBroadcastFlags, broadcast: boolean = true, checkRecompute: boolean = true) {
    const dn = <DraftNode>this.getNode(id);
    draft.id = id;
    dn.draft = draft;
    dn.render_colors = (dn.render_colors === undefined) ? true : dn.render_colors;
    // if (dn.component !== null) (<SubdraftComponent>dn.component).draft = draft;
    if (broadcast) this.broadcastDraftNodeValueChange(dn.id, flags);

    if (checkRecompute) {
      const outlets = this.getNonCxnOutputs(id);
      const performOps = [];
      outlets.forEach(outlet => {
        performOps.push(this.performAndUpdateDownstream([outlet]));
      });

      Promise.all(performOps).catch(err => {
        console.error("Error performing and updating downstream", err);
        return Promise.reject(err);
      });
    }
  }



  setDraftVisiblity(id: number, visibile: boolean) {
    const dn = <DraftNode>this.getNode(id);
    dn.visible = visibile;
  }

  /**
   * sets a new draft and loom at node specified by id. This occures when an operation that generated a draft has been recomputed
   * @param id the node to update
   * @param temp the draft to add
   * @param loom_settings  the settings that should govern the loom generated
   */
  setDraftAndRecomputeLoom(id: number, temp: Draft, loom_settings: LoomSettings, broadcast: boolean = true, recompute: boolean = true): Promise<Loom> {

    const dn = <DraftNode>this.getNode(id);
    let ud_name = getDraftName(temp);

    if (dn.draft === null) {
      dn.draft = temp;
    }
    else {
      ud_name = dn.draft.ud_name;
      dn.draft = createDraft(temp.drawdown, temp.gen_name, ud_name, temp.rowShuttleMapping, temp.rowSystemMapping, temp.colShuttleMapping, temp.colSystemMapping);
    }

    const flags: DraftNodeBroadcastFlags = {
      meta: false,
      draft: true,
      loom: false,
      loom_settings: false,
      materials: false
    };
    this.setDraft(id, temp, flags, broadcast, recompute);

    if (loom_settings === null || loom_settings === undefined) {
      dn.loom_settings = this.ws.getWorkspaceLoomSettings();
    }
    else dn.loom_settings = loom_settings;

    dn.dirty = true;
    if (dn.component !== null) (<SubdraftComponent>dn.component).draft = temp;


    return this.recomputeLoom(id, temp, loom_settings, broadcast);

  }



  /**
   * recomputes the loom as per a draft and broadcasts changes to teh loom if neccessary
   * @param id the node to update
   * @param temp the draft to add
   * @param loom_settings  the settings that should govern the loom generated
   */
  recomputeLoom(id: number, draft: Draft, loom_settings: LoomSettings, broadcast: boolean = true): Promise<Loom> {

    const dn = <DraftNode>this.getNode(id);

    if (loom_settings === null || loom_settings === undefined) {
      dn.loom_settings = this.ws.getWorkspaceLoomSettings();
    }
    else dn.loom_settings = loom_settings;
    dn.dirty = true;


    if (dn.loom_settings.type == 'jacquard') {
      return Promise.resolve(null)
    }

    const loom_utils = getLoomUtilByType(dn.loom_settings.type);
    return loom_utils.computeLoomFromDrawdown(draft.drawdown, loom_settings)
      .then(loom => {
        dn.loom = loom;
        const flags: DraftNodeBroadcastFlags = {
          meta: false,
          draft: false,
          loom: true,
          loom_settings: false,
          materials: false
        };
        if (broadcast) this.broadcastDraftNodeValueChange(dn.id, flags);
        return Promise.resolve(loom);
      });

  }


  /**
   * sets a new draft
   * @param temp the draft to set this component to
   */
  setDraftPattern(id: number, pattern: Drawdown, broadcast: boolean = true) {
    const dn = <DraftNode>this.getNode(id);
    dn.draft.drawdown = pattern.slice();
    //  (<SubdraftComponent>dn.component).draft = dn.draft;
    //   dn.dirty = true;
    const flags: DraftNodeBroadcastFlags = {
      meta: false,
      draft: true,
      loom: false,
      loom_settings: false,
      materials: false
    };
    this.setDraft(id, dn.draft, flags, broadcast);
  }



  getOpNode(id: number): OpNode {
    return <OpNode>this.getNode(id);
  }

  /**
   * exports all operation nodes with information that can be reloaded
   * @returns 
   */
  exportOpMetaForSaving(): Array<OpComponentProxy> {
    const objs: Array<any> = [];

    this.getOpNodes().forEach(op_node => {
      if (op_node.name !== "") {
        const op = this.ops.getOp(op_node.name);
        let cleaned_params = op.params.map((param_template, ndx) => {
          if (param_template.type == 'file') {
            return +(<Img>op_node.params[ndx]).id;
          } else {
            return op_node.params[ndx];
          }
        })




        const savable: OpComponentProxy = {
          node_id: op_node.id,
          name: op_node.name,
          params: cleaned_params,
          inlets: op_node.inlets
        }


        objs.push(savable);
      }
    })

    return objs;

  }


  exportTreeForSaving(): Array<TreeNodeProxy> {

    const objs: Array<any> = [];


    this.tree.forEach(treenode => {

      const savable: TreeNodeProxy = {
        node: treenode.node.id,
        parent: (treenode.parent !== null && treenode.parent !== undefined) ? treenode.parent.node.id : -1,
        inputs: treenode.inputs.map(el => {
          return {
            tn: el.tn.node.id,
            ndx: el.ndx
          }
        }
        ),
        outputs: treenode.outputs.map(el => {
          return {
            tn: el.tn.node.id,
            ndx: el.ndx
          }
        })
      }
      objs.push(savable);
    })

    return objs;

  }

  /**
* exports only the drafts that have not been generated by other values
* @returns an array of objects that describe nodes
*/
  // exportSeedDraftsForSaving() : Array<DraftNode> {

  //     const objs: Array<any> = []; 
  //     const gens: Array<Array<number>> = this.convertTreeToGenerations(); 

  //     if(gens.length == 0) return objs;

  //     const seeds: Array<number> = gens.shift();

  //     return seeds.map(seed => this.getDraftNode(seed));


  //   }

  /**
* exports TopLevel drafts associated with this tree
* @returns an array of Drafts
*/
  // exportDraftNodesForSaving() : Array<DraftNode> {

  //   //make sure the name values are not undefined
  //   this.getDraftNodes().forEach(node => {
  //     if(node.draft.ud_name === undefined) node.draft.ud_name = '';
  //     if(node.loom === undefined) node.loom = null;

  //   });

  //   const all_nodes = this.getDraftNodes()
  //   .filter(el => this.getSubdraftParent(el.id) === -1);

  //   return all_nodes;


  // }




}
