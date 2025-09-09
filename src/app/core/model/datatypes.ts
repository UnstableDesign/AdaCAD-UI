

import { ViewRef } from "@angular/core";
import { AnalyzedImage, Color, CompressedDraft, Draft, Loom, LoomSettings, Material, SingleImage } from "adacad-drafting-lib";
import { SubdraftComponent } from "../..//mixer/palette/subdraft/subdraft.component";
import { ConnectionComponent } from "../../mixer/palette/connection/connection.component";
import { NoteComponent } from "../../mixer/palette/note/note.component";
import { OperationComponent } from "../../mixer/palette/operation/operation.component";
import { MaterialsService } from "../provider/materials.service";

/**
 * this stores a list of drafts created with associated component ids for those drafts, 
 * or -1 if the component for this draft has not been generated yet. 
 */
export interface DraftMap {
  component_id: number;
  draft: any;
}


/***** OBJECTS/TYPES RELATED TO SCREEN LAYOUT ****/


/**
 * describes a point using x,y coordinates
 * often used for referencing mouse and/or screen drawing positions
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Describes a rectangle on the screen.
 * @param topleft - position of this rectanble
 * @param width - the width of the rectangle
 * @param height - the height of this rectanble.
 */
export interface Bounds {
  topleft: Point;  //row on draft
  width: number;  //column on draft 
  height: number; //corresponding screen row
}

// /**
//  * A type to communicate locations on the loom that have been updated in response to a given action
//  */
// interface LoomUpdate {
//   threading: Array<InterlacementVal>,
//   treadling: Array<InterlacementVal>,
//   tieup: Array<Array<InterlacementVal>>
// }


/****** OBJECTS/TYPES to CONTROL SELECT LISTS******/

export interface LoomTypes {
  value: string;
  viewValue: string;
}

export interface MaterialTypes {
  value: number;
  viewValue: string;
}

export interface DensityUnits {
  value: string;
  viewValue: string;
}

export interface ViewModes {
  value: string;
  viewValue: string;
}


/**
 * Stores the icons and language for determining different 
 * modes within which the mouse points are handled
 * @param value - reference 
 * @param viewValue - text shown to users
 * @param icon
 * @param children, menu to nest within this
 * @param selected boolean to show if it is selected
 */
export interface DesignMode {
  value: string;
  viewValue: string;
  icon?: string;
}

export interface Note {
  id: number,
  topleft: Point,
  title: string;
  text: string;
  ref: ViewRef;
  color: string;
  component: NoteComponent;
  imageurl: string;
  width: number;
  height: number;
}


/****** OBJECTS/TYPES FOR LOADING AND SAVING FILES *****/


/**
 * holds data about each node/component in a form to easily load.
 * @param node_id the id of this node within the tree
 * @param type the type of node
 * @param topleft the screen position and size data for this node
 */
export interface NodeComponentProxy {
  node_id: number,
  type: string,
  topleft: Point
}

/**
 * stores a sparce version of a tree node for easy reloading
 * @param node the node id this treenode refers too
 * @param parent the node id of the parent node for this treenode
 * @param inputs an array of treenode ids for all values coming into this node
 * @param outputs an array of treenode ids for all downstream functions 
 */
export interface TreeNodeProxy {
  node: number,
  parent: number;
  inputs: Array<{ tn: number, ndx: number }>;
  outputs: Array<{ tn: number, ndx: number }>;
}

/**
* holds data about each draft component in a compressed form 
* @param draft_id the draft id associated with this node (if available)
* @param draft_visible a boolean to state if this node is visible or not. 
* @param draft_name a string representing a user defined name
* @param warps the number of warps in the drawdown
* @param wefts the number of wefts in the drawdown 
* @param compressed_draft this will only export if the draft is a seed draft
* @param loom this will only export if the draft is a seed draft 
* @param loom_settings the associated loom settings on this node, if present
*/

export interface DraftNodeProxy {
  node_id: number;
  draft_id: number;
  ud_name: string;
  gen_name: string;
  draft: Draft;
  compressed_draft: CompressedDraft;
  draft_visible: boolean;
  loom: Loom;
  loom_settings: LoomSettings;
  render_colors: boolean;
  scale: number;
}

/**
 * a sparse form of an operation component to use for saving
 * @param node_id the node id this object refers too
 * @param name the name of the operation at this node
 * @param params the list of input parameters to this operation
 * @param inlets the let of inlets and associated values 
 */
export interface OpComponentProxy {
  node_id: number,
  name: string,
  params: Array<any>,
  inlets: Array<any>;
}

export interface Upload {
  $key: string,
  file: File,
  name: string,
  url: string,
  progress: number,
  createdAt: Date,

}

/**
 * a container for zoom values of the editor, mixer.
 */
export interface ZoomProxy {
  editor: number;
  mixer: number;
}

/**
 * a media object is something a user uploads for manipulation in AdaCAD that is stored on the Firebase server
 * a media object belongs to a user and eventually can be used across file contexts
 * @param id a unique id that refers to only this media object instance
 * @param ref the reference id used to find the media object in storage
 * @param type a flag to determine which type of media this is
 */
export type MediaInstance = {
  id: number;
  ref: string;
  type: 'image' | 'indexed_color_image'; //currently we only support images
  img: IndexedColorImageInstance | SingleImage;

}

export type IndexedColorImageInstance = MediaInstance & {
  img: AnalyzedImage;
}

export type IndexedColorMediaProxy = {
  id: number,
  ref: string,
  colors: Array<Color>;
  color_mapping: Array<{ from: number, to: number }>;
}


/**
 * describes the data from the workspace that is saved.
 */
export interface SaveObj {
  version: string,
  workspace: any,
  zoom: ZoomProxy,
  type: string,
  nodes: Array<NodeComponentProxy>,
  tree: Array<TreeNodeProxy>,
  draft_nodes: Array<DraftNodeProxy>,
  ops: Array<OpComponentProxy>,
  notes: Array<Note>,
  materials: Array<Material>,
  indexed_image_data: Array<IndexedColorMediaProxy>
}

export interface FileObj {
  version: string,
  workspace: any,
  zoom: ZoomProxy,
  filename: string,
  nodes: Array<NodeComponentProxy>,
  treenodes: Array<TreeNodeProxy>,
  draft_nodes: Array<DraftNodeProxy>,
  notes: Array<any>,
  ops: Array<OpComponentProxy>,
  indexed_image_data: Array<IndexedColorMediaProxy>

}


export interface StatusMessage {
  id: number,
  message: string,
  success: boolean
}

export interface LoadResponse {
  data: FileObj,
  id: number,
  name: string,
  desc: string,
  status: number,
  from_share: string
}

export interface Fileloader {
  ada: (filename: string, src: string, id: number, desc: string, data: any, from_share: string) => Promise<LoadResponse>,
  paste: (data: any) => Promise<LoadResponse>,
  //wif: (filename: string, data: any) => Promise<LoadResponse>,
}

export interface FileSaver {
  ada: () => Promise<{ json: string, file: SaveObj }>,
  copy: (include: Array<number>) => Promise<SaveObj>,
  wif: (draft: Draft, loom: Loom, loom_settings: LoomSettings) => Promise<string>
  bmp: (canvas: HTMLCanvasElement) => Promise<string>,
  jpg: (canvas: HTMLCanvasElement) => Promise<string>
}




/****************** OBJECTS/TYPES RELATED to OPERATION TREE *****************/


/**
 * this stores a reference to a component on the palette with its id and some
 * @param type is the type of component'
 * @param view_id is ndx to reference to this object in the ViewComponentRef (for deleting)
 * @param id is a unique id linked forever to this component 
 * @param component is a reference to the component object
 * @param dirty describes if this needs to be recalcuated or redrawn 
 */
type BaseNode = {
  type: 'draft' | 'op' | 'cxn',
  ref: ViewRef,
  id: number, //this will be unique for every instance
  component: SubdraftComponent | OperationComponent | ConnectionComponent,
  dirty: boolean
}


/**
 * an OpNode is an extension of BaseNode that includes additional params
 * @param name the name of the operation at this node
 * @param params an array of the current param values at this node
 * @param inlets an array of the inlet values at this node (for instance, in the layer notation op, these might be 'a', 'b', etc.)
 * @param outlets an array of the 
 */
export type OpNode = BaseNode & {
  name: string,
  params: Array<any>
  inlets: Array<any>
}


/**
* a DraftNode is an extension of BaseNode that includes additional params
* @param draft the active draft at this node
* @param loom the loom associated with the draft at this node
* @param loom_settings the settings associted with the loom at this node
*/
export type DraftNode = BaseNode & {
  draft: Draft,
  loom: Loom,
  loom_settings: LoomSettings,
  render_colors: boolean,
  scale: number,
  visible: boolean,
  mark_for_deletion: boolean
}


/**
 * Allows one to use Node as shorthand for any of these types of nodes
 */
export type Node = BaseNode | OpNode | DraftNode;


/**
 * a type to store input and output information for nodes that takes multiple node inputs and outputs into account.
 * each IOTuple stores the node it gets as input and output and the inlet/outlet that node enter into on itself. 
 * connections will have inlet/outlet indexes of {0, 0} (they cannot connect to multiple things)
 * drafts will have inlet indexes of {0, 0} (they can only have one parent)
 * ops will have multiple inlets and outlets. For example, an input of (2, 1) means that treenode 2 is connected to inlet 1. 
 * @param treenode - the treenode that this input or output goes towards
 * @param ndx - which ndx on the said treenodes does this connect to specifically
 * @param val - the value associated with this inlet
 */
export interface IOTuple {
  tn: TreeNode,
  ndx: number
}

/**
 * A tree node stores relationships between the components created by operations
  * @param node: is a reference to the node object stored in the tree. 
  * @param parent links to the treenode that "created" this node or null if it was created by the user 
  * @param inputs a list of TreeNodes that are used as input to this TreeNode with an idex to which input they belong to
  * @param outputs a list of TreeNodes created by this node or specified by the user
  * Rules: 
  *   Operations can have many inputs and many outputs 
  *   Subdrafts can only have one input and one output (for now)
  *   
*/
export interface TreeNode {
  node: Node,
  parent: TreeNode,
  inputs: Array<IOTuple>,
  outputs: Array<IOTuple>
}


/****** OBJECTS/TYPES FOR SIMULATING YARN PATHS *****/


/**
 * a yarn cell holds a binary value representing the direction of the weft yarn through the cell. 
 * the binary is organized as NESW and has a 0 if no yarn is at that point, or 1 if there is a yarn at that point
 * for example. 0101 is a weft yarn that travels through the cell, 1100 is a weft yarn that comes in the east (right) size and curves, existing the bottom edge of teh cell
 */
export type YarnCell = number;


/**
 * represts the point of this yarn within the simulation
 */
export type YarnVertex = {
  x: number,
  y: number,
  z: number,
  i: number,
  j: number
};

/**
 * used in the relaxing round of the simulation to store teh amount of deflection that should be inflicted on any individual vertex. 
 */
export type Deflection = {
  dx: number,
  dy: number,
  dz: number,
  i: number,
  j: number
};




/**
 * used to calculate arching of floats
 */
export type YarnFloat = {
  heddle: boolean,
  end: number,
  start: number,
  layer: number
}





export type YarnSimSettings = {

  warp_sett: number, //the distance between warp center points on the loom
  warp_tension: number, //the tension value of the warp (higher tension, tighter packing)
  fpack: number, //the force exerted by the packing 

}

export type WarpInterlacementTuple = {
  j: number,
  i_top: number,
  i_bot: number,
  orientation: boolean; //true = black cell over white, false white over black. 
}

export type WeftInterlacementTuple = {
  i: number,
  j_left: number,
  j_right: number,
  orientation: boolean //true = black left white right 
}

export type InterlacementLayerMap = {
  i: number,
  j: number,
  layer: number

}

//marks a point of interlacement between wefts and warps
// x -             - x
// - x === true    x - == false
export type TopologyVtx = {
  id: string,
  i_top: number,
  i_bot: number,
  j_left: number,
  j_right: number,
  z_pos: number,
  orientation: boolean;

}

export type WarpRange = {
  j_left: number,
  j_right: number

}

export type WarpWeftLayerCount = {
  ndx: number,
  count: number,
  layer: number
}

export type WarpHeight = {
  over: number,
  under: number
}

export type SimulationData = {
  draft: Draft,
  sim: SimulationVars,
  topo: Array<TopologyVtx>,
  vtxs: VertexMaps,
  layer_maps: LayerMaps
};

export type SimulationVars = {
  warp_spacing: number,
  layer_spacing: number,
  layer_threshold: number,
  max_interlacement_width: number,
  max_interlacement_height: number,
  boundary: number,
  radius: number,
  ms: MaterialsService
}

export type LayerMaps = {
  warp: Array<Array<number>>,
  weft: Array<Array<number>>
}

export type VertexMaps = {
  warps: Array<Array<YarnVertex>>,
  wefts: Array<Array<YarnVertex>>
}


/**** SETTINGS FOR OTHER FEATURES */

export type Example = {
  id: string,
  ext: string,
  title: string,
  desc: string
}


export type CanvasList = {
  id: number,
  drawdown: HTMLCanvasElement,
  threading: HTMLCanvasElement,
  tieup: HTMLCanvasElement,
  treadling: HTMLCanvasElement,
  warp_systems: HTMLCanvasElement,
  warp_mats: HTMLCanvasElement,
  weft_systems: HTMLCanvasElement,
  weft_mats: HTMLCanvasElement
}

/**
 * used to tell the draft renderer what to redraw and what settings to use
 */
export type RenderingFlags = {
  u_drawdown: boolean,
  u_threading: boolean,
  u_treadling: boolean,
  u_tieups: boolean,
  u_warp_sys: boolean,
  u_warp_mats: boolean,
  u_weft_sys: boolean,
  u_weft_mats: boolean,
  use_colors: boolean,
  use_floats: boolean,
  show_loom: boolean
}


/**
 * File sharing
 */


export type ShareObj = {
  license: string,
  owner_uid: string,
  owner_creditline: string,
  owner_url: string,
  filename: string,
  desc: string,
  public: boolean,
  img: string

}






