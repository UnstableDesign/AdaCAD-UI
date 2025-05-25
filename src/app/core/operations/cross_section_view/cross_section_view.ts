import { Draft, NumParam, OpParamVal, OpInput, DynamicOperation, OperationInlet, CanvasParam } from "../../model/datatypes";
import { getOpParamValById, getAllDraftsAtInlet } from "../../model/operations";
import { Sequence } from "../../model/sequence";
import { initDraftFromDrawdown } from "../../model/drafts";
// p5 import is in the parameter component

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;

const name = "cross_section_view";
const old_names = [];
const dynamic_param_id = [1, 2, 3]; // Indices of num_warps, warp_systems, weft_systems;
const dynamic_param_type = 'null';

// Canvas parameter - stores canvas state and configuration for the sketch
const canvasParam: CanvasParam = {
    name: 'cross_section_canvas',
    type: 'p5-canvas',
    value: {}, // canvasState
    dx: 'Interactive canvas for drawing cross-section paths.'
};

// Define parameters that users can configure
const warp_systems_param: NumParam = {
    name: 'Warp Systems',
    type: 'number',
    min: 1,
    max: 10,
    value: 2,
    dx: "Number of distinct warp systems or layers for interaction."
};

const weft_systems_param: NumParam = {
    name: 'Weft Systems',
    type: 'number',
    min: 1,
    max: 10,
    value: 5,
    dx: "Number of weft systems/colors available for drawing paths."
};

const num_warps_param: NumParam = {
    name: 'Number of Warps',
    type: 'number',
    min: 1,
    max: 16,
    value: 8,
    dx: "Number of warps (width) in the cross section draft"
};

const params = [canvasParam, warp_systems_param, weft_systems_param, num_warps_param];
const paramIds = { canvasState: 0, warpSystems: 1, weftSystems: 2, numWarps: 3 };

const inlets = [];

// Main perform function
const perform = (op_params: Array<OpParamVal>, op_inputs: Array<OpInput>) => {
    // Retrieve the op_params values
    const canvasStateOpParam: any = getOpParamValById(paramIds.canvasState, op_params);
    const warpSystemsOpParam: number = getOpParamValById(paramIds.warpSystems, op_params);
    const weftSystemsOpParam: number = getOpParamValById(paramIds.weftSystems, op_params);
    const numWarpsOpParam: number = getOpParamValById(paramIds.numWarps, op_params);

    // Step 1: Data Preparation
    // 1.1: Validate Input Params
    // Check if canvasStateOpParam and other numeric params are valid.
    if (
        !canvasStateOpParam ||
        typeof canvasStateOpParam !== 'object' ||
        Array.isArray(canvasStateOpParam) ||
        !canvasStateOpParam.hasOwnProperty('warpData') || // Ensure warpData exists
        typeof numWarpsOpParam !== 'number' ||
        typeof warpSystemsOpParam !== 'number' ||
        typeof weftSystemsOpParam !== 'number'
    ) {
        // Invalid op_params in perform(), likely first run of op. Returning default empty draft.
        const emptyPattern = new Sequence.TwoD();
        emptyPattern.pushWeftSequence(new Sequence.OneD([0]).val()); // 1x1 white cell
        return Promise.resolve([initDraftFromDrawdown(emptyPattern.export())]);
    }

    const numWarps: number = numWarpsOpParam;
    const warpData: Array<{ warpSys: number, topWeft: Array<{ weft: number, sequence: number, pathId: number }>, bottomWeft: Array<{ weft: number, sequence: number, pathId: number }> }> = canvasStateOpParam.warpData || [];

    // 1.2: Create allInteractions List
    const allInteractions: Array<{
        weftId: number,
        sequence: number,
        pathId: number,
        warpIdx: number,
        isTopInteraction: boolean,
        originalWarpSys: number
    }> = [];

    if (warpData) {
        warpData.forEach((warp_column_data, current_warp_idx) => {
            if (warp_column_data.topWeft) {
                warp_column_data.topWeft.forEach(entry => {
                    allInteractions.push({
                        weftId: entry.weft,
                        sequence: entry.sequence,
                        pathId: entry.pathId,
                        warpIdx: current_warp_idx,
                        isTopInteraction: true,
                        originalWarpSys: warp_column_data.warpSys
                    });
                });
            }
            if (warp_column_data.bottomWeft) {
                warp_column_data.bottomWeft.forEach(entry => {
                    allInteractions.push({
                        weftId: entry.weft,
                        sequence: entry.sequence,
                        pathId: entry.pathId,
                        warpIdx: current_warp_idx,
                        isTopInteraction: false,
                        originalWarpSys: warp_column_data.warpSys
                    });
                });
            }
        });
    }

    // Handle Empty Interactions: If allInteractions is empty, return a default blank draft.
    if (allInteractions.length === 0) {
        let pattern = new Sequence.TwoD();
        let row = new Sequence.OneD();
        const currentNumWarps = numWarps > 0 ? numWarps : 1;
        row.pushMultiple(0, currentNumWarps);
        pattern.pushWeftSequence(row.val());
        let d = initDraftFromDrawdown(pattern.export());

        // Setup a blank slate colSystemMapping.
        d.colSystemMapping = [];
        const currentWarpSystems = warpSystemsOpParam > 0 ? warpSystemsOpParam : 1;
        for (let i = 0; i < currentNumWarps; i++) {
            d.colSystemMapping.push(i % currentWarpSystems);
        }

        d.rowSystemMapping = [0];
        d.colShuttleMapping = Array(currentNumWarps).fill(0);
        d.rowShuttleMapping = [0];
        d.gen_name = `cross section ${currentNumWarps}x${d.drawdown.length} (blank)`; // Update height for gen_name
        return Promise.resolve([d]);
    }

    // 1.3: Sort allInteractions
    allInteractions.sort((a, b) => {
        if (a.pathId !== b.pathId) {
            return a.pathId - b.pathId;
        }
        return a.sequence - b.sequence;
    });

    // Step 2: Identify weftPasses (Logical Draft Rows)
    const weftPasses: Array<{
        weftId: number,
        interactions: Array<typeof allInteractions[0]>,
        impliedTravelWarpSys: number
    }> = [];

    if (allInteractions.length > 0) {
        let currentPassInteractions: Array<typeof allInteractions[0]> = [];
        let currentWarpIdxTrend: 'increasing' | 'decreasing' | 'stationary' | 'none' = 'none';

        for (let i = 0; i < allInteractions.length; i++) {
            const currentInteraction = allInteractions[i];
            const prevInteraction = i > 0 ? allInteractions[i - 1] : null;

            let startNewPass = false;

            // Rule 1: Change in pathId
            if (prevInteraction && currentInteraction.pathId !== prevInteraction.pathId) {
                startNewPass = true;
            }
            // Rule 2: Sequential Top/Bottom Interaction on the Same Warp
            else if (prevInteraction &&
                currentInteraction.pathId === prevInteraction.pathId &&
                currentInteraction.weftId === prevInteraction.weftId &&
                currentInteraction.warpIdx === prevInteraction.warpIdx &&
                currentInteraction.isTopInteraction !== prevInteraction.isTopInteraction &&
                currentInteraction.sequence === prevInteraction.sequence + 1) {
                startNewPass = true;
            }
            // Rule 3: "Turn" Detection by warpIdx Trend Reversal
            else if (prevInteraction && currentPassInteractions.length > 0 && // Ensure there's a pass to evaluate trend against
                currentInteraction.pathId === prevInteraction.pathId &&
                currentInteraction.weftId === prevInteraction.weftId) {

                const lastInteractionInCurrentPass = currentPassInteractions[currentPassInteractions.length - 1];
                let newTrend: 'increasing' | 'decreasing' | 'stationary' = 'stationary';

                if (currentInteraction.warpIdx > lastInteractionInCurrentPass.warpIdx) {
                    newTrend = 'increasing';
                } else if (currentInteraction.warpIdx < lastInteractionInCurrentPass.warpIdx) {
                    newTrend = 'decreasing';
                }

                if (currentPassInteractions.length === 1 && lastInteractionInCurrentPass.warpIdx !== currentInteraction.warpIdx) {
                    // First segment of a pass, establish initial trend
                    currentWarpIdxTrend = newTrend;
                } else if (currentWarpIdxTrend !== 'none' && currentWarpIdxTrend !== 'stationary' && newTrend !== 'stationary' && currentWarpIdxTrend !== newTrend) {
                    // Trend has reversed from increasing to decreasing or vice-versa
                    startNewPass = true;
                }
            }

            if (startNewPass && currentPassInteractions.length > 0) {
                weftPasses.push({
                    weftId: currentPassInteractions[0].weftId,
                    interactions: [...currentPassInteractions],
                    impliedTravelWarpSys: currentPassInteractions[0].originalWarpSys
                });
                currentPassInteractions = [];
                currentWarpIdxTrend = 'none'; // Reset trend for the new pass
            }

            currentPassInteractions.push(currentInteraction);

            // Update trend if this is the first interaction of a potentially new pass or if pass continues
            if (currentPassInteractions.length === 1) {
                // Initial interaction of a pass doesn't define a trend yet unless there's a next one to compare
            } else if (currentPassInteractions.length > 1) {
                const firstInPass = currentPassInteractions[0];
                const lastInPass = currentPassInteractions[currentPassInteractions.length - 1]; // this is currentInteraction
                if (lastInPass.warpIdx > firstInPass.warpIdx) {
                    currentWarpIdxTrend = 'increasing';
                } else if (lastInPass.warpIdx < firstInPass.warpIdx) {
                    currentWarpIdxTrend = 'decreasing';
                } else {
                    // If multiple interactions on the same warp, check against the last *different* warpIdx if possible
                    // For simplicity, if subsequent points are on the same warp as the first point, trend is stationary for now
                    // A more robust trend detection might look back further for the last different warpIdx.
                    let trendAnchor = firstInPass;
                    for (let k = currentPassInteractions.length - 2; k >= 0; k--) {
                        if (currentPassInteractions[k].warpIdx !== lastInPass.warpIdx) {
                            trendAnchor = currentPassInteractions[k];
                            break;
                        }
                    }
                    if (lastInPass.warpIdx > trendAnchor.warpIdx) currentWarpIdxTrend = 'increasing';
                    else if (lastInPass.warpIdx < trendAnchor.warpIdx) currentWarpIdxTrend = 'decreasing';
                    else currentWarpIdxTrend = 'stationary';
                }
            }
        }

        // Add the last pass if any interactions are pending
        if (currentPassInteractions.length > 0) {
            weftPasses.push({
                weftId: currentPassInteractions[0].weftId,
                interactions: [...currentPassInteractions],
                impliedTravelWarpSys: currentPassInteractions[0].originalWarpSys
            });
        }
    }

    // Step 3: Generate Draft Rows from weftPasses
    const pattern = new Sequence.TwoD();
    const rowSystemMappingArray: Array<number> = [];

    if (warpData && warpData.length > 0) { // Ensure warpData is available for targetCellWarpSys
        weftPasses.forEach(weftPass => {
            const currentRow = new Sequence.OneD();
            const travelWarpSys = weftPass.impliedTravelWarpSys;
            const currentPassWeftId = weftPass.weftId;

            // As per plan clarification 3.4: Initialize rowSystemMappingArray before the loop, then add currentPassWeftId.
            // This was already done by declaring rowSystemMappingArray outside this loop.
            // For Issue 2 Fix: Prepend to keep mapping in sync with draft rows
            rowSystemMappingArray.unshift(currentPassWeftId);

            for (let j = 0; j < numWarps; j++) {
                let cellState = 0; // Rule 3.5.1: Initialize cellState = 0 (WHITE)
                const targetCellWarpSys = warpData[j] ? warpData[j].warpSys : 0; // Default to 0 if somehow warpData[j] is undefined

                // Rule 3.5.2: Direct Interaction Check
                const interactionAtWarpJ = weftPass.interactions.find(I => I.warpIdx === j);
                if (interactionAtWarpJ) {
                    if (interactionAtWarpJ.isTopInteraction) { // Weft drawn OVER this warp
                        cellState = 0; // WHITE
                    } else { // Weft drawn UNDER this warp
                        cellState = 1; // BLACK
                    }
                }

                // Rule 3.5.3: Multi-Warp Lifting Rule
                if (travelWarpSys !== 0 && targetCellWarpSys < travelWarpSys) {
                    cellState = 1; // BLACK (override)
                }

                currentRow.push(cellState);
            }
            // For Issue 2 Fix: Prepend row to make it the top row
            pattern.unshiftWeftSequence(currentRow.val());
        });
    }

    // Handle case where no weftPasses were generated but allInteractions was not empty
    // (e.g. only single point interactions not forming a pass by current rules)
    // Or if warpData was empty/invalid for cell logic.
    // This ensures a valid, if perhaps empty or minimal, draft is created.
    if (pattern.wefts() === 0) {
        let row = new Sequence.OneD();
        const currentNumWarpsFallback = numWarps > 0 ? numWarps : 1;
        row.pushMultiple(0, currentNumWarpsFallback);
        pattern.pushWeftSequence(row.val()); // Single row, push or unshift is fine.
        // If rowSystemMappingArray is empty because no passes, add a default
        if (rowSystemMappingArray.length === 0) {
            rowSystemMappingArray.push(0); // Or unshift(0) if consistency is desired, though for one row it's same.
        }
    }

    // Step 4: Finalize Draft Object
    const finalPatternExport = pattern.export();
    let d = initDraftFromDrawdown(finalPatternExport);

    // 4.2: Populate System Mappings
    if (numWarps > 0 && warpData && warpData.length === numWarps) {
        d.colSystemMapping = warpData.map(wd => wd.warpSys);
    } else {
        // Fallback if warpData is not as expected
        d.colSystemMapping = Array(numWarps > 0 ? numWarps : 1).fill(0);
    }
    // Ensure rowSystemMappingArray is not empty before assigning
    d.rowSystemMapping = rowSystemMappingArray.length > 0 ? rowSystemMappingArray : [0];

    // 4.3: Populate Shuttle Mappings (Default)
    d.colShuttleMapping = Array(d.drawdown[0] ? d.drawdown[0].length : (numWarps > 0 ? numWarps : 1)).fill(0);
    d.rowShuttleMapping = Array(d.drawdown.length > 0 ? d.drawdown.length : 1).fill(0);

    // gen_name will be updated by generateName function, but set a temporary one if needed for debugging before that runs.
    // d.gen_name = `cross section ${d.drawdown[0] ? d.drawdown[0].length : 0}x${d.drawdown.length}`; 

    // 4.4: Return Promise.resolve([d])
    return Promise.resolve([d]);
};

// Generate a meaningful name for the operation result
const generateName = (param_vals: Array<OpParamVal>, op_inputs: Array<OpInput>): string => {
    const num_warps_val: number = getOpParamValById(paramIds.numWarps, param_vals);
    return 'cross section ' + num_warps_val + 'x1';
};

const onParamChange = (param_vals: Array<OpParamVal>, inlets: Array<OperationInlet>, inlet_vals: Array<any>, changed_param_id: number, changed_param_single_value: any): Array<any> => {
    return inlet_vals; // Return unmodified inlets as per standard dynamic op requirements
};

// p5.js sketch creator function
const createSketch = (op_params: Array<OpParamVal>, updateCallback: Function) => {
    // Retrieve the op_params values
    const canvasStateOpParam: any = getOpParamValById(paramIds.canvasState, op_params);
    const warpSystemsOpParam: number = getOpParamValById(paramIds.warpSystems, op_params);
    const weftSystemsOpParam: number = getOpParamValById(paramIds.weftSystems, op_params);
    const numWarpsOpParam: number = getOpParamValById(paramIds.numWarps, op_params);

    // Helper function to setup canvasState correctly in a AdaCAD p5-canvas operation
    function loadCanvasState(DEFAULT_CANVAS_STATE: object) {
        let canvasState: any;
        if (!canvasStateOpParam || Object.keys(canvasStateOpParam).length === 0) {
            // First createSketch run, use default canvas state
            canvasState = JSON.parse(JSON.stringify(DEFAULT_CANVAS_STATE));
            updateCallback(canvasState);
        } else {
            // Subsequent createSketch run (after a param change), use current canvas state
            canvasState = canvasStateOpParam;
        }
        return canvasState;
    }

    return (p: any) => {
        // UI Variables
        let warpSystems = warpSystemsOpParam;
        let weftSystems = weftSystemsOpParam;
        let numWarps = numWarpsOpParam;

        let resetButton;

        // -- Constants
        const ACCESSIBLE_COLORS = [
            "#F4A7B9", "#A7C7E7", "#C6E2E9", "#FAD6A5", "#D5AAFF", "#B0E57C",
            "#FFD700", "#FFB347", "#87CEFA", "#E6E6FA", "#FFE4E1", "#C1F0F6"
        ];
        const SKETCH_TOP_MARGIN = 60;
        const SKETCH_LEFT_MARGIN = 60;
        const SKETCH_BOTTOM_MARGIN = 20;
        const SKETCH_CANVAS_WIDTH = CANVAS_WIDTH;
        const SKETCH_CANVAS_HEIGHT = CANVAS_HEIGHT;

        const DEFAULT_CANVAS_STATE = {
            warpDots: [],
            selectedDots: [],
            dotFills: [],
            activeWeft: null,
            currentSpline: [],
            permanentSplines: [],
            warpData: [],
            clickSequence: 0,
            currentPathId: 0,
            hoveredDotIndex: -1,
            showDeleteButton: false,
            deleteButtonBounds: null
        };

        // -- canvasState Variables
        // Canvas State
        let canvasState = loadCanvasState(DEFAULT_CANVAS_STATE);

        function resetCanvas() {
            // Reset variables to default values
            canvasState = JSON.parse(JSON.stringify(DEFAULT_CANVAS_STATE));

            // Initialize warpData
            canvasState.warpData = [];
            canvasState.clickSequence = 0;
            for (let i = 0; i < numWarps; i++) {
                canvasState.warpData.push({
                    warpSys: i % warpSystems,
                    topWeft: [],
                    bottomWeft: []
                });
            }

            // Report the new canvasState to the operation
            updateCallback(canvasState);

            // Redraw canvas
            p.redraw();
        }

        p.setup = function setup() {
            p.createCanvas(SKETCH_CANVAS_WIDTH, SKETCH_CANVAS_HEIGHT);
            p.textSize(14);

            // Reset canvas to default values
            resetCanvas();

            // Create UI elements
            resetButton = p.createButton("Reset").position(30, 180).mousePressed(resetCanvas).style('font-size', '16px');

            // Start the sketch in noLoop mode
            p.noLoop();
        };

        p.draw = function draw() {
            p.background(255);
            drawWarpLines();
            drawWeftDots();
            drawWarpDots();
            drawPermanentSplines();
            drawStickySpline();
            drawDeleteButton();
        };

        function drawWarpLines() {
            let spacingX = (SKETCH_CANVAS_WIDTH - SKETCH_LEFT_MARGIN) / (numWarps + 1);
            let spacingY = (SKETCH_CANVAS_HEIGHT - SKETCH_TOP_MARGIN - SKETCH_BOTTOM_MARGIN) / (warpSystems + 1);
            canvasState.warpDots = [];

            for (let i = 0; i < numWarps; i++) {
                let x = SKETCH_LEFT_MARGIN + spacingX * (i + 1);
                p.stroke(0);
                p.strokeWeight(1);
                p.line(x, SKETCH_TOP_MARGIN, x, SKETCH_CANVAS_HEIGHT - SKETCH_BOTTOM_MARGIN);

                let warpRow = i % warpSystems;
                let y = SKETCH_TOP_MARGIN + spacingY * (warpRow + 1);

                canvasState.warpDots.push({ x: x, y: y - 20 });

                canvasState.dotFills.push([]);
                canvasState.warpDots.push({ x: x, y: y + 20 });
                canvasState.dotFills.push([]);

                p.noStroke();
                p.fill(50);
                p.ellipse(x, y, 18, 18);
            }
        }

        function drawWeftDots() {
            let spacing = (SKETCH_CANVAS_HEIGHT - SKETCH_TOP_MARGIN - SKETCH_BOTTOM_MARGIN) / (weftSystems + 1);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(16);
            for (let i = 0; i < weftSystems; i++) {
                let y = SKETCH_TOP_MARGIN + spacing * (i + 1);
                let weftColor = ACCESSIBLE_COLORS[i % ACCESSIBLE_COLORS.length];

                p.fill(weftColor);
                p.stroke(canvasState.activeWeft === i ? 80 : 200);
                p.strokeWeight(canvasState.activeWeft === i ? 2 : 1);
                p.ellipse(SKETCH_LEFT_MARGIN / 2, y, 24, 24);

                p.fill(0);
                p.noStroke();
                p.text(String.fromCharCode(97 + i), SKETCH_LEFT_MARGIN / 2, y);
            }
        }

        function drawWarpDots() {
            for (let i = 0; i < canvasState.warpDots.length; i++) {
                let dot = canvasState.warpDots[i];

                if (canvasState.selectedDots.includes(i) && canvasState.dotFills[i].length > 0) {
                    p.fill(ACCESSIBLE_COLORS[canvasState.dotFills[i][0] % ACCESSIBLE_COLORS.length]);
                    p.stroke(0);
                } else {
                    p.fill(255);
                    p.stroke(180);
                }
                p.strokeWeight(1);
                p.ellipse(dot.x, dot.y, 12, 12);

                for (let r = 1; r < canvasState.dotFills[i].length; r++) {
                    p.noFill();
                    p.stroke(ACCESSIBLE_COLORS[canvasState.dotFills[i][r] % ACCESSIBLE_COLORS.length]);
                    p.strokeWeight(2);
                    p.ellipse(dot.x, dot.y, 14 + r * 4, 14 + r * 4);
                }
            }
        }

        function drawPermanentSplines() {
            for (let spline of canvasState.permanentSplines) {
                p.stroke(ACCESSIBLE_COLORS[spline.weft % ACCESSIBLE_COLORS.length]);
                p.strokeWeight(3);
                p.noFill();

                let points = [];

                for (let i = 0; i < spline.dots.length; i++) {
                    let dot = canvasState.warpDots[spline.dots[i]];
                    points.push({ x: dot.x, y: dot.y });

                    if (i > 0 && i < spline.dots.length - 1) {
                        let prevDot = canvasState.warpDots[spline.dots[i - 1]];
                        let nextDot = canvasState.warpDots[spline.dots[i + 1]];

                        let prevDirection = dot.x - prevDot.x;
                        let nextDirection = nextDot.x - dot.x;

                        // Add a slight outward offset if direction reverses
                        if ((prevDirection > 0 && nextDirection < 0) || (prevDirection < 0 && nextDirection > 0)) {
                            let offsetX = prevDirection > 0 ? 20 : -20;
                            let midY = (prevDot.y + nextDot.y) / 2;
                            points.push({ x: dot.x + offsetX, y: midY });
                        }
                    }
                }

                if (points.length < 3) {
                    for (let j = 0; j < points.length - 1; j++) {
                        p.line(points[j].x, points[j].y, points[j + 1].x, points[j + 1].y);
                    }
                } else {
                    p.beginShape();
                    p.curveVertex(points[0].x, points[0].y);
                    for (let pt of points) {
                        p.curveVertex(pt.x, pt.y);
                    }
                    p.curveVertex(points[points.length - 1].x, points[points.length - 1].y);
                    p.endShape();
                }
            }
        }

        function drawStickySpline() {
            if (canvasState.currentSpline.length > 0 && canvasState.activeWeft !== null) {
                let lastDot = canvasState.warpDots[canvasState.currentSpline[canvasState.currentSpline.length - 1]];
                p.stroke(ACCESSIBLE_COLORS[canvasState.activeWeft % ACCESSIBLE_COLORS.length]);
                p.strokeWeight(2);
                p.line(lastDot.x, lastDot.y, p.mouseX, p.mouseY);
            }
        }

        function drawDeleteButton() {
            if (canvasState.showDeleteButton && canvasState.hoveredDotIndex >= 0 && canvasState.deleteButtonBounds) {
                // Draw delete button background
                p.fill(255, 100, 100);
                p.stroke(200, 50, 50);
                p.strokeWeight(1);
                p.rect(canvasState.deleteButtonBounds.x, canvasState.deleteButtonBounds.y, canvasState.deleteButtonBounds.w, canvasState.deleteButtonBounds.h, 2);

                // Draw X
                p.stroke(255);
                p.strokeWeight(2);
                let padding = 3;
                p.line(
                    canvasState.deleteButtonBounds.x + padding,
                    canvasState.deleteButtonBounds.y + padding,
                    canvasState.deleteButtonBounds.x + canvasState.deleteButtonBounds.w - padding,
                    canvasState.deleteButtonBounds.y + canvasState.deleteButtonBounds.h - padding
                );
                p.line(
                    canvasState.deleteButtonBounds.x + canvasState.deleteButtonBounds.w - padding,
                    canvasState.deleteButtonBounds.y + padding,
                    canvasState.deleteButtonBounds.x + padding,
                    canvasState.deleteButtonBounds.y + canvasState.deleteButtonBounds.h - padding
                );
            }
        }

        p.mouseMoved = function mouseMoved() {
            let previousHoveredDot = canvasState.hoveredDotIndex;
            let previousShowDelete = canvasState.showDeleteButton;

            // First check if we're hovering over the delete button itself
            if (canvasState.deleteButtonBounds &&
                p.mouseX >= canvasState.deleteButtonBounds.x - 2 && p.mouseX <= canvasState.deleteButtonBounds.x + canvasState.deleteButtonBounds.w + 2 &&
                p.mouseY >= canvasState.deleteButtonBounds.y - 2 && p.mouseY <= canvasState.deleteButtonBounds.y + canvasState.deleteButtonBounds.h + 2) {
                // Keep the delete button visible when hovering over it
                p.cursor(p.HAND);
                return;
            }

            canvasState.hoveredDotIndex = -1;
            canvasState.showDeleteButton = false;
            canvasState.deleteButtonBounds = null;

            // Check if hovering over any dot
            for (let i = 0; i < canvasState.warpDots.length; i++) {
                let dot = canvasState.warpDots[i];
                if (p.dist(p.mouseX, p.mouseY, dot.x, dot.y) < 10) {
                    canvasState.hoveredDotIndex = i;

                    // Only show delete button if:
                    // 1. No active weft is selected (not actively drawing)
                    // 2. The dot has at least one weft assigned
                    if (canvasState.activeWeft === null && canvasState.dotFills[i].length > 0) {
                        canvasState.showDeleteButton = true;
                        // Position delete button to the top-right of the dot
                        canvasState.deleteButtonBounds = {
                            x: dot.x + 8,
                            y: dot.y - 18,
                            w: 16,
                            h: 16
                        };
                    }
                    break;
                }
            }

            // Redraw if hover state changed
            if (previousHoveredDot !== canvasState.hoveredDotIndex || previousShowDelete !== canvasState.showDeleteButton) {
                p.redraw();
            }

            // Update cursor
            if (canvasState.showDeleteButton && canvasState.deleteButtonBounds &&
                p.mouseX >= canvasState.deleteButtonBounds.x && p.mouseX <= canvasState.deleteButtonBounds.x + canvasState.deleteButtonBounds.w &&
                p.mouseY >= canvasState.deleteButtonBounds.y && p.mouseY <= canvasState.deleteButtonBounds.y + canvasState.deleteButtonBounds.h) {
                p.cursor(p.HAND);
            } else if (canvasState.hoveredDotIndex >= 0) {
                p.cursor(p.HAND);
            } else {
                p.cursor(p.ARROW);
            }
        }

        p.mousePressed = function mousePressed() {
            let clicked = false;
            let spacing = (SKETCH_CANVAS_HEIGHT - SKETCH_TOP_MARGIN - SKETCH_BOTTOM_MARGIN) / (weftSystems + 1);

            // Check weft system clicks
            for (let i = 0; i < weftSystems; i++) {
                let y = SKETCH_TOP_MARGIN + spacing * (i + 1);
                if (p.dist(p.mouseX, p.mouseY, SKETCH_LEFT_MARGIN / 2, y) < 12) {
                    if (canvasState.activeWeft === i) {
                        canvasState.currentSpline = [];
                        canvasState.activeWeft = null;
                        p.noLoop();
                    } else {
                        canvasState.activeWeft = i;
                        canvasState.currentSpline = [];
                        p.loop();
                    }
                    clicked = true;
                    p.redraw();
                    // Report the new canvasState to the operation
                    updateCallback(canvasState);
                    return;
                }
            }

            // Check delete button click
            if (canvasState.showDeleteButton && canvasState.deleteButtonBounds && canvasState.activeWeft === null) {
                if (p.mouseX >= canvasState.deleteButtonBounds.x && p.mouseX <= canvasState.deleteButtonBounds.x + canvasState.deleteButtonBounds.w &&
                    p.mouseY >= canvasState.deleteButtonBounds.y && p.mouseY <= canvasState.deleteButtonBounds.y + canvasState.deleteButtonBounds.h) {
                    // Delete the most recent weft from the hovered dot
                    let i = canvasState.hoveredDotIndex;
                    const { warpIdx, isTop } = getDotInfo(i);
                    const weftArray = isTop ? canvasState.warpData[warpIdx].topWeft : canvasState.warpData[warpIdx].bottomWeft;

                    // Find the most recent weft assignment (highest sequence number)
                    let mostRecentWeft = -1;
                    let mostRecentIndex = -1;
                    let highestSequence = -1;

                    for (let j = 0; j < weftArray.length; j++) {
                        if (weftArray[j].sequence > highestSequence) {
                            highestSequence = weftArray[j].sequence;
                            mostRecentIndex = j;
                            mostRecentWeft = weftArray[j].weft;
                        }
                    }

                    if (mostRecentIndex !== -1) {
                        // Remove from dotFills
                        const weftToRemove = mostRecentWeft;
                        const weftIndex = canvasState.dotFills[i].indexOf(weftToRemove);
                        if (weftIndex !== -1) {
                            canvasState.dotFills[i].splice(weftIndex, 1);
                        }

                        if (canvasState.dotFills[i].length === 0) {
                            canvasState.dotFills[i] = [];
                            canvasState.selectedDots = canvasState.selectedDots.filter(idx => idx !== i);
                        }

                        // Remove from warpData
                        const removedSequence = weftArray[mostRecentIndex].sequence;
                        weftArray.splice(mostRecentIndex, 1);
                        updateSequenceNumbers(removedSequence);

                        // Update splines
                        canvasState.permanentSplines = canvasState.permanentSplines.map(spline => {
                            if (spline.weft === weftToRemove) {
                                return { ...spline, dots: spline.dots.filter(idx => idx !== i) };
                            }
                            return spline;
                        }).filter(spline => spline.dots.length >= 2);

                        // console.log(`Deleted weft ${weftToRemove} from dot ${i}, updated warpData:`, JSON.parse(JSON.stringify(canvasState.warpData)));
                    }

                    // Reset hover state
                    canvasState.showDeleteButton = false;
                    canvasState.hoveredDotIndex = -1;
                    canvasState.deleteButtonBounds = null;

                    p.redraw();
                    // Report the new canvasState to the operation
                    updateCallback(canvasState);
                    return;
                }
            }

            if (canvasState.activeWeft !== null) {
                for (let i = 0; i < canvasState.warpDots.length; i++) {
                    let dot = canvasState.warpDots[i];
                    if (p.dist(p.mouseX, p.mouseY, dot.x, dot.y) < 10) {
                        // Get warp index and whether it's a top or bottom dot
                        const { warpIdx, isTop } = getDotInfo(i);
                        const weftArray = isTop ? canvasState.warpData[warpIdx].topWeft : canvasState.warpData[warpIdx].bottomWeft;

                        // Check if this dot has the active weft assigned
                        if (canvasState.selectedDots.includes(i) && canvasState.dotFills[i].includes(canvasState.activeWeft)) {
                            // Resume drawing from this dot
                            canvasState.currentSpline = [i];
                            p.loop();
                            // console.log(`Resuming drawing from dot ${i} with weft ${canvasState.activeWeft}`);
                            p.redraw();
                            // Report the new canvasState to the operation
                            updateCallback(canvasState);
                            return;
                        }

                        // Add new weft assignment
                        if (!canvasState.selectedDots.includes(i)) {
                            canvasState.selectedDots.push(i);
                            canvasState.dotFills[i] = [canvasState.activeWeft];

                            weftArray.push({ weft: canvasState.activeWeft, sequence: canvasState.clickSequence });
                            canvasState.clickSequence++;

                        } else if (!canvasState.dotFills[i].includes(canvasState.activeWeft)) {
                            canvasState.dotFills[i].push(canvasState.activeWeft);

                            weftArray.push({ weft: canvasState.activeWeft, sequence: canvasState.clickSequence });
                            canvasState.clickSequence++;

                        } else if (canvasState.dotFills[i].includes(canvasState.activeWeft) && canvasState.currentSpline.length === 0) {
                            canvasState.currentSpline = [i];
                            p.loop();
                            p.redraw();
                            // Report the new canvasState to the operation
                            updateCallback(canvasState);
                            return;
                        }

                        if (canvasState.currentSpline.length > 0) {
                            let prev = canvasState.currentSpline[canvasState.currentSpline.length - 1];
                            if (
                                canvasState.permanentSplines.length === 0 ||
                                canvasState.permanentSplines[canvasState.permanentSplines.length - 1].weft !== canvasState.activeWeft ||
                                canvasState.permanentSplines[canvasState.permanentSplines.length - 1].closed
                            ) {
                                canvasState.permanentSplines.push({ weft: canvasState.activeWeft, dots: [prev, i], closed: false });
                            } else {
                                canvasState.permanentSplines[canvasState.permanentSplines.length - 1].dots.push(i);
                            }
                        }

                        if (canvasState.currentSpline.length > 0 && canvasState.currentSpline[0] === i) {
                            canvasState.permanentSplines[canvasState.permanentSplines.length - 1].dots.push(i);
                            canvasState.permanentSplines[canvasState.permanentSplines.length - 1].closed = true;
                            canvasState.currentSpline = [];
                            canvasState.activeWeft = null;
                            p.noLoop();
                        } else {
                            canvasState.currentSpline.push(i);
                        }

                        p.redraw();
                        // Report the new canvasState to the operation
                        updateCallback(canvasState);
                        return;
                    }
                }
            }

            // Clicks outside of any dots
            if (!clicked && canvasState.activeWeft !== null) {
                canvasState.currentSpline = [];
                canvasState.activeWeft = null;
                p.noLoop();
                p.redraw();
                // Report the new canvasState to the operation
                updateCallback(canvasState);
            }
        }

        // Helper Functions //
        function updateSequenceNumbers(removedSequence: number) {
            // Update all sequence numbers in warpData
            for (let warp of canvasState.warpData) {
                // Process top wefts
                for (let assignment of warp.topWeft) {
                    if (assignment.sequence > removedSequence) {
                        assignment.sequence--;
                    }
                }

                // Process bottom wefts
                for (let assignment of warp.bottomWeft) {
                    if (assignment.sequence > removedSequence) {
                        assignment.sequence--;
                    }
                }
            }

            // Decrement the global counter
            canvasState.clickSequence--;
        }

        function getDotInfo(dotIndex: number) {
            return {
                warpIdx: Math.floor(dotIndex / 2),
                isTop: dotIndex % 2 === 0
            };
        }
    };
};

// Export the operation object as a DynamicOperation
export const cross_section_view: DynamicOperation = {
    name,
    old_names,
    params,
    inlets,
    perform,
    generateName,
    // Required properties for DynamicOperation
    dynamic_param_id,
    dynamic_param_type,
    onParamChange,
    createSketch
};