import { ViewRef } from "@angular/core";
import { AnalyzedImage, Color, CompressedDraft, Draft, Loom, LoomSettings, Material, OpInletValType, OpParamValType, SingleImage } from "adacad-drafting-lib";
import { BehaviorSubject } from "rxjs";
import { ConnectionComponent } from "../../mixer/palette/connection/connection.component";
import { NoteComponent } from "../../mixer/palette/note/note.component";
import { OperationComponent } from "../../mixer/palette/operation/operation.component";
import { SubdraftComponent } from "../../mixer/palette/subdraft/subdraft.component";



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
  params: Array<OpParamValType>,
  inlets: Array<OpInletValType>,
  recomputing: BehaviorSubject<boolean>,
  checkChildren: BehaviorSubject<boolean>, //called after a perform when there is a chance new children could have been created
  positionChange: BehaviorSubject<Point>
}


export type ConnectionNode = BaseNode & {
  upstreamOfSelected: BehaviorSubject<boolean>,
  downstreamOfSelected: BehaviorSubject<boolean>,
}


/***
 * a DraftNode is an extension of BaseNode that includes additional params
 * @param draft the active draft at this node
 * @param loom the loom associated with the draft at this node
 * @param loom_settings the settings associated with the loom at this node
 * @param render_colors whether to render the colors of the draft
 * @param scale the local zoom of the draft to use on the mixer
 * @param visible whether the draft is visible on the mixer
 * @param mark_for_deletion whether the draft is marked for deletion
 * @param onValueChange a subject to emit the draft when it changes
 * @param valueChange$ an observable to subscribe to the draft when it changes
 */
export type DraftNode = BaseNode & {
  draft: Draft,
  loom: Loom,
  loom_settings: LoomSettings,
  render_colors: boolean,
  scale: number,
  visible: boolean,
  mark_for_deletion: boolean,
  onValueChange: BehaviorSubject<DraftNodeBroadcast>, //called anytime a value on this draft is set
  canvases: CanvasList,
  positionChange: BehaviorSubject<Point>

}


/**
 * Allows one to use Node as shorthand for any of these types of nodes
 */
export type Node = BaseNode | OpNode | DraftNode;


export type DraftNodeBroadcast = {
  id: number,
  draft: Draft,
  loom: Loom,
  loom_settings: LoomSettings,
  flags: DraftNodeBroadcastFlags
}


/**used to signal what aspect of this node changed, used for rendering */
export type DraftNodeBroadcastFlags = {
  meta: boolean, //name, view settings, etc 
  draft: boolean, //the drawdown, or system mappings
  loom: boolean, //the loom itself
  loom_settings: boolean //the loom settings,
  materials: boolean //the rowShuttle or colShuttle mappings
}





/***** OBJECTS/TYPES RELATED TO MIXER COMPONENTS ****/

/**
 * this stores a list of drafts created with associated component ids for those drafts, 
 * or -1 if the component for this draft has not been generated yet. 
 */
export interface DraftMap {
  component_id: number;
  draft: any;
}

/**
 * a way to store the relationship between two nodes so we can restore them if we need on undo
 */
export type OutwardConnectionProxy = {
  identity: "DRAFT" | "OP",
  outlet_id: number,
  to_id: number,
  inlet_id: number
}

export type InwardConnectionProxy = {
  from_id: number, //always references a draft id
  inlet_id: number
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


export interface MultiSelectElement {
  id: number,
  topleft: Point,
  positionUpdate: BehaviorSubject<Point>
}


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
  notes: string;
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

/**
 * a container for zoom values of the editor, mixer.
 */
export interface ZoomProxy {
  editor: number;
  mixer: number;
}

// /**
//  * a media object is something a user uploads for manipulation in AdaCAD that is stored on the Firebase server
//  * a media object belongs to a user and eventually can be used across file contexts
//  * @param id a unique id that refers to only this media object instance
//  * @param ref the reference id used to find the media object in storage
//  * @param type a flag to determine which type of media this is
//  */
export type MediaInstance = {
  id: number;
  ref: string;
  type: 'image' | 'indexed_color_image'; //currently we only support images
  img: SingleImage | AnalyzedImage;
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
  type: 'mixer' | 'partial' | 'wif',
  nodes: Array<NodeComponentProxy>,
  tree: Array<TreeNodeProxy>,
  draft_nodes: Array<DraftNodeProxy>,
  ops: Array<OpComponentProxy>,
  notes: Array<Note>,
  materials: Array<Material>,
  indexed_image_data: Array<IndexedColorMediaProxy>
}

// export interface FileObj {
//   version: string,
//   workspace: any,
//   zoom: ZoomProxy,
//   filename: string,
//   nodes: Array<NodeComponentProxy>,
//   treenodes: Array<TreeNodeProxy>,
//   draft_nodes: Array<DraftNodeProxy>,
//   notes: Array<any>,
//   ops: Array<OpComponentProxy>,
//   indexed_image_data: Array<IndexedColorMediaProxy>

// }


export interface StatusMessage {
  id: number,
  message: string,
  success: boolean
}

export interface LoadResponse {
  data: SaveObj,
  meta: FileMeta,
  status: number,
}

export interface Fileloader {
  ada: (data: SaveObj, meta: FileMeta, src: string) => Promise<LoadResponse>,
  paste: (data: any) => Promise<LoadResponse>,
  wif: (filename: string, data: any) => Promise<LoadResponse>,
  bitmap: (filename: string, data: any) => Promise<LoadResponse>,
}

export interface FileSaver {
  ada: () => Promise<{ json: string, file: SaveObj }>,
  copy: (include: Array<number>) => Promise<SaveObj>,
  png: (canvas: HTMLCanvasElement) => Promise<string>,
  wif: (draft: Draft, loom: Loom, loom_settings: LoomSettings) => Promise<string>
  bmp: (canvas: HTMLCanvasElement) => Promise<string>,
  jpg: (canvas: HTMLCanvasElement) => Promise<string>
}



/**
 * this type is used to classify operations in the dropdown menu
 * @param category the name of the category for all associated operations (e.g. block, structure)
 * @param dx a description of that category to show on screen
 * @param ops an array of all the operations associated with this category
 */
export interface OperationClassification {
  category_name: string,
  description: string,
  color: string,
  op_names: Array<string>;
}



export interface Upload {
  $key: string,
  file: File,
  name: string,
  url: string,
  progress: number,
  createdAt: Date,
  fileType: string,
}



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

/**** SETTINGS FOR OTHER FEATURES */

export type Example = {
  id: string,
  ext: string,
  title: string,
  docs?: string,
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
  show_loom: boolean,
  use_sizes: boolean
}


export type FileMeta = {
  id: number,
  name: string,
  desc: string,
  time?: number,
  from_share: string,
  share_owner: string
}

export type UserFile = {
  id: number,
  meta: FileMeta
}

export type FilesState = {
  user: UserFile[],
  shared: ShareObj[],
  public: ShareObj[]
}


/**
 * File sharing
 */




export type ShareObj = {
  id: number,
  license: string,
  owner_uid: string,
  owner_creditline: string,
  owner_url: string,
  filename: string,
  desc: string,
  public: boolean,
  img: string

}


/**
 * State - UNDO and REDO
 * classify all the kinds of events that can create a workspace change so that we can undo or redo them.
 */
/**
 * an object to store the state of a draft node for undo/redo
 * @param draft the draft object
 * @param draft_visible the visibility of the draft
 * @param loom the loom object
 * @param loom_settings the loom settings object
 */
export interface DraftNodeState {
  draft: Draft;
  draft_visible: boolean;
  loom: Loom;
  loom_settings: LoomSettings;
  scale: number;
}


export type StateChangeEvent = {
  originator: 'OP' | 'DRAFT' | 'CONNECTION' | 'NOTE' | 'MATERIALS' | 'MIXER' | 'FILEMETA'
}

type MoveEvent = {
  id: number,
  before: Point,
  after: Point
}

type MultiMoveEvent = {
  moving_id: number,
  relative_position_before: Point,
  relative_position_after: Point,
  selected_before: Array<{ id: number, topleft: Point }>,
  selected_after: Array<{ id: number, topleft: Point }>
}

type ParamEvent = {
  opid: number,
  paramid: number,
  before: OpParamValType,
  after: OpParamValType
}

type NumberEvent = {
  before: number,
  after: number
}

type NodeEvent = {
  node: OpNode | DraftNode | BaseNode,
  inputs: Array<InwardConnectionProxy>,
  outputs: Array<OutwardConnectionProxy>,
  media?: Array<MediaInstance>
}

type ConnectionChangeEvent = {
  from: number,
  to: number,
  inlet: number
}


type DraftChangedEvent = {
  id: number,
  before: DraftNodeState,
  after: DraftNodeState
}


export type FileMetaStateChange = StateChangeEvent & {
  type: 'META_CHANGE',
  id: number,
  before: FileMeta,
  after: FileMeta
}


export type MixerStateChangeEvent = StateChangeEvent & {
  type: 'PASTE' | 'DELETE' | 'MOVE',
}

export type MixerStateMove = MixerStateChangeEvent & MultiMoveEvent;

export type MixerStatePasteEvent = MixerStateChangeEvent & {
  ids: Array<number>,
};
export type MixerStateDeleteEvent = MixerStateChangeEvent & {
  obj: SaveObj,
};
export type OpStateEvent = StateChangeEvent & {
  type: 'MOVE' | 'PARAM_CHANGE' | 'CREATED' | 'REMOVED'
}


export type OpStateMove = OpStateEvent & MoveEvent;
export type OpStateParamChange = OpStateEvent & ParamEvent;
export type OpStateLocalZoomChange = OpStateEvent & NumberEvent
export type OpExistenceChanged = OpStateEvent & NodeEvent;
export type OpStateConnectionChange = OpStateEvent & ConnectionChangeEvent;


export type DraftStateEvent = StateChangeEvent & {
  type: 'MOVE' | 'VALUE_CHANGE' | 'NAME_OR_NOTES_CHANGE' | 'CREATED' | 'REMOVED'
}

export type DraftStateMove = DraftStateEvent & MoveEvent;
export type DraftStateChange = DraftStateEvent & DraftChangedEvent;
export type DraftExistenceChange = DraftStateEvent & NodeEvent;
export type DraftStateNameChange = DraftStateEvent & {
  id: number,
  before: { name: string, notes: string },
  after: { name: string, notes: string }
};

export type DraftStateNameOrNotesChange = DraftStateEvent & {
  id: number,
  before: { name: string, notes: string },
  after: { name: string, notes: string }
};

export type ConnectionStateEvent = StateChangeEvent & {
  type: 'CREATED' | 'REMOVED'
}

export type ConnectionExistenceChange = ConnectionStateEvent & NodeEvent


export type WorkspaceStateChange = StateChangeEvent & {
  type: 'SETTINGS' | 'FILE_META',
  workspace: any; //whatever is in the workspace
  meta: FileMeta
}

export type NoteStateChange = StateChangeEvent & {
  type: 'CREATED' | 'REMOVED' | 'UPDATED' | 'MOVE',
}

export type NoteStateMove = NoteStateChange & MoveEvent;
export type NoteValueChange = NoteStateChange & {
  id: number,
  before: Note,
  after: Note
}

export type MaterialsStateChange = StateChangeEvent & {
  type: 'UPDATED',
  before: Array<Material>,
  after: Array<Material>
}

/**
 * this is what is communicated from the state service to the component that needs to execute the command
 */
export type StateAction = {
  type: "CREATE" | "REMOVE" | "CHANGE",
}

export type FileMetaStateAction = StateAction & {
  id: number,
  before: FileMeta,
  after: FileMeta
}

export type NoteAction = StateAction & {
  before: Note,
  after: Note,
  id: number
}


export type MoveAction = StateAction & {
  id: number,
  before: Point,
  after: Point
}

export type ParamAction = StateAction & {
  opid: number,
  paramid: number,
  value: OpParamValType
}

export type NodeAction = StateAction & {
  node: Node,
  inputs: Array<InwardConnectionProxy>,
  outputs: Array<OutwardConnectionProxy>,
  media?: Array<MediaInstance>
}

export type DraftStateAction = StateAction & {
  id: number,
  before: DraftNodeState,
  after: DraftNodeState
}

export type RenameAction = StateAction & {
  id: number,
  before: { name: string, notes: string },
  after: { name: string, notes: string }
}



export type MaterialsStateAction = StateAction & {
  before: Array<Material>,
  after: Array<Material>
}



export type MixerStateMoveAction = StateAction & {
  moving_id: number,
  relative_position: Point,
  selected: Array<{ id: number, topleft: Point }>,
}

export type MixerStateRemoveAction = StateAction & {
  ids: Array<number>,
}


export type MixerStatePasteAction = StateAction & {
  obj: SaveObj,
}



export type ErrorType = 'SIZE_ERROR' | 'FILE_ERROR' | 'OTHER';

export type ErrorStatement = {
  id: number,
  type: ErrorType
  label: string
  affected_nodes?: Array<number>
}