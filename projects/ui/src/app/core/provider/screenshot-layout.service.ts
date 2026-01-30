import { inject, Injectable } from '@angular/core';
import { TreeNode } from '../model/datatypes';
import { TreeService } from './tree.service';


// Internal types used for modeling the tree as a simple graph and passing around position data

type LayoutNode = {
  id: number,
  width: number,
  height: number,
  originalX: number,
  row: number
}

type PositionedLayoutNode = LayoutNode & {
  x: number,
  y: number,
}

type LayoutGraph = {
  nodes: Record<number, LayoutNode>,
  edges: Record<number, Array<number>>,
}

type PositionedLayoutGraph = LayoutGraph & {
  nodes: Record<number, PositionedLayoutNode>,
}

type TreeNodeWithGeneration = TreeNode & {
  // represents the number of real ancestors the node has
  generation: number;
}

type TreeNodeGraph = {
  nodes: Record<number, TreeNodeWithGeneration>,
  edges: Record<number, Array<number>>,
}

type LayoutCssGridConfig = {
  columnGap: number,
  rowGap: number,
  justifyContent: 'space-around' | 'start' | 'space-evenly';
}

/**
 * This layout service helps us do simple clean layouts for all the screenshots seen in the documentation.
 */
@Injectable({
  providedIn: 'root'
})
export class ScreenshotLayoutService {
  private tree = inject(TreeService);
  squareAndRowLayoutConfig: LayoutCssGridConfig;
  graphLayoutConfig: LayoutCssGridConfig;
  positionOffset: number;

  constructor() {
    this.squareAndRowLayoutConfig = {
      columnGap: 100,
      rowGap: 100,
      justifyContent: 'start',
    };

    this.graphLayoutConfig = {
      columnGap: 150,
      rowGap: 220,
      justifyContent: 'start',
    };

    this.positionOffset = 4000;

    // exposing autoLayout function on the window so we can easily call it from the
    // console / puppeteer script
    (window as any).autoLayout = () => this.autoLayout();
  }

  /**
   * auto layout all nodes in the tree 
   */
  public autoLayout() {
    try {
      const layoutGraph = this._getCurrentTreeAsLayoutGraph();
      const layout = this._getLayout(layoutGraph);
      this._updateLayout(layout);
    }
    catch (ex) {
      console.error(ex);
    }
  }

  /**
   * Converts the current tree state into a layout graph by:
   * 1. Building filtered subgraphs from each root node recursively
   * 2. Adding DOM-based size metadata to each node
   *
   * @returns An unpositioned layout graph ready for layout computation
   */
  private _getCurrentTreeAsLayoutGraph(): LayoutGraph {
    const allTreeNodes: Array<TreeNode> = this.tree.tree;

    // Find all root nodes (nodes with no inputs)
    const rootNodes = allTreeNodes.filter(node => node.inputs.length === 0);

    // Construct filtered subgraphs recursively for each root node
    const subgraphs = rootNodes.map(root => this._constructGraph(root));

    // Merge all subgraphs into a single tree graph
    const mergedGraph = this._mergeSubgraphs(subgraphs);

    // Add width and height, and original x pos data from DOM elements
    return this._addDomSizeAndPositionData(mergedGraph);
  }

  /**
   * finds a layout that reads from left to right, top to bottom, based on the connections
   * between nodes and their relationships. tries to preserve original ordering, and also 
   * minimize crossed connections. for trees without any edges, this will return the nodes in
   * the smallest grid square format possible (1-4 nodes -> 2x2 grid, 5-9 nodes -> 3x3 grid, etc) 
   * 
   * @argument g the nodes and edges which describe the ada draft
   * @returns a copy of the original graph with absolute positions added to the nodes
  */
  private _getLayout(g: LayoutGraph): PositionedLayoutGraph {
    if (Object.values(g.edges).every(nodeEdges => nodeEdges.length === 0)) {
      return this._getSquareAndRowLayout(g);
    }

    return this._getGraphLayout(g);
  }

  /**
   * finds nodes in the tree and updates their positions
   */
  private _updateLayout(layout: PositionedLayoutGraph) {
    for (let { id, x, y } of Object.values(layout.nodes)) {

      const node = this.tree.nodes.find(n => n.id === id);

      const component = node.component;
      if (component && 'setPosition' in component) {
        // applying a constant offset so the nodes aren't positioned closely to 0,0
        // when the nodes are too close to 0,0 we can't scroll any further to the left or upwards
        // and that causes issues with centering things in the screenshots
        component.setPosition({ x: x + this.positionOffset, y: y + this.positionOffset });
        continue;
      }

      // Shouldn't happen
      console.log('Could not find subdraft or operator for node ID:', id);
    }

    this._redrawConnections();
  }

  // redraw connections, copied from palette component
  private _redrawConnections() {
    let cxn = this.tree.getConnections().filter(el => el !== null);
    cxn.forEach(el => {
      el.refreshConnection();
    });
  }

  /**
   * finds positions for nodes in tree to make them appear in a simple row-based graph structure.
   * 
   * e.g:
   * ```
   * row 1  | A  B->C |     |  A B  |
   *        |  \|     | --> |  |\|  |
   * row 2  |   D     |     |  D C  |
   * ```
   * 
   * used for any screenshot that has drafts or patterns on the first row that connect to operators
   * on the second row. technically supports more than two rows, but that's all that's needed for 
   * most documentation screenshots.
   *
   * @returns a positioned layout graph for use in updating the real node positions
   */
  private _getGraphLayout(g: LayoutGraph): PositionedLayoutGraph {
    const rowCount = Object.values(g.nodes)
      .map(n => n.row + 1) // rows are zero-indexed, so adding 1
      .reduce((a, c) => Math.max(a, c), 0);

    // get all nodes and group them into rows, e.g, from the example above:
    // [ [ A B ] [ C D ] ]
    const getNodesInRow = (rowIndex: number) => Object.values(g.nodes).filter(n => n.row === rowIndex);
    const nodesByRow = Array.from({ length: rowCount })
      .map((_, i) => getNodesInRow(i).map(n => n.id));

    const allSortedRows = this._sortGraphRows(g, nodesByRow);

    const flexContainer = document.createElement('div');
    flexContainer.style.position = 'absolute';
    flexContainer.style.padding = '200px';
    flexContainer.style.left = '0';
    flexContainer.style.top = '0';
    flexContainer.style.display = 'flex';
    flexContainer.style.flexFlow = 'column';
    flexContainer.style.gap = this.graphLayoutConfig.rowGap + 'px';

    for (let row of allSortedRows) {
      const rowContainer = document.createElement('div');
      flexContainer.appendChild(rowContainer);

      rowContainer.style.display = 'flex';
      rowContainer.style.gap = this.graphLayoutConfig.columnGap + 'px';
      rowContainer.style.justifyContent = this.graphLayoutConfig.justifyContent;

      for (let nodeId of row) {
        const node = g.nodes[nodeId];
        const nodeElt = document.createElement('div');
        rowContainer.appendChild(nodeElt);

        nodeElt.style.width = node.width + 'px';
        nodeElt.style.height = node.height + 'px';
        nodeElt.setAttribute('data-node', 'true');
        nodeElt.setAttribute('data-id', node.id.toString());
      }
    }

    const nodesWithPositions = this._getNodesWithPositionsFromHtml(g, flexContainer);

    return { ...g, nodes: nodesWithPositions };
  }

  /**
   * a simple layout for a collection of nodes without hierarchy.
   * tries to place nodes in a row or square-like layout based on their original ordering.
   *
   * e.g:
   * ```
   * row 1  |A B C| --> |A B|
   * row 2  | D   |     |C D|
   * ```
   *
   * primarily used for screenshots of draft generator nodes like twill, tabby, etc.
   * where the screenshots mainly have 1-4 examples of the components settings.
   *
   * examples with three or fewer nodes just use a single row, more than that and we go with square layouts.
   *
   * @returns a positioned layout graph for use in updating the real node positions
   */
  private _getSquareAndRowLayout(g: LayoutGraph): PositionedLayoutGraph {
    const nodeCount = Object.keys(g.nodes).length;


    // three or fewer nodes? single row, otherwise
    // find the square root so we know how many nodes
    // should go in each row in order to make the format
    // square-like
    // e.g: 4 -> 2x2, 4-9 -> 3x3, etc.
    const size = nodeCount < 4
      ? nodeCount
      : Math.ceil(Math.sqrt(nodeCount));

    // just use order of nodes from tree, which should be the order they were added in
    const orderedNodes = Object.values(g.nodes).filter(node => this.tree.nodes.findIndex(n => n.id === node.id) !== -1);

    // create CSS grid container with nodes in grid rows based on generations
    // ordered by original X positions and parent relationships
    const gridContainer = document.createElement('div');
    gridContainer.style.display = 'grid';
    gridContainer.style.position = 'absolute';
    gridContainer.style.top = '0';
    gridContainer.style.left = '0';
    gridContainer.style.padding = '200px';
    gridContainer.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    gridContainer.style.alignItems = 'start';
    gridContainer.style.rowGap = this.squareAndRowLayoutConfig.rowGap + 'px';
    gridContainer.style.columnGap = this.squareAndRowLayoutConfig.columnGap + 'px';
    gridContainer.style.justifyContent = this.squareAndRowLayoutConfig.justifyContent;

    for (let node of orderedNodes) {
      const nodeElt = document.createElement('div');
      gridContainer.appendChild(nodeElt);

      nodeElt.setAttribute('data-node', '');
      nodeElt.setAttribute('data-id', node.id.toString());
      nodeElt.style.width = node.width + 'px';
      nodeElt.style.height = node.height + 'px';
    }

    const nodesWithPositions = this._getNodesWithPositionsFromHtml(g, gridContainer);
    return { ...g, nodes: nodesWithPositions };
  }

  private _getNodesWithPositionsFromHtml(g: LayoutGraph, htmlElt: HTMLDivElement): Record<number, PositionedLayoutNode> {
    document.body.appendChild(htmlElt);

    // extract actual position data from DOM
    const nodesWithPositions = {};
    htmlElt.querySelectorAll('div[data-node]').forEach((elt: HTMLDivElement) => {
      const id: number = Number(elt.getAttribute('data-id'));
      const node = g.nodes[id];
      const x = elt.offsetLeft;
      const y = elt.offsetTop;
      nodesWithPositions[id] = { ...node, x, y };
    });

    htmlElt.remove();

    return nodesWithPositions;
  }

  /**
   * Merges multiple tree subgraphs into a single combined graph
   * TODO: Determine if we need to de-duplicate non-unique nodes and keep highest generation count
   */
  private _mergeSubgraphs(subgraphs: TreeNodeGraph[]): TreeNodeGraph {
    return subgraphs.reduce((acc, graph) => ({
      nodes: { ...acc.nodes, ...graph.nodes },
      edges: { ...acc.edges, ...graph.edges }
    }), { nodes: {}, edges: {} } as TreeNodeGraph);
  }

  // Connection nodes and subdrafts that are part of operators are ignored
  private _isLayoutable({ node }: TreeNode): boolean {
    return node.type !== "cxn"
      && this.tree.getSubdraftParent(node.id) === -1;
  }

  // Adds width and height from DOM measurements to each node.
  private _addDomSizeAndPositionData(graph: TreeNodeGraph): LayoutGraph {
    const nodesWithSize = Object.entries(graph.nodes).reduce((acc, [id, treeNode]) => {

      // Find the DOM element for this node
      const nodeElt = document.getElementById(`scale-${id}`);
      const numId = parseInt(id);

      return {
        ...acc, [numId]: {
          id: numId,
          width: nodeElt.offsetWidth,
          height: nodeElt.offsetHeight,
          originalX: nodeElt.offsetLeft,
          row: treeNode.generation
        }
      };
    }, {} as Record<number, LayoutNode>);

    return { ...graph, nodes: nodesWithSize };
  }

  /**
   * Recursively constructs a filtered graph from a tree node.
   * During traversal, non-layoutable nodes are filtered out and edges
   * are compressed to connect layoutable nodes directly.
   */
  private _constructGraph(node: TreeNode, generation: number = 0): TreeNodeGraph {

    const shouldInclude = this._isLayoutable(node);

    // Recursively process all children
    const nextGeneration = shouldInclude ? generation + 1 : generation;
    const childGraphs = node.outputs.map(output => this._constructGraph(output.tn, nextGeneration));

    // Merge all child graphs
    const mergedChildren = this._mergeSubgraphs(childGraphs);

    if (!shouldInclude) {
      // Skip this node, bubble up the merged children
      return mergedChildren;
    }

    // Include this node and create edges to all layoutable children
    const layoutableChildIds = Object.keys(mergedChildren.nodes).map(id => parseInt(id));
    const nodeWithGeneration = { ...node, generation };

    return {
      nodes: {
        ...mergedChildren.nodes,
        [node.node.id]: nodeWithGeneration
      },
      edges: {
        ...mergedChildren.edges,
        [node.node.id]: layoutableChildIds
      }
    };
  }

  private _sortGraphRows(g: LayoutGraph, unsortedRows: Array<Array<number>>): Array<Array<number>> {
    // internal function which recursively sorts the nodes in each row based on their original X position
    // and the nodes relationships to nodes in the previous row to avoid crossed-wires where possible
    const sortGraphRowsRecursive = (g: LayoutGraph, unsortedRows: Array<Array<number>>) => {
      if (unsortedRows.length === 0) {
        return [];
      }

      if (unsortedRows.length === 1) {
        return [this._sortRow(g, unsortedRows[0], undefined)];
      }

      const headRow = unsortedRows[0];
      const tailRows = unsortedRows.slice(1);
      const sortedRows = sortGraphRowsRecursive(g, tailRows);

      const sortedHeadRow = this._sortRow(g, headRow, sortedRows[0]);

      return [sortedHeadRow, ...sortedRows];
    };

    // the recursive function expects to process the first row last (at the bottom of the call stack)
    // so we have to do a reverse before and after calling it
    const reversed = [...unsortedRows].reverse();
    const result = sortGraphRowsRecursive(g, reversed).reverse();
    return result;
  }

  // Sorts nodes in provided row by their edges to sorted parent row, then by original X positions
  private _sortRow(g: LayoutGraph, row: Array<number>, sortedParentRow: Array<number> | undefined): Array<number> {
    const nodesWithSortData = row.map(id => ({
      id,
      avgParentPosition: this._getAvgParentPosition(g, sortedParentRow, id),
      originalX: g.nodes[id].originalX
    }));

    const sortedNodes = nodesWithSortData.sort((a, b) => {
      if (!a.avgParentPosition || !b.avgParentPosition) {
        return a.originalX - b.originalX;
      }

      return a.avgParentPosition - b.avgParentPosition || a.originalX - b.originalX;
    });

    return sortedNodes.map(sortedNode => sortedNode.id);
  }

  private _getAvgParentPosition(g: LayoutGraph, parentRow: Array<number> | undefined, nodeId: number): number | undefined {
    if (parentRow === undefined) {
      return undefined;
    }

    const isParent = (parentId: number, childId: number) => g.edges[parentId].includes(childId);
    const parentPositions = parentRow.map((parentId, i) => isParent(parentId, nodeId) ? i : undefined).filter(Boolean);
    if (parentPositions.length === 0) {
      // this should never happen
      return undefined;
    }
    const avgPosition = parentPositions.reduce((a, c) => a + c, 0) / parentPositions.length;
    return Number(avgPosition.toFixed(2));
  }
}
