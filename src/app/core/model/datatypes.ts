import { ViewRef } from "@angular/core";
import { NoteComponent } from "../../mixer/palette/note/note.component";
import { ConnectionComponent } from "../../mixer/palette/connection/connection.component";
import { OperationComponent } from "../../mixer/palette/operation/operation.component";
import { SubdraftComponent } from "../../mixer/palette/subdraft/subdraft.component";
import { MaterialsService } from "../provider/materials.service";

/**
 * This file contains all definitions of custom types and objects
 */


/*** APPLICATION STATE MANAGEMENT */



/*****   OBJECTS/TYPES RELATED TO DRAFTS  *******/


/**
 * Drawdown can be used as shorthand for drafts, which are just 2D arrays of Cells
 */
export type Drawdown = Array<Array<Cell>>;


/**
 * stores a drawdown along with broader information a draft such
 * @param id a unique id to refer to this draft, used for linking the draft to screen components
 * @param gen_name a automatically generated name for this draft (from parent operation)
 * @param ud_name a user defined name for this draft, which, if it exists, will be used instead of the generated name
 * @param drawdown the drawdown/interlacement pattern used in this draft
 * @param rowShuttleMapping the repeating pattern to use to assign draft rows to shuttles (materials)
 * @param rowSystemMapping the repeating pattern to use to assign draft rows to systems (structual units like layers for instance)
 * @param colShuttleMapping the repeating pattern to use to assign draft columns to shuttles (materials)
 * @param colSystemMapping the repeating pattern to use to assign draft columns to systems (structual units like layers for instance)
 */
export interface Draft{
  id: number,
  gen_name: string,
  ud_name: string,
  drawdown: Drawdown,
  rowShuttleMapping: Array<number>,
  rowSystemMapping: Array<number>,
  colShuttleMapping: Array<number>,
  colSystemMapping: Array<number>,
}


/**
 * a modified version of the draft that stores the drawdown as a Byte Array to save space
 */
export interface CompressedDraft{
  id: number,
  gen_name: string,
  ud_name: string,
  warps: number; 
  wefts: number;
  compressed_drawdown:  Array<number>,
  rowShuttleMapping: Array<number>,
  rowSystemMapping: Array<number>,
  colShuttleMapping: Array<number>,
  colSystemMapping: Array<number>,
}


export interface Cell{
  is_set: boolean,
  is_up: boolean
}


export interface System{
  id: number;
  name: string;
  notes: string;
  visible: boolean;
  in_use: boolean;
}



export interface Material {
  id: number;
  name: string;
  insert: boolean; //true is left, false is right
  visible: boolean;
  color: string;
  thickness: number; //percentage of base dims
  type: number;
  diameter: number;
  startLabel?: string;
  endLabel?: string;
  notes: string;
  rgb: {r: number, g: number, b: number}

}

/**
 * represents a location within a draft.
 * @param i is the row/weft number (0 being at the top of the drawdown)
 * @param j is the column/warp number (0 being at the far left of the drawdown)
 * @param si is the location of this cell within the current view (where the view may be hiding some rows)
 *        this value can be de-indexed to absolute position in the rows using draft.visibleRows array
 * @example const i: number = draft.visibleRows[si];
 */
 export interface Interlacement {
  i: number;  
  j: number;  
  si: number; 
}

/**
 * represents a location within a draft as well as the value to be placed at that location
 * used by Loom to stage updates before settting them
 * @param i is the row/weft number (0 being at the top of the drawdown)
 * @param j is the column/warp number (0 being at the far left of the drawdown)
 * @param val the value to be assigned at the given location
 */

 export interface InterlacementVal {
  i: number;  
  j: number 
  val: boolean; 
}


/***** OBJECTS/TYPES RELATED TO MIXER COMPONENTS ****/

/**
 * this stores a list of drafts created with associated component ids for those drafts, 
 * or -1 if the component for this draft has not been generated yet. 
 */
 export interface DraftMap{
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
 export interface DesignMode{
  value: string;
  viewValue: string;
  icon?: string;
}

export interface Note{
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


/**
 * this keeps any user defined preferences associated with a given loom
 * @param type the type of loom to use for computations (currently only supporting jacquard, direct tieup/dobby looms, floor looms with shafts and treadles)
 * @param epi the ends for unit length to use for calcuations
 * @param units the units to use for length, currently supports inches (1 inch), or centimeters (10cm)
 * @param frames the number of frames the user has specified as the max for their loom
 * @param treadles the number of treadles the user has specified as the max for their loom or -1, if they have no limit
 */
 export type LoomSettings = {
  type: string,
  epi: number,
  units: 'cm' | 'in',
  frames: number,
  treadles: number,
}

/**
 * a loom is just a threading, tieup, and treadling
 */
export type Loom = {
  threading: Array<number>,
  tieup: Array<Array<boolean>>,
  treadling: Array<Array<number>>
}



/***
 *  Store each loom type as a different unit that computes functions based on its particular settings
 * @param type an identifer relating to the currently supported types
 * @param displayname the name to show with this loom type
 * @param dx the description for this type of loom
 * @param updateThreading a function to execute when a single cell is modified within the Threading
 * @param updateTreadling a function to execute when a single cell is modified within the Treadling
 * @param updateTieup a function to execute when a single cell is modified within the Tieup
 * @param pasteThreading a function to execute when a single cell is modified within the Threading
 * @param pasteTreadling a function to execute when a single cell is modified within the Treadling
 * @param pasteTieup a function to execute when a single cell is modified within the Tieup
 */
export type LoomUtil = {
  type: 'jacquard' | 'frame' | 'direct',
  displayname: string,
  dx: string,
  computeLoomFromDrawdown: (d:Drawdown, loom_settings: LoomSettings) => Promise<Loom>,
  computeDrawdownFromLoom: (l:Loom) => Promise<Drawdown>,
  recomputeLoomFromThreadingAndDrawdown:(l:Loom, loom_settings: LoomSettings, d: Drawdown) => Promise<Loom>,
  updateThreading: (l: Loom, ndx: InterlacementVal) => Loom,
  updateTreadling: (l: Loom, ndx: InterlacementVal) => Loom,
  updateTieup: (l: Loom, ndx: InterlacementVal)=> Loom,
  insertIntoThreading: (l: Loom, j: number, val: number) => Loom,
  insertIntoTreadling: (l: Loom, i: number, val: Array<number>) => Loom,
  deleteFromThreading: (l: Loom, j: number) => Loom,
  deleteFromTreadling: (l: Loom, i: number) => Loom,
  pasteThreading: (l: Loom, drawdown: Drawdown, ndx: InterlacementVal, width:number, height: number) => Loom,
  pasteTreadling: (l: Loom, drawdown: Drawdown, ndx: InterlacementVal, width:number, height: number) => Loom,
  pasteTieup: (l: Loom, drawdown: Drawdown, ndx: InterlacementVal, width:number, height: number)=> Loom
}


export type YarnMap = Array<Array<Cell>>;


/****** OBJECTS/TYPES FOR LOADING AND SAVING FILES *****/


/**
 * holds data about each node/component in a form to easily load.
 * @param node_id the id of this node within the tree
 * @param type the type of node
 * @param topleft the screen position and size data for this node
 */
export interface NodeComponentProxy{
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
 export interface TreeNodeProxy{
  node: number,
  parent: number; 
  inputs: Array<{tn: number, ndx: number}>;
  outputs: Array<{tn: number, ndx: number}>; 
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

   export interface DraftNodeProxy{
    node_id: number;
    draft_id: number;
    draft_name: string;
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
 export interface OpComponentProxy{
  node_id: number,
  name: string,
  params: Array<any>, 
  inlets: Array<any>;
 }

 /**
  * a container for zoom values of the editor, mixer.
  */
 export interface ZoomProxy{
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
 export type MediaInstance ={
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
  color_mapping: Array<{from:number, to: number}>;
 }


 /**
  * describes the data from the workspace that is saved.
  */
 export interface SaveObj{
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

export interface FileObj{
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


export interface StatusMessage{
  id: number,
  message: string,
  success: boolean
}

export interface LoadResponse{
  data: FileObj,
  id: number,
  name: string, 
  desc: string,
  status: number,
  from_share: string
}

export interface Fileloader{
  ada: (filename: string, src: string, id: number, desc: string, data: any, from_share: string) => Promise<LoadResponse>,
  paste: (data: any) => Promise<LoadResponse>,
  //wif: (filename: string, data: any) => Promise<LoadResponse>,
}

export interface FileSaver{
  ada: () => Promise<{json: string, file: SaveObj}>,
  copy: (include: Array<number>) => Promise<SaveObj>,
  wif: (draft: Draft, loom: Loom, loom_settings: LoomSettings) => Promise<string>
  bmp: (canvas: HTMLCanvasElement) => Promise<string>,
  jpg: (canvas: HTMLCanvasElement) => Promise<string>
}


/****************** OBJECTS/TYPES RELATED to OPERATIONS *****************/


/**
 * each operation has 0 or more inlets. These are areas where drafts can be entered as inputs to the operation
 * @param name the display name to show with this inlet
 * @param type the type of parameter that becomes mapped to inputs at this inlet, static means that the user cannot change this value
 * @param dx the description of this inlet
 * @param uses this is used to alert the user the inforamation from the input this inlet will use, draft or materials. 
 * @param value the assigned value of the parameter. 
 * @param num_drafts the total number of drafts accepted into this inlet (or -1 if unlimited)
 */
 export type OperationInlet = {
  name: string,
  type: 'number' | 'notation' | 'system' | 'color' | 'static' | 'draft' | 'profile' | 'null',
  dx: string,
  uses: 'draft' | 'weft-data' | 'warp-data' | 'warp-and-weft-data' ,
  value: number | string | null,
  num_drafts: number
}


/**
 * An extension of Inlet that handles extra requirements for numeric data inputs
 * @param value the current (or default?) value of this number input
 * @param min the minimum allowable value
 * @param max the maximum allowable value
 */
 export type NumInlet = OperationInlet & {
  value: number,
  min: number,
  max: number
}




/**
 * an operation param describes what data be provided to this operation
 * some type of operations inherent from this to offer more specific validation data 
 */
export type OperationParam = {
  name: string,
  type: 'number' | 'boolean' | 'select' | 'file' | 'string' | 'draft' | 'notation_toggle' | 'code';
  value: any,
  dx: string
}

/**
 * An extension of Param that handles extra requirements for numeric data inputs
 * @param min the minimum allowable value
 * @param max the maximum allowable value
 */
export type NumParam = OperationParam & {
  min: number,
  max: number
}


/**
 * An extension of Param that handles extra requirements for select list  inputs
 * @param seleclist an array of names and values from which the user can select
 */
export type SelectParam = OperationParam & {
  selectlist: Array<{name: string, value: number}>
}

/**
 * An extension of Param that handles extra requirements for select boolean inputs
 * @param falsestate a description for the user explaining what "false" means in this param
 * @param truestate a description for the user explaining what "false" means in this param
 */
export type BoolParam = OperationParam & {
  falsestate: string,
  truestate: string
}

/**
* An extension of Param that handles extra requirements for select file inputs
*/
export type FileParam = OperationParam & {
}

/**
* An extension of Param that handles extra requirements for blocks that interpret code
*/
export type CodeParam = OperationParam & {
  docs: string;
}



/**
* An extension of Param that in intended to shape how inlets parse layer notation to generate inlets
* @param id draft id at this parameter --- unusued currently 
*/
export type NotationTypeParam = OperationParam & {
  falsestate: string,
  truestate: string
}


/**
* An extension of Param that handles extra requirements for strings as inputs
* @param regex strings must come with a regex used to validate their structure
 * test and make regex using RegEx101 website
 * do not use global (g) flag, as it creates unpredictable results in test functions used to validate inputs
@param error the error message to show the user if the string is invalid 
*/
export type StringParam = OperationParam & {
  regex: RegExp,
  error: string
}


 /**
  * this containers the parameters associated with the operation
  * @param op_name the name of the operation  input parameter
  * @param params the parameters associated with this operation OR child input
  */
 export interface OpParamVal{
  param: OperationParam,
  val: any
 }


 /**
  * this is a type that contains and contextualizes a series of inputs to an operation, each inlet on an operation corresponds to one op input
  * @param drafts the drafts (from zero to multiple) associated with this input
  * @param params the parameters associated with this input
  * @param inlet_id the index of the inlet for which the draft is entering upon
  */
  export interface OpInput{
    drafts: Array<Draft>,
    params: Array<any>,
    inlet_id: number
   }
  
/**
 * a standard opeartion
 * @param name the internal name of this opearation (CHANGING THESE WILL BREAK LEGACY VERSIONS)
 * @param displayname the name to show upon this operation in the interface
 * @param dx the description of this operation
 * @param params the parameters associated with this operation
 * @param inets the inlets associated with this operation
 * @param old_names referes to any prior name of this operation to aid when loading old files
 * @param perform a function that executes when this operation is performed, takes a series of inputs and resturns an array of drafts
 * @param generateName a function that computes the system provided name default based on the inputs. a number can be passed in args to handle cases where the operation needs to assign different names to different draft outputs
 */
export type Operation = {
    name: string,
    params: Array<OperationParam>,
    inlets: Array<OperationInlet>,
    old_names: Array<string>,
    perform: (op_settings: Array<OpParamVal>, op_inputs: Array<OpInput>) => Promise<Array<Draft>>,
    generateName: (op_settings: Array<OpParamVal>, op_inputs: Array<OpInput>, ...args) => string
 }

 /**
 * A container operation that takes drafts with some parameter assigned to them 
 * @param dynamic_param_id which parameter ids should we use to determine the number and value of parameterized input slots
 * @param dynamic_inlet_type dynamic parameters convert parameter inputs to inlets of a given type, this specifies the type of inlet created
 * @param onParamChange a function that executes when a dynamic parameter is changed
 */
export type DynamicOperation = Operation &  {
  dynamic_param_id: Array<number>,
  dynamic_param_type: 'number' | 'notation' | 'system' | 'color' | 'static' | 'draft' | 'profile' | 'null',
  onParamChange: ( param_vals: Array<OpParamVal>, inlets: Array<OperationInlet>, inlet_vals: Array<any>, changed_param_id: number, dynamic_param_vals: Array<any>) => Array<any>;
  perform: (param_vals: Array<OpParamVal>, op_inputs: Array<OpInput>) => Promise<Array<Draft>>;
}



 /**
  * this type is used to classify operations in the dropdown menu
  * @param category the name of the category for all associated operations (e.g. block, structure)
  * @param dx a description of that category to show on screen
  * @param ops an array of all the operations associated with this category
  */
 export interface OperationClassification{
  category_name: string,
  description: string,
  color: string,
  op_names: Array<string>;
 }



 /**
  * an object that is stored in memory when an image is loaded
  * @param name the file name of the uploaded file
  * @param data the raw data of the image 
  * @param colors an array of unique hex values found in this image 
  * @param colors_mapping an array that matches each index in the color array to a color index that it should be grouped with
  * @param image the HTML image object to write the data into 
  * @param image_map an 2D array associating every pixel in the image with the id of the associated color in the colors array
  * @param width 
  * @param height
  * @param type
  * @param warning a text warning is added if the image file violates rules
  */
 export interface AnalyzedImage{
    name: string,
    data: ImageData, 
    colors: Array<Color>,
    colors_mapping: Array<{from: number, to: number}>,
    proximity_map: Array<{a: number, b: number, dist: number}>,
    image: HTMLImageElement,
    image_map: Array<Array<number>>,
    width:number,
    height: number,
    type: string,
    warning: string
 }

 export interface Color{
  r: number,
  g: number,
  b: number,
  hex: string
 }

 export interface Upload {
  $key: string,
  file:File,
  name:string,
  url:string,
  progress:number,
  createdAt: Date,

}

export interface SingleImage{
  name: string,
  data: ImageData, 
  image: HTMLImageElement,
  width:number,
  height: number,
  type: string,
  warning: string
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
 export interface IOTuple{
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
export interface TreeNode{
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
export type TopologyVtx ={
  id: string,
  i_top: number,
  i_bot: number,
  j_left: number,
  j_right: number,
  z_pos: number,
  orientation: boolean;

}

export type WarpRange ={
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

export type DraftCellColor = {
  id: string,
  r: number,
  g: number,
  b: number,
  a: number
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
  public:boolean,
  img: string

}
 





