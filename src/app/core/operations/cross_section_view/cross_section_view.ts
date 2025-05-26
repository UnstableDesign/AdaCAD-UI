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
    // --- .perform() converts the generic draft object from createSketchto an AdaCAD draft object

    // Retrieve the op_params values
    const canvasStateOpParam: any = getOpParamValById(paramIds.canvasState, op_params);
    const warpSystemsOpParam: number = getOpParamValById(paramIds.warpSystems, op_params);
    // const weftSystemsOpParam: number = getOpParamValById(paramIds.weftSystems, op_params);
    const numWarpsOpParam: number = getOpParamValById(paramIds.numWarps, op_params);

    // Step 1: Validate Input Params
    // Check if generic draft from canvasStateOpParam, and other params, are valid
    let genericDraftData;
    if (
        !canvasStateOpParam ||
        typeof canvasStateOpParam !== 'object' ||
        Array.isArray(canvasStateOpParam) ||
        !canvasStateOpParam.generatedDraft ||
        typeof canvasStateOpParam.generatedDraft !== 'object' ||
        !Array.isArray(canvasStateOpParam.generatedDraft.rows) ||
        !Array.isArray(canvasStateOpParam.generatedDraft.colSystemMapping)
    ) {
        // Invalid canvasState or generatedDraft structure. Return a default empty/blank AdaCAD Draft
        // This handles very first run before createSketch populates
        const numWarpsForBlank = numWarpsOpParam > 0 ? numWarpsOpParam : 1;
        const emptyPattern = new Sequence.TwoD();
        emptyPattern.pushWeftSequence(new Sequence.OneD(Array(numWarpsForBlank).fill(0)).val());
        let d = initDraftFromDrawdown(emptyPattern.export());

        // Setup blank slate colSystemMapping based on params
        d.colSystemMapping = [];
        const warpSysForBlank = warpSystemsOpParam > 0 ? warpSystemsOpParam : 1;
        for (let i = 0; i < numWarpsForBlank; i++) {
            d.colSystemMapping.push(i % warpSysForBlank);
        }
        d.rowSystemMapping = [0];
        d.colShuttleMapping = Array(numWarpsForBlank).fill(0);
        d.rowShuttleMapping = [0];
        return Promise.resolve([d]);
    }

    genericDraftData = canvasStateOpParam.generatedDraft;

    // Step 2: Create Draft object using genericDraftData
    const pattern = new Sequence.TwoD();
    const rowSystemMappingArray: Array<number> = [];
    const rowShuttleMappingArray: Array<number> = [];

    if (genericDraftData.rows.length > 0) {
        const resolvedMaterialIds = genericDraftData.resolvedSketchMaterialIds || [];
        genericDraftData.rows.forEach(genericRow => {
            // AdaCAD draft rows are top-first, so prepend to pattern
            pattern.unshiftWeftSequence(new Sequence.OneD(genericRow.cells).val());
            rowSystemMappingArray.unshift(genericRow.weftId);

            let materialId = 0; // Default material ID
            if (typeof genericRow.weftId === 'number' && genericRow.weftId < resolvedMaterialIds.length) {
                materialId = resolvedMaterialIds[genericRow.weftId];
            }
            rowShuttleMappingArray.unshift(materialId);
        });
    } else {
        // Create a single blank row when genericDraftData.rows is empty
        const numWarpsForEmptyRow = numWarpsOpParam > 0 ? numWarpsOpParam : 1;
        pattern.pushWeftSequence(new Sequence.OneD(Array(numWarpsForEmptyRow).fill(0)).val());
        rowSystemMappingArray.push(0); // Default weftId for the blank row
    }

    const finalPatternExport = pattern.export();
    let d = initDraftFromDrawdown(finalPatternExport);

    // Populate System Mappings from genericDraftData
    d.colSystemMapping = genericDraftData.colSystemMapping;
    if (d.colSystemMapping.length === 0 && numWarpsOpParam > 0) {
        const warpSysForBlankFallback = warpSystemsOpParam > 0 ? warpSystemsOpParam : 1;
        for (let i = 0; i < numWarpsOpParam; i++) {
            d.colSystemMapping.push(i % warpSysForBlankFallback);
        }
    }
    if (d.colSystemMapping.length === 0 && numWarpsOpParam <= 0) {
        d.colSystemMapping = [0]; // Default for 0 warps
    }

    d.rowSystemMapping = rowSystemMappingArray.length > 0 ? rowSystemMappingArray : [0];

    // Populate Shuttle Mappings
    const numColsInDraft = d.drawdown[0] ? d.drawdown[0].length : (numWarpsOpParam > 0 ? numWarpsOpParam : 1);
    d.colShuttleMapping = Array(numColsInDraft).fill(0);
    d.rowShuttleMapping = rowShuttleMappingArray.length > 0 ? rowShuttleMappingArray : [0];

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
            weftDots: [],
            selectedDots: [],
            dotFills: [],
            activeWeft: null,
            currentSpline: [],
            permanentSplines: [],
            warpData: [],
            clickSequence: 0,
            hoveredDotIndex: -1,
            showDeleteButton: false,
            deleteButtonBounds: null,
            generatedDraft: {
                rows: [],
                colSystemMapping: []
            }
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

            // Initialize dotFills to the correct size with empty arrays for each dot
            canvasState.dotFills = [];
            const currentTotalDots = numWarps * 2; // Each warp has a top and a bottom weft dot
            for (let i = 0; i < currentTotalDots; i++) {
                canvasState.dotFills.push([]);
            }

            for (let i = 0; i < numWarps; i++) {
                canvasState.warpData.push({
                    warpSys: i % warpSystems,
                    topWeft: [],
                    bottomWeft: []
                });
            }
            // Initialize generatedDraft for a blank state based on current params
            generateDraft(canvasState, numWarps, warpSystems);

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
            drawWarpDotsAndLines();
            drawWeftSysIcons();
            drawWeftDots();
            drawPermanentSplines();
            drawStickySpline();
            drawDeleteButton();
        };

        function drawWarpDotsAndLines() {
            let spacingX = (SKETCH_CANVAS_WIDTH - SKETCH_LEFT_MARGIN) / (numWarps + 1);
            let spacingY = (SKETCH_CANVAS_HEIGHT - SKETCH_TOP_MARGIN - SKETCH_BOTTOM_MARGIN) / (warpSystems + 1);
            canvasState.weftDots = [];

            for (let i = 0; i < numWarps; i++) {
                let x = SKETCH_LEFT_MARGIN + spacingX * (i + 1);
                p.stroke(0);
                p.strokeWeight(1);
                p.line(x, SKETCH_TOP_MARGIN, x, SKETCH_CANVAS_HEIGHT - SKETCH_BOTTOM_MARGIN);

                let warpRow = i % warpSystems; // This determines the y-level of the warp dot
                let y = SKETCH_TOP_MARGIN + spacingY * (warpRow + 1);

                // Define positions for the top and bottom weft interaction dots for this warp column
                canvasState.weftDots.push({ x: x, y: y - 20 }); // Top weft dot for warp i
                canvasState.weftDots.push({ x: x, y: y + 20 }); // Bottom weft dot for warp i

                // Draw the warp dot
                p.noStroke();
                p.fill(50);
                p.ellipse(x, y, 18, 18);
            }
        }

        function drawWeftSysIcons() {
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

        function drawWeftDots() {
            for (let i = 0; i < canvasState.weftDots.length; i++) {
                let dot = canvasState.weftDots[i];

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
                    let dot = canvasState.weftDots[spline.dots[i]];
                    points.push({ x: dot.x, y: dot.y });

                    if (i > 0 && i < spline.dots.length - 1) {
                        let prevDot = canvasState.weftDots[spline.dots[i - 1]];
                        let nextDot = canvasState.weftDots[spline.dots[i + 1]];

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
                let lastDot = canvasState.weftDots[canvasState.currentSpline[canvasState.currentSpline.length - 1]];
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
            for (let i = 0; i < canvasState.weftDots.length; i++) {
                let dot = canvasState.weftDots[i];
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
                    const clickedWeftId = i;
                    if (canvasState.activeWeft === clickedWeftId) {
                        // User clicked the same active weft button (to deselect)
                        canvasState.currentSpline = [];
                        canvasState.activeWeft = null;
                        p.noLoop();
                    } else {
                        // User clicked a new weft button or re-selected a previously deselected one.
                        canvasState.activeWeft = clickedWeftId;
                        canvasState.currentSpline = []; // Start with an empty spline for the sticky line

                        // Try to find an unclosed path for this weft in permanentSplines to resume from
                        let resumedFromSpline = false;
                        for (let spline of canvasState.permanentSplines) {
                            if (spline.weft === canvasState.activeWeft && !spline.closed && spline.dots.length > 0) {
                                canvasState.currentSpline = [spline.dots[spline.dots.length - 1]];
                                resumedFromSpline = true;
                                break;
                            }
                        }
                        // If no unclosed path was found, currentSpline remains empty, signifying a new path segment will start on the next dot click.
                        p.loop();
                    }
                    clicked = true;
                    p.redraw();
                    // Recalculate draft
                    generateDraft(canvasState, numWarps, warpSystems);
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
                    // Recalculate draft
                    generateDraft(canvasState, numWarps, warpSystems);
                    // Report the new canvasState to the operation
                    updateCallback(canvasState);
                    return;
                }
            }

            // Check dot clicks
            if (canvasState.activeWeft !== null) {
                for (let i = 0; i < canvasState.weftDots.length; i++) {
                    let dot = canvasState.weftDots[i];
                    if (p.dist(p.mouseX, p.mouseY, dot.x, dot.y) < 10) {
                        // Get warp index and whether it's a top or bottom dot
                        const { warpIdx, isTop } = getDotInfo(i);
                        const weftArray = isTop ? canvasState.warpData[warpIdx].topWeft : canvasState.warpData[warpIdx].bottomWeft;

                        // Check if this dot has the active weft assigned
                        // This condition was for resuming by clicking a dot.
                        // With the new model, resuming is handled by weft icon selection.
                        // Clicking a dot while a weft is active is always about *extending* the current path.
                        // if (canvasState.selectedDots.includes(i) && canvasState.dotFills[i].includes(canvasState.activeWeft)) { ... }

                        // Add new weft assignment to warpData
                        if (!canvasState.selectedDots.includes(i)) {
                            canvasState.selectedDots.push(i);
                            canvasState.dotFills[i] = [canvasState.activeWeft];
                            weftArray.push({
                                weft: canvasState.activeWeft, // Path identity is the weftId
                                sequence: canvasState.clickSequence
                                // pathId: canvasState.currentPathId, // Removed
                            });
                            canvasState.clickSequence++;
                        } else if (!canvasState.dotFills[i].includes(canvasState.activeWeft)) {
                            canvasState.dotFills[i].push(canvasState.activeWeft);
                            weftArray.push({
                                weft: canvasState.activeWeft, // Path identity is the weftId
                                sequence: canvasState.clickSequence
                                // pathId: canvasState.currentPathId, // Removed
                            });
                            canvasState.clickSequence++;
                        } else if (canvasState.dotFills[i].includes(canvasState.activeWeft) && canvasState.currentSpline.length === 0) {
                            // This case implies clicking on a dot that's already part of the active weft's path,
                            // AND currentSpline is empty. This shouldn't happen if weft icon click correctly sets up currentSpline for resumption.
                            // If it does, treat as starting a new segment from this dot.
                            canvasState.currentSpline = [i];
                            p.loop();
                            p.redraw();
                            updateCallback(canvasState);
                            return;
                        }


                        // Manage permanentSplines
                        if (canvasState.currentSpline.length > 0) {
                            // Extending an existing segment (could be from resumption or continuous drawing)
                            let prevDot = canvasState.currentSpline[canvasState.currentSpline.length - 1];
                            if (prevDot !== i) { // Only add if it's a new dot
                                let extendedExisting = false;
                                for (let spline of canvasState.permanentSplines) {
                                    if (spline.weft === canvasState.activeWeft && !spline.closed && spline.dots.length > 0 && spline.dots[spline.dots.length - 1] === prevDot) {
                                        spline.dots.push(i);
                                        extendedExisting = true;
                                        break;
                                    }
                                }
                                if (!extendedExisting) {
                                    // This implies currentSpline had a 'prevDot' but it wasn't the end of an existing permanentSpline.
                                    // This could happen if currentSpline was [resumeDot] and this is the first extension click.
                                    // Or, if somehow a segment started without being added to permanentSplines yet.
                                    // Create a new spline starting with prevDot and current dot i
                                    canvasState.permanentSplines.push({ weft: canvasState.activeWeft, dots: [prevDot, i], closed: false });
                                }
                            }
                        } else {
                            // Starting a brand new spline segment for this weft (currentSpline was empty)
                            canvasState.permanentSplines.push({ weft: canvasState.activeWeft, dots: [i], closed: false });
                        }


                        // Path Closure Logic
                        if (canvasState.currentSpline.length > 0 && canvasState.currentSpline[0] === i && canvasState.currentSpline.length > 1) {
                            let splineToClose = null;
                            for (let spline of canvasState.permanentSplines) {
                                if (spline.weft === canvasState.activeWeft && !spline.closed && spline.dots[0] === i && spline.dots[spline.dots.length - 1] === canvasState.currentSpline[canvasState.currentSpline.length - 1]) {
                                    // Check if the currentSpline's actual first point matches the clicked dot 'i'
                                    // AND the last point of the spline in permanentSplines matches the last point of currentSpline before adding 'i'
                                    // More direct: find the spline whose first point is 'i' and last point is the one before 'i' in currentSpline
                                    if (spline.dots[spline.dots.length - 1] === i) { // Already added by previous block if it's a new point.
                                        // This means the spline ends with 'i', and its first point is also 'i'.
                                    } else {
                                        spline.dots.push(i); // Add the closing dot to the visual spline
                                    }
                                    splineToClose = spline;
                                    break;
                                } else if (spline.weft === canvasState.activeWeft && !spline.closed && spline.dots.length > 0 && spline.dots[0] === i) {
                                    // Simpler: if we are closing to the first point of *any* segment of this weft.
                                    // This implies the current drawing sequence in currentSpline should lead to this 'i'.
                                    // The last point of currentSpline (before adding 'i') should be the last point of the spline being closed.
                                    const lastPointInCurrentSplineBeforeClosing = canvasState.currentSpline[canvasState.currentSpline.length - 1];
                                    if (spline.dots[spline.dots.length - 1] === lastPointInCurrentSplineBeforeClosing) {
                                        spline.dots.push(i);
                                        splineToClose = spline;
                                        break;
                                    }
                                }
                            }

                            if (splineToClose) {
                                splineToClose.closed = true;
                            }
                            // Else, if no specific spline was identified to close, this click might be on the first dot but not forming a closure.

                            canvasState.currentSpline = [];
                            canvasState.activeWeft = null;
                            p.noLoop();
                        } else {
                            // Add to currentSpline for the sticky line
                            if (canvasState.currentSpline.length === 0 || canvasState.currentSpline[canvasState.currentSpline.length - 1] !== i) {
                                canvasState.currentSpline.push(i);
                            }
                        }

                        p.redraw();
                        // Recalculate draft
                        generateDraft(canvasState, numWarps, warpSystems);
                        // Report the new canvasState to the operation
                        updateCallback(canvasState);
                        return;
                    }
                }
            }

            // Clicks outside of any dots
            if (!clicked && canvasState.activeWeft !== null) {
                // Current drawing path ends. No increment of currentPathId, next new path selection will.
                canvasState.currentSpline = [];
                canvasState.activeWeft = null;
                p.noLoop();
                p.redraw();
                // Recalculate draft
                generateDraft(canvasState, numWarps, warpSystems);
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

        function generateDraft(currentCanvasState: any, currentNumWarps: number, currentWarpSystems: number) {
            // This function populates currentCanvasState.generatedDraft as per the refined logic
            // in Draft_Gen_Dev_Plan.md

            // Initialize/reset generatedDraft for the new calculation
            currentCanvasState.generatedDraft = {
                rows: [],
                colSystemMapping: [],
                weftColors: ACCESSIBLE_COLORS.slice(0, weftSystems)
            };

            // Step 1: Create allInteractions List
            const allInteractions: Array<{
                weftId: number,
                sequence: number,
                warpIdx: number,
                isTopInteraction: boolean,
                originalWarpSys: number // Physical system of the warp at interaction.warpIdx
            }> = [];

            if (currentCanvasState.warpData) {
                currentCanvasState.warpData.forEach((warp_column_data, current_warp_idx) => {
                    if (warp_column_data.topWeft) {
                        warp_column_data.topWeft.forEach(entry => {
                            allInteractions.push({
                                weftId: entry.weft,
                                sequence: entry.sequence,
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
                                warpIdx: current_warp_idx,
                                isTopInteraction: false,
                                originalWarpSys: warp_column_data.warpSys
                            });
                        });
                    }
                });
            }

            // Step 2: Handle Empty Interactions
            if (allInteractions.length === 0) {
                currentCanvasState.generatedDraft.colSystemMapping = [];
                const numWarpsForBlank = currentNumWarps > 0 ? currentNumWarps : 1;
                const warpSysForBlank = currentWarpSystems > 0 ? currentWarpSystems : 1;
                for (let i = 0; i < numWarpsForBlank; i++) {
                    currentCanvasState.generatedDraft.colSystemMapping.push(i % warpSysForBlank);
                }
                currentCanvasState.generatedDraft.rows.push({
                    weftId: 0, // Default weftId
                    cells: Array(numWarpsForBlank).fill(0) // All white cells
                });
                return;
            }

            // Step 3: Sort allInteractions by pathId, then by sequence.
            allInteractions.sort((a, b) => {
                if (a.weftId !== b.weftId) {
                    return a.weftId - b.weftId;
                }
                return a.sequence - b.sequence;
            });

            // Step 4: Populate generatedDraft.colSystemMapping.
            currentCanvasState.generatedDraft.colSystemMapping = [];
            if (currentNumWarps > 0) {
                if (currentCanvasState.warpData && currentCanvasState.warpData.length === currentNumWarps) {
                    currentCanvasState.generatedDraft.colSystemMapping = currentCanvasState.warpData.map(wd => wd.warpSys);
                } else {
                    // Fallback if warpData is not as expected or empty but numWarps > 0
                    for (let i = 0; i < currentNumWarps; i++) {
                        currentCanvasState.generatedDraft.colSystemMapping.push(i % (currentWarpSystems > 0 ? currentWarpSystems : 1));
                    }
                }
            } else {
                currentCanvasState.generatedDraft.colSystemMapping = [0]; // Default for 0 warps case
            }

            // Step 5: Identify weftPasses (Logical Draft Rows) from allInteractions.
            const identifiedPasses: Array<{
                weftId: number,
                interactions: Array<typeof allInteractions[0]> // List of actual click interactions for this pass
            }> = [];
            let currentPassInteractions: Array<typeof allInteractions[0]> = [];
            let currentWarpIdxTrendInPass: 'increasing' | 'decreasing' | 'stationary' | 'none' = 'none';

            for (let i = 0; i < allInteractions.length; i++) {
                const currentInteraction = allInteractions[i];
                const prevInteractionGlobal = i > 0 ? allInteractions[i - 1] : null;
                let startNewPass = false;

                if (prevInteractionGlobal && currentInteraction.weftId !== prevInteractionGlobal.weftId) {
                    startNewPass = true;
                } else if (prevInteractionGlobal &&
                    currentInteraction.weftId === prevInteractionGlobal.weftId &&
                    currentInteraction.weftId === prevInteractionGlobal.weftId &&
                    currentInteraction.warpIdx === prevInteractionGlobal.warpIdx && // Explicit Turn
                    currentInteraction.isTopInteraction !== prevInteractionGlobal.isTopInteraction &&
                    currentInteraction.sequence === prevInteractionGlobal.sequence + 1) { // Ensure it's the next click
                    startNewPass = true;
                } else if (currentPassInteractions.length > 0 &&
                    prevInteractionGlobal &&
                    currentInteraction.weftId === prevInteractionGlobal.weftId &&
                    currentInteraction.weftId === prevInteractionGlobal.weftId) { // Trend Reversal
                    const lastInteractionInCurrentPass = currentPassInteractions[currentPassInteractions.length - 1];
                    let newTrendSegment: 'increasing' | 'decreasing' | 'stationary' = 'stationary';

                    if (currentInteraction.warpIdx > lastInteractionInCurrentPass.warpIdx) {
                        newTrendSegment = 'increasing';
                    } else if (currentInteraction.warpIdx < lastInteractionInCurrentPass.warpIdx) {
                        newTrendSegment = 'decreasing';
                    }

                    if (currentPassInteractions.length === 1 && lastInteractionInCurrentPass.warpIdx !== currentInteraction.warpIdx) {
                        // First segment of a pass, establish initial trend
                        currentWarpIdxTrendInPass = newTrendSegment;
                    } else if (currentWarpIdxTrendInPass !== 'none' &&
                        currentWarpIdxTrendInPass !== 'stationary' &&
                        newTrendSegment !== 'stationary' && // Don't break pass if new segment is stationary
                        currentWarpIdxTrendInPass !== newTrendSegment) {
                        startNewPass = true; // Trend reversed
                    }
                }

                if (startNewPass && currentPassInteractions.length > 0) {
                    identifiedPasses.push({
                        weftId: currentPassInteractions[0].weftId,
                        interactions: [...currentPassInteractions]
                    });
                    currentPassInteractions = [];
                    currentWarpIdxTrendInPass = 'none';
                }
                currentPassInteractions.push(currentInteraction);

                // Update trend *after* pushing current interaction to currentPassInteractions
                // and *after* checking for startNewPass
                if (!startNewPass && currentPassInteractions.length > 1) {
                    const lastInThisPass = currentPassInteractions[currentPassInteractions.length - 1];
                    let trendAnchor = currentPassInteractions[0]; // Default anchor
                    // Find the latest interaction in the current pass that is on a *different* warpIdx than the last one
                    for (let k = currentPassInteractions.length - 2; k >= 0; k--) {
                        if (currentPassInteractions[k].warpIdx !== lastInThisPass.warpIdx) {
                            trendAnchor = currentPassInteractions[k];
                            break;
                        }
                    }

                    if (lastInThisPass.warpIdx > trendAnchor.warpIdx) {
                        currentWarpIdxTrendInPass = 'increasing';
                    } else if (lastInThisPass.warpIdx < trendAnchor.warpIdx) {
                        currentWarpIdxTrendInPass = 'decreasing';
                    } else {
                        currentWarpIdxTrendInPass = 'stationary';
                    }
                } else if (!startNewPass && currentPassInteractions.length === 1) {
                    currentWarpIdxTrendInPass = 'stationary'; // Or 'none' if preferred for a single point
                }
            }
            if (currentPassInteractions.length > 0) {
                identifiedPasses.push({
                    weftId: currentPassInteractions[0].weftId,
                    interactions: [...currentPassInteractions]
                });
            }

            // --- Step 6: Generate Draft Rows (Two-Part Logic) ---
            const processedRowsData: Array<{
                weftId: number,
                cells: Array<number>,
                passObj: typeof identifiedPasses[0]
            }> = [];

            // Helper function to check for direct interaction in a specific pass's interaction list
            // More efficient to pass a pre-built map if available, but this is clear.
            function hasDirectInteractionInPass(passObject: { interactions: Array<any> }, targetWarpIdx: number): boolean {
                for (const interaction of passObject.interactions) {
                    if (interaction.warpIdx === targetWarpIdx) {
                        return true;
                    }
                }
                return false;
            }


            // == Part 1: Initial Row Processing (Direct Interactions & Strict Segment-Based ETWS) ==
            if (currentCanvasState.warpData && currentCanvasState.warpData.length > 0 && currentNumWarps > 0) {
                identifiedPasses.forEach(passDetails => {
                    const currentRowCells: Array<number> = Array(currentNumWarps).fill(0); // Initialize WHITE
                    const passInteractions = passDetails.interactions; // Already sorted by sequence

                    // A. Apply Direct Interactions first
                    const directInteractionMapForPass = new Map<number, typeof allInteractions[0]>();
                    if (passInteractions.length > 0) {
                        passInteractions.forEach(interaction => {
                            currentRowCells[interaction.warpIdx] = interaction.isTopInteraction ? 0 : 1; // Cell state by direct click
                            directInteractionMapForPass.set(interaction.warpIdx, interaction);
                        });
                    }

                    // B. Apply Strict Segment-Based ETWS Lifts
                    if (passInteractions.length >= 2) {
                        for (let i = 0; i < passInteractions.length - 1; i++) { // Iterate up to the second to last
                            const interactionA = passInteractions[i];
                            const interactionB = passInteractions[i + 1]; // The next interaction in sequence

                            // ETWS for the segment A to B is from interactionA
                            const ETWS_segment = interactionA.originalWarpSys;

                            const startWarpIdxExclusive = Math.min(interactionA.warpIdx, interactionB.warpIdx);
                            const endWarpIdxExclusive = Math.max(interactionA.warpIdx, interactionB.warpIdx);

                            for (let cellWarpIdx = startWarpIdxExclusive + 1; cellWarpIdx < endWarpIdxExclusive; cellWarpIdx++) {
                                if (!directInteractionMapForPass.has(cellWarpIdx)) { // Only if no direct interaction in this cell for this pass
                                    const physicalWarpSystemAtCell = currentCanvasState.warpData[cellWarpIdx]?.warpSys ?? 0;
                                    if (ETWS_segment > physicalWarpSystemAtCell) {
                                        currentRowCells[cellWarpIdx] = 1; // BLACK
                                    }
                                }
                            }
                        }
                    }
                    processedRowsData.push({ weftId: passDetails.weftId, cells: currentRowCells, passObj: passDetails });
                });
            }

            // == Part 2: Post-Processing for Turn-Induced Lifts (Refined) ==
            if (processedRowsData.length > 1) { // Need at least two rows to compare for turns
                for (let i = 1; i < processedRowsData.length; i++) { // Start from the second row
                    const currentRowData = processedRowsData[i];
                    const prevRowData = processedRowsData[i - 1];

                    if (currentRowData.passObj.interactions.length === 0 || prevRowData.passObj.interactions.length === 0) {
                        continue; // Both current and previous pass must have interactions
                    }

                    const currentPassFirstInt = currentRowData.passObj.interactions[0];
                    const prevPassLastInt = prevRowData.passObj.interactions[prevRowData.passObj.interactions.length - 1];

                    let isTurnContinuation = false;
                    let turnContext: { turnWarpIdx: number, turnWarpOriginalSystem: number } | null = null;

                    // A. Detect Same-Warp Turn condition
                    if (currentPassFirstInt.warpIdx === prevPassLastInt.warpIdx &&
                        currentPassFirstInt.isTopInteraction !== prevPassLastInt.isTopInteraction &&
                        currentPassFirstInt.weftId === prevPassLastInt.weftId &&
                        currentPassFirstInt.weftId === prevPassLastInt.weftId) {
                        isTurnContinuation = true;
                        turnContext = {
                            turnWarpIdx: currentPassFirstInt.warpIdx,
                            turnWarpOriginalSystem: currentPassFirstInt.originalWarpSys // System level of the weft as it STARTS the new pass
                        };
                    }

                    if (isTurnContinuation && turnContext) {
                        // Weft turned on the same warp; check if it moved to a lower effective system layer
                        // The physical system of the warp where the turn occurs
                        const physicalSystemAtTurnWarp = currentCanvasState.warpData[turnContext.turnWarpIdx]?.warpSys ?? 0;

                        // Condition for lifting: weft is now effectively on a lower system layer than the warps it needs to clear.
                        // (e.g., turnWarpOriginalSystem = 1 (Sys1), physicalSystemAt... = 0 (Sys0) -> 0 < 1, so lift)

                        // 1. Handle the Turn Warp Itself
                        if (physicalSystemAtTurnWarp < turnContext.turnWarpOriginalSystem) { // Physical warp is higher than weft's new level
                            // Lift in CURRENT turn row (Pass N+1)
                            if (!hasDirectInteractionInPass(currentRowData.passObj, turnContext.turnWarpIdx)) {
                                currentRowData.cells[turnContext.turnWarpIdx] = 1; // BLACK
                            }
                            // Lift in PREVIOUS row that ended at the turn (Pass N)
                            if (!hasDirectInteractionInPass(prevRowData.passObj, turnContext.turnWarpIdx)) {
                                prevRowData.cells[turnContext.turnWarpIdx] = 1; // BLACK
                            }
                        }

                        // 2. Handle Specific Adjacent Warp (Directional Lift - "Turning Away From")
                        let adjacentWarpToPotentiallyLift: number | null = null;
                        if (prevRowData.passObj.interactions.length >= 2) {
                            const prevPrevInteraction = prevRowData.passObj.interactions[prevRowData.passObj.interactions.length - 2];
                            const incomingSegmentOriginWarpIdx = prevPrevInteraction.warpIdx;

                            if (incomingSegmentOriginWarpIdx !== turnContext.turnWarpIdx) { // Ensure distinct point forming a segment
                                adjacentWarpToPotentiallyLift = turnContext.turnWarpIdx + Math.sign(turnContext.turnWarpIdx - incomingSegmentOriginWarpIdx);
                            }
                        }
                        // If prevRowData.passObj.interactions.length < 2, no defined incoming direction from within the pass,
                        // so no adjacent warp is lifted by this specific turn mechanism.

                        if (adjacentWarpToPotentiallyLift !== null && adjacentWarpToPotentiallyLift >= 0 && adjacentWarpToPotentiallyLift < currentNumWarps) {
                            const physicalWarpSystemAtAdjacent = currentCanvasState.warpData[adjacentWarpToPotentiallyLift]?.warpSys ?? 0;
                            if (physicalWarpSystemAtAdjacent < turnContext.turnWarpOriginalSystem) { // Adj warp is physically higher
                                // Lift in CURRENT turn row (Pass N+1)
                                if (!hasDirectInteractionInPass(currentRowData.passObj, adjacentWarpToPotentiallyLift)) {
                                    currentRowData.cells[adjacentWarpToPotentiallyLift] = 1; // BLACK
                                }
                                // Lift in PREVIOUS row that ended at the turn (Pass N)
                                if (!hasDirectInteractionInPass(prevRowData.passObj, adjacentWarpToPotentiallyLift)) {
                                    prevRowData.cells[adjacentWarpToPotentiallyLift] = 1; // BLACK
                                }
                            }
                        }
                    } else {
                        // B. Handle Cross-Warp Transition to a Physically Lower System
                        // This applies if not a same-warp turn.
                        const newPassEffectiveSystem = currentPassFirstInt.originalWarpSys;

                        // 1. Lift Previous Pass End-Warp in Current Pass
                        // (If its physical system is higher than the weft's new effective system)
                        const prevPassEndWarpPhysicalSystem = currentCanvasState.warpData[prevPassLastInt.warpIdx]?.warpSys ?? 0;
                        if (prevPassEndWarpPhysicalSystem < newPassEffectiveSystem) { // Prev end warp is physically higher
                            if (!hasDirectInteractionInPass(currentRowData.passObj, prevPassLastInt.warpIdx)) {
                                currentRowData.cells[prevPassLastInt.warpIdx] = 1; // BLACK
                            }
                        }

                        // 2. Lift Intervening Warps in Current Pass
                        // (If their physical system is higher than the weft's new effective system)
                        const minWarpIdx = Math.min(prevPassLastInt.warpIdx, currentPassFirstInt.warpIdx);
                        const maxWarpIdx = Math.max(prevPassLastInt.warpIdx, currentPassFirstInt.warpIdx);

                        for (let warpIdxInBetween = minWarpIdx + 1; warpIdxInBetween < maxWarpIdx; warpIdxInBetween++) { // Strictly between
                            const physicalSystemOfWarpInBetween = currentCanvasState.warpData[warpIdxInBetween]?.warpSys ?? 0;
                            if (physicalSystemOfWarpInBetween < newPassEffectiveSystem) { // Intervening warp is physically higher
                                if (!hasDirectInteractionInPass(currentRowData.passObj, warpIdxInBetween)) {
                                    currentRowData.cells[warpIdxInBetween] = 1; // BLACK
                                }
                            }
                        }
                    }

                    // --- C. Retrospective Scoop Lift Logic (Modifies prevRowData.cells) ---
                    // Applied after A and B, using currentPassFirstInt as context for prevRowData interactions.
                    const I_next_overall = currentPassFirstInt;
                    if (prevRowData.passObj.interactions.length >= 1) { // Minimum one point in prev pass to be I_current
                        // Iterate through all interactions in prevRowData to check if they form a scoop peak
                        // with I_next_overall as the clarifying point.
                        for (let k_idx = 0; k_idx < prevRowData.passObj.interactions.length; k_idx++) {
                            const I_current = prevRowData.passObj.interactions[k_idx];

                            if (I_current.isTopInteraction === true) {
                                if (k_idx > 0) { // I_current has a preceding interaction in its own pass
                                    const I_prev_in_I_current_pass = prevRowData.passObj.interactions[k_idx - 1];

                                    const direction1 = Math.sign(I_current.warpIdx - I_prev_in_I_current_pass.warpIdx);
                                    const direction2 = Math.sign(I_next_overall.warpIdx - I_current.warpIdx);

                                    // Conditions for Retrospective Scoop Lift:
                                    const cond_directional_reversal = (direction1 !== 0 && direction2 !== 0 && direction1 === -direction2);
                                    const cond_peak_vs_incoming_system = (I_current.originalWarpSys <= I_prev_in_I_current_pass.originalWarpSys);
                                    const cond_peak_and_scoop_out_same_system = (I_current.originalWarpSys === I_next_overall.originalWarpSys);
                                    const cond_scoop_out_is_bottom = (I_next_overall.isTopInteraction === false);

                                    if (cond_directional_reversal &&
                                        cond_peak_vs_incoming_system &&
                                        cond_peak_and_scoop_out_same_system &&
                                        cond_scoop_out_is_bottom
                                    ) {
                                        prevRowData.cells[I_current.warpIdx] = 1; // BLACK
                                    }
                                } else {
                                    // I_current is the *first* interaction in prevRowData.
                                    // A scoop here would imply prev-prev pass -> I_current -> I_next_overall.
                                    // This specific logic branch focuses on scoops defined by I_next_overall clarifying
                                    // a peak *within* prevRowData. If I_current is the very first point of prevRowData,
                                    // it cannot form a peak relative to a point *before* it in the *same* pass.
                                    // The Cross-Warp Transition (Part B) or Same-Warp-Turn (Part A) might handle
                                    // its interaction with a theoretical pass *before* prevRowData.
                                    // For now, if I_current is the first point in its pass, it needs two other points
                                    // (one before, one after) to form the specific 3-point scoop pattern this section targets.
                                    // So, this specific type of scoop check isn't applicable if k_idx === 0.
                                    // However, the case where I_current IS prevPassLastInt (k_idx === prevRowData.passObj.interactions.length -1)
                                    // IS handled by the k_idx > 0 check for its I_prev and then using I_next_overall.
                                }
                            }
                        }
                    }
                }
            }

            // Final Step: Populate currentCanvasState.generatedDraft.rows from processedRowsData.
            processedRowsData.forEach(rowData => {
                currentCanvasState.generatedDraft.rows.push({ weftId: rowData.weftId, cells: rowData.cells });
            });
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