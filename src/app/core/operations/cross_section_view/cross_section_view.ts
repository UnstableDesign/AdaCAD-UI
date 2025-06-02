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

        // Use whichever is smaller: numWarps or warpSystems. 
        // If numWarps is < warpSystems, you cant access all the warp systems.
        const activeWarpSystems = Math.min(numWarps, warpSystems);

        let resetButton;

        // -- Constants
        const ACCESSIBLE_COLORS = [
            "#F4A7B9", "#A7C7E7", "#C6E2E9", "#FAD6A5", "#D5AAFF", "#B0E57C",
            "#FFD700", "#FFB347", "#87CEFA", "#E6E6FA", "#FFE4E1", "#C1F0F6"
        ];
        const SKETCH_CANVAS_WIDTH = CANVAS_WIDTH;
        const SKETCH_CANVAS_HEIGHT = CANVAS_HEIGHT;
        const SKETCH_TOP_MARGIN = 60;
        const SKETCH_LEFT_MARGIN = 100;
        const SKETCH_RIGHT_MARGIN = 60;
        const SKETCH_BOTTOM_MARGIN = 20;
        const WEFT_ICON_SIZE = 36;
        const WEFT_ICON_FONT_SIZE = 24;
        const WARP_DOT_SIZE = 22;
        const WEFT_DOT_SIZE = 16;
        const WEFT_SPACING = 24;

        const DEFAULT_CANVAS_STATE = {
            weftDots: [],
            selectedDots: [],
            dotFills: [],
            activeWeft: null,
            pathsByWeft: {},
            warpAndEdgeData: [],
            clickSequence: 0,
            hoveredDotIndex: -1,
            showDeleteButton: false,
            deleteButtonBounds: null,
            generatedDraft: {
                rows: [],
                colSystemMapping: [],
                weftColors: []
            }
        };

        // -- canvasState Variables
        // Canvas State
        let canvasState = loadCanvasState(DEFAULT_CANVAS_STATE);

        function resetCanvas() {
            // Reset variables to default values
            canvasState = JSON.parse(JSON.stringify(DEFAULT_CANVAS_STATE));

            // Initialize dotFills to the correct size with empty arrays for each dot
            canvasState.dotFills = [];
            const currentTotalDots = (activeWarpSystems * 2) + (numWarps * 2);
            for (let i = 0; i < currentTotalDots; i++) {
                canvasState.dotFills.push([]);
            }

            // Left Edge Entity (index 0)
            const leftEdgeEntity = { type: 'edge', edgeSys: [] };
            for (let i = 0; i < activeWarpSystems; i++) {
                leftEdgeEntity.edgeSys.push([]);
            }
            canvasState.warpAndEdgeData.push(leftEdgeEntity);

            // Warp Entities (indices 1 to numWarps)
            for (let i = 0; i < numWarps; i++) {
                canvasState.warpAndEdgeData.push({
                    type: 'warp',
                    warpSys: i % activeWarpSystems,
                    topWeft: [],
                    bottomWeft: []
                });
            }

            // Right Edge Entity (index numWarps + 1)
            const rightEdgeEntity = { type: 'edge', edgeSys: [] };
            for (let i = 0; i < activeWarpSystems; i++) {
                rightEdgeEntity.edgeSys.push([]);
            }
            canvasState.warpAndEdgeData.push(rightEdgeEntity);

            // Initialize generatedDraft for a blank state based on current params
            generateDraft(canvasState, numWarps, activeWarpSystems);

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
            drawWeftSysIcons();
            drawLines();
            drawWarpDots();
            drawSplines();
            drawWeftDots();
            drawStickyLineToMouse();
            drawDeleteButton();
        };

        function drawLines() {
            const numColumns = numWarps + 2; // Left Edge, Warps, Right Edge

            const firstColumnX = SKETCH_LEFT_MARGIN;
            const lastColumnX = SKETCH_CANVAS_WIDTH - SKETCH_RIGHT_MARGIN;
            const drawingWidth = lastColumnX - firstColumnX;

            let spacingX = 0;
            if (numColumns > 1) {
                spacingX = drawingWidth / (numColumns - 1);
            }

            let spacingY = (SKETCH_CANVAS_HEIGHT - SKETCH_TOP_MARGIN - SKETCH_BOTTOM_MARGIN) / (activeWarpSystems + 1);
            canvasState.weftDots = [];

            let currentX;

            // --- Populate Left Edge Interaction Dot Positions ---
            currentX = firstColumnX;
            for (let sys = 0; sys < activeWarpSystems; sys++) {
                let y = SKETCH_TOP_MARGIN + spacingY * (sys + 1);
                canvasState.weftDots.push({ x: currentX, y: y });
            }

            // --- Draw Warp Lines & Populate Warp Interaction Dot Positions ---
            for (let i = 0; i < numWarps; i++) {
                currentX = firstColumnX + spacingX * (i + 1);

                p.stroke(0);
                p.strokeWeight(1);
                p.line(currentX, SKETCH_TOP_MARGIN, currentX, SKETCH_CANVAS_HEIGHT - SKETCH_BOTTOM_MARGIN);

                const warpEntityData = canvasState.warpAndEdgeData[i + 1];
                let warpCenterY = SKETCH_TOP_MARGIN + spacingY * ((warpEntityData.warpSys % activeWarpSystems) + 1);

                canvasState.weftDots.push({ x: currentX, y: warpCenterY - WEFT_SPACING }); // Top weft dot
                canvasState.weftDots.push({ x: currentX, y: warpCenterY + WEFT_SPACING }); // Bottom weft dot
            }

            // --- Populate Right Edge Interaction Dot Positions ---
            currentX = lastColumnX;
            if (numColumns <= 1) currentX = firstColumnX;
            for (let sys = 0; sys < activeWarpSystems; sys++) {
                let y = SKETCH_TOP_MARGIN + spacingY * (sys + 1);
                canvasState.weftDots.push({ x: currentX, y: y });
            }

            // --- Draw Edge Lines (Dashed) ---
            const leftEdgeLineX = firstColumnX;
            const rightEdgeLineX = lastColumnX;

            p.stroke(128);
            p.strokeWeight(1);
            p.drawingContext.save();
            p.drawingContext.setLineDash([5, 5]);

            p.line(leftEdgeLineX, SKETCH_TOP_MARGIN, leftEdgeLineX, SKETCH_CANVAS_HEIGHT - SKETCH_BOTTOM_MARGIN);
            if (numColumns > 1 && rightEdgeLineX !== leftEdgeLineX) {
                p.line(rightEdgeLineX, SKETCH_TOP_MARGIN, rightEdgeLineX, SKETCH_CANVAS_HEIGHT - SKETCH_BOTTOM_MARGIN);
            }
            p.drawingContext.restore();
        }

        function drawWarpDots() {
            const numColumns = numWarps + 2;
            const firstColumnX = SKETCH_LEFT_MARGIN;
            const lastColumnX = SKETCH_CANVAS_WIDTH - SKETCH_RIGHT_MARGIN;
            const drawingWidth = lastColumnX - firstColumnX;

            let spacingX = 0;
            if (numColumns > 1) {
                spacingX = drawingWidth / (numColumns - 1);
            }
            let spacingY = (SKETCH_CANVAS_HEIGHT - SKETCH_TOP_MARGIN - SKETCH_BOTTOM_MARGIN) / (activeWarpSystems + 1);

            for (let i = 0; i < numWarps; i++) {
                let currentX = firstColumnX + spacingX * (i + 1);
                const warpEntityData = canvasState.warpAndEdgeData[i + 1];
                if (warpEntityData && warpEntityData.type === 'warp') {
                    let warpCenterY = SKETCH_TOP_MARGIN + spacingY * ((warpEntityData.warpSys % activeWarpSystems) + 1);
                    p.noStroke();
                    p.fill(50);
                    p.ellipse(currentX, warpCenterY, WARP_DOT_SIZE, WARP_DOT_SIZE);
                }
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
                p.ellipse(SKETCH_LEFT_MARGIN * 0.4, y, WEFT_ICON_SIZE, WEFT_ICON_SIZE);

                p.fill(0);
                p.noStroke();
                p.textSize(WEFT_ICON_FONT_SIZE);
                p.text(String.fromCharCode(97 + i), SKETCH_LEFT_MARGIN * 0.4, y);
            }
        }

        function drawSplines() {
            for (const weftIdStr in canvasState.pathsByWeft) {
                const weftId = parseInt(weftIdStr, 10);
                const anchors = canvasState.pathsByWeft[weftId];

                if (anchors && anchors.length >= 2) {
                    try {
                        calculateBezierControlPoints(anchors);
                    } catch (e) {
                        console.error('[CrossSectionView] Error calling calculateBezierControlPoints in draw:', e);
                        console.error('Path data that caused error:', JSON.parse(JSON.stringify({ weftId, anchors })));
                        p.noLoop(); // Stop looping if this error occurs
                        return;
                    }
                    renderBezierPath(anchors, weftId, p);
                }
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
                p.ellipse(dot.x, dot.y, WEFT_DOT_SIZE, WEFT_DOT_SIZE);

                for (let r = 1; r < canvasState.dotFills[i].length; r++) {
                    p.noFill();
                    p.stroke(ACCESSIBLE_COLORS[canvasState.dotFills[i][r] % ACCESSIBLE_COLORS.length]);
                    p.strokeWeight(2);
                    p.ellipse(dot.x, dot.y, WEFT_DOT_SIZE + r * 4, WEFT_DOT_SIZE + r * 4);
                }
            }
        }

        function drawStickyLineToMouse() {
            if (canvasState.activeWeft !== null) {
                const activePathAnchors = canvasState.pathsByWeft[canvasState.activeWeft];
                if (activePathAnchors && activePathAnchors.length > 0) {
                    const activeWeftColorHex = ACCESSIBLE_COLORS[canvasState.activeWeft % ACCESSIBLE_COLORS.length];
                    const lastAnchorPos = activePathAnchors[activePathAnchors.length - 1].pos;
                    p.stroke(activeWeftColorHex);
                    p.strokeWeight(2);
                    p.line(lastAnchorPos.x, lastAnchorPos.y, p.mouseX, p.mouseY);
                }
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
                if (p.dist(p.mouseX, p.mouseY, dot.x, dot.y) < WEFT_DOT_SIZE) {
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
            let clickedDotInfo: { index: number, pos: { x: number, y: number } } | null = null;
            let clicked = false;
            let spacing = (SKETCH_CANVAS_HEIGHT - SKETCH_TOP_MARGIN - SKETCH_BOTTOM_MARGIN) / (weftSystems + 1);

            // Check weft system clicks
            for (let i = 0; i < weftSystems; i++) {
                let y = SKETCH_TOP_MARGIN + spacing * (i + 1);
                if (p.dist(p.mouseX, p.mouseY, SKETCH_LEFT_MARGIN * 0.4, y) < WEFT_ICON_SIZE) {
                    const clickedWeftId = i;
                    if (canvasState.activeWeft === clickedWeftId) {
                        // User clicked the same active weft button (to deselect/complete open path)
                        canvasState.activeWeft = null;
                        p.noLoop();
                    } else {
                        // User clicked a new weft button or re-selected one.
                        // If there was an active path for a *different* weft, finalize it first.
                        canvasState.activeWeft = clickedWeftId;
                        if (!canvasState.pathsByWeft[clickedWeftId]) {
                            canvasState.pathsByWeft[clickedWeftId] = [];
                        }
                        p.loop();
                    }
                    clicked = true;
                    p.redraw();
                    // Recalculate draft
                    generateDraft(canvasState, numWarps, activeWarpSystems);
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
                    let dotIdx = canvasState.hoveredDotIndex;
                    const { idx, posType, warpSysId } = getDotInfo(dotIdx);

                    // Select the appropriate weft array
                    let weftArray;
                    const targetEntity = canvasState.warpAndEdgeData[idx];
                    if (posType === 'edgeSys') {
                        weftArray = targetEntity.edgeSys[warpSysId];
                    } else { // 'topWeft' or 'bottomWeft'
                        weftArray = targetEntity[posType];
                    }

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
                        const weftIndex = canvasState.dotFills[dotIdx].indexOf(weftToRemove);
                        if (weftIndex !== -1) {
                            canvasState.dotFills[dotIdx].splice(weftIndex, 1);
                        }

                        if (canvasState.dotFills[dotIdx].length === 0) {
                            canvasState.dotFills[dotIdx] = [];
                            canvasState.selectedDots = canvasState.selectedDots.filter(idx => idx !== dotIdx);
                        }

                        // Remove from warpAndEdgeData
                        const removedSequence = weftArray[mostRecentIndex].sequence;
                        weftArray.splice(mostRecentIndex, 1);
                        updateSequenceNumbers(removedSequence);

                        // Update splines by removing anchors associated with the deleted dot
                        const weftOfPathToUpdate = weftToRemove;
                        if (canvasState.pathsByWeft[weftOfPathToUpdate]) {
                            let currentAnchorsForWeft = canvasState.pathsByWeft[weftOfPathToUpdate];
                            const updatedAnchors = currentAnchorsForWeft.filter(anchor => anchor.dotIdx !== dotIdx);

                            if (updatedAnchors.length === 0) {
                                // Path is now empty, can keep as empty array or delete the key
                                canvasState.pathsByWeft[weftOfPathToUpdate] = [];
                            } else if (updatedAnchors.length > 0 && updatedAnchors.length < 2) {
                                // Path is too short to be a Bezier curve, but still has a point
                                canvasState.pathsByWeft[weftOfPathToUpdate] = updatedAnchors;
                            } else { // >= 2 anchors, still a drawable curve
                                calculateBezierControlPoints(updatedAnchors); // Recalculate CPs for the modified path
                                canvasState.pathsByWeft[weftOfPathToUpdate] = updatedAnchors;
                            }
                        }
                    }

                    // Reset hover state
                    canvasState.showDeleteButton = false;
                    canvasState.hoveredDotIndex = -1;
                    canvasState.deleteButtonBounds = null;

                    p.redraw();
                    // Recalculate draft
                    generateDraft(canvasState, numWarps, activeWarpSystems);
                    // Report the new canvasState to the operation
                    updateCallback(canvasState);
                    return;
                }
            }

            // Check dot clicks
            if (canvasState.activeWeft !== null) {
                for (let i = 0; i < canvasState.weftDots.length; i++) {
                    let dot = canvasState.weftDots[i];
                    if (p.dist(p.mouseX, p.mouseY, dot.x, dot.y) < WEFT_DOT_SIZE) {
                        clickedDotInfo = { index: i, pos: dot };
                        break;
                    }
                }
            }

            // Dot click handling (if a weft is active)
            if (clickedDotInfo && canvasState.activeWeft !== null) {
                const dotIndex = clickedDotInfo.index;
                const dotPosition = clickedDotInfo.pos; // This is already {x, y}

                // --- Update Weave Structure ---
                const { idx, posType, warpSysId } = getDotInfo(dotIndex);
                let weftArray; // This is targetArrayForWarpData
                const targetEntity = canvasState.warpAndEdgeData[idx];
                if (posType === 'edgeSys') {
                    weftArray = targetEntity.edgeSys[warpSysId];
                } else { // 'topWeft' or 'bottomWeft'
                    weftArray = targetEntity[posType];
                }

                // ALWAYS PUSH INTERACTION TO warpAndEdgeData for draft sequence
                weftArray.push({
                    weft: canvasState.activeWeft,
                    sequence: canvasState.clickSequence
                });
                canvasState.clickSequence++;
                // END ALWAYS PUSH

                // Visual state updates (dotFills, selectedDots)
                if (!canvasState.selectedDots.includes(dotIndex)) {
                    canvasState.selectedDots.push(dotIndex);
                    canvasState.dotFills[dotIndex] = [canvasState.activeWeft];
                } else if (!canvasState.dotFills[dotIndex].includes(canvasState.activeWeft)) {
                    canvasState.dotFills[dotIndex].push(canvasState.activeWeft);
                }
                // The original third 'else if' for starting a path from an existing dot is now
                // implicitly handled because the interaction is pushed above, and the spline logic below
                // will start a new path if currentActivePath.length is 0.
                // --- End Weave Structure Update --- (Comment was here)

                // --- Spline Logic: Add anchor ---
                if (canvasState.activeWeft !== null) { // This null check is important before accessing pathsByWeft
                    if (!canvasState.pathsByWeft[canvasState.activeWeft]) {
                        canvasState.pathsByWeft[canvasState.activeWeft] = [];
                    }
                    const currentActivePath = canvasState.pathsByWeft[canvasState.activeWeft];
                    const newAnchor = {
                        id: generateUUID(),
                        dotIdx: dotIndex,
                        pos: { x: dotPosition.x, y: dotPosition.y },
                        cpBefore: { x: dotPosition.x, y: dotPosition.y },
                        cpAfter: { x: dotPosition.x, y: dotPosition.y }
                    };

                    // Only add new anchor to spline if it's visually a new point or the first point
                    if (currentActivePath.length === 0 || currentActivePath[currentActivePath.length - 1].dotIdx !== newAnchor.dotIdx) {
                        currentActivePath.push(newAnchor);
                    }
                }

                // Ensure draw loop is running for sticky line if path not closed
                if (canvasState.activeWeft !== null) {
                    p.loop();
                }

                p.redraw();
                generateDraft(canvasState, numWarps, activeWarpSystems);
                updateCallback(canvasState);
                return;
            }

            // Clicks outside of any dots (if an active weft is selected)
            if (!clicked && canvasState.activeWeft !== null) {
                // Clicked outside: finalize current open path if it exists
                canvasState.activeWeft = null;
                p.noLoop();
                p.redraw();
                // Recalculate draft
                generateDraft(canvasState, numWarps, activeWarpSystems);
                // Report the new canvasState to the operation
                updateCallback(canvasState);
            }
        }

        function generateDraft(currentCanvasState: any, currentNumWarps: number, currentWarpSystems: number) {
            // This function populates currentCanvasState.generatedDraft 
            // First initialize/reset generatedDraft for the new calculation
            currentCanvasState.generatedDraft = {
                rows: [],
                colSystemMapping: [],
                weftColors: ACCESSIBLE_COLORS.slice(0, weftSystems)
            };

            // Step 1: Create allInteractions List
            const allInteractions: Array<{
                weftId: number,
                sequence: number,
                warpIdx: number, // Can be -1 for left edge, currentNumWarps for right edge
                isTopInteraction: boolean,
                originalWarpSys: number // Physical system of the warp at interaction.warpIdx, or system clicked on edge
            }> = [];

            if (currentCanvasState.warpAndEdgeData) {
                currentCanvasState.warpAndEdgeData.forEach((entity, entityIdx) => {
                    if (entity.type === 'warp') {
                        // Process topWeft for warps
                        if (entity.topWeft) {
                            entity.topWeft.forEach(entry => {
                                allInteractions.push({
                                    weftId: entry.weft,
                                    sequence: entry.sequence,
                                    warpIdx: entityIdx - 1, // Left edge is at entityIdx 0, so first warp is at entityIdx 1
                                    isTopInteraction: true,
                                    originalWarpSys: entity.warpSys
                                });
                            });
                        }
                        // Process bottomWeft for warps
                        if (entity.bottomWeft) {
                            entity.bottomWeft.forEach(entry => {
                                allInteractions.push({
                                    weftId: entry.weft,
                                    sequence: entry.sequence,
                                    warpIdx: entityIdx - 1, // Adjust entityIdx to be 0-indexed visual warp number
                                    isTopInteraction: false,
                                    originalWarpSys: entity.warpSys
                                });
                            });
                        }
                    } else if (entity.type === 'edge') {
                        // Phase 2: Process edge interactions from entity.edgeSys
                        // For now, edge interactions are stored but not added to allInteractions for draft generation
                        const isLeftEdge = entityIdx === 0;
                        // entity.edgeSys is an array of arrays, outer indexed by systemLevel
                        entity.edgeSys.forEach((systemInteractions, systemLevel) => {
                            systemInteractions.forEach(entry => {
                                allInteractions.push({
                                    weftId: entry.weft,
                                    sequence: entry.sequence,
                                    warpIdx: isLeftEdge ? -1 : currentNumWarps,
                                    isTopInteraction: false, // Always false for edge interactions
                                    originalWarpSys: systemLevel // Actual system clicked on the edge
                                });
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
                // Populate colSystemMapping based on the warp entities in warpAndEdgeData
                const warpEntities = currentCanvasState.warpAndEdgeData.filter(e => e.type === 'warp');
                if (warpEntities.length === currentNumWarps) {
                    currentCanvasState.generatedDraft.colSystemMapping = warpEntities.map(wd => wd.warpSys);
                } else {
                    // Fallback if warpAndEdgeData is not as expected or empty but numWarps > 0
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
                    currentInteraction.warpIdx === prevInteractionGlobal.warpIdx && // Explicit Turn
                    currentInteraction.isTopInteraction !== prevInteractionGlobal.isTopInteraction &&
                    currentInteraction.sequence === prevInteractionGlobal.sequence + 1) { // Ensure it's the next click
                    startNewPass = true;
                } else if (currentPassInteractions.length > 0 &&
                    prevInteractionGlobal &&
                    currentInteraction.weftId === prevInteractionGlobal.weftId) { // Trend Reversal
                    const lastInteractionInCurrentPass = currentPassInteractions[currentPassInteractions.length - 1];
                    let newTrendSegment: 'increasing' | 'decreasing' | 'stationary' = 'stationary';

                    if (currentInteraction.warpIdx > lastInteractionInCurrentPass.warpIdx) {
                        newTrendSegment = 'increasing';
                    } else if (currentInteraction.warpIdx < lastInteractionInCurrentPass.warpIdx) {
                        newTrendSegment = 'decreasing';
                    }

                    const isCurrentInteractionAnEdge = currentInteraction.warpIdx === -1 || currentInteraction.warpIdx === currentNumWarps;

                    if (currentPassInteractions.length === 1 && lastInteractionInCurrentPass.warpIdx !== currentInteraction.warpIdx) {
                        // First segment of a pass, establish initial trend
                        currentWarpIdxTrendInPass = newTrendSegment;
                    } else if (!isCurrentInteractionAnEdge &&
                        currentWarpIdxTrendInPass !== 'none' &&
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
                    // Ensure interaction.warpIdx still makes sense in the context of how allInteractions is built
                    if (interaction.warpIdx === targetWarpIdx) {
                        return true;
                    }
                }
                return false;
            }


            // == Part 1: Initial Row Processing (Direct Interactions & Strict Segment-Based ETWS) ==
            if (currentCanvasState.warpAndEdgeData && currentCanvasState.warpAndEdgeData.length > 0 && currentNumWarps > 0) {
                const warpEntities = currentCanvasState.warpAndEdgeData.filter(e => e.type === 'warp');
                identifiedPasses.forEach(passDetails => {
                    const currentRowCells: Array<number> = Array(currentNumWarps).fill(0); // Initialize WHITE
                    const passInteractions = passDetails.interactions; // Already sorted by sequence

                    // A. Apply Direct Interactions first
                    const directInteractionMapForPass = new Map<number, typeof allInteractions[0]>();
                    if (passInteractions.length > 0) {
                        passInteractions.forEach(interaction => {
                            // Only set cell state if the interaction is on an actual warp column
                            if (interaction.warpIdx >= 0 && interaction.warpIdx < currentNumWarps) {
                                currentRowCells[interaction.warpIdx] = interaction.isTopInteraction ? 0 : 1; // Cell state by direct click
                            }
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
                                    // Ensure warpEntities[cellWarpIdx] is valid before accessing warpSys. 
                                    // warpEntities is 0-indexed based on visual warps.
                                    const physicalWarpSystemAtCell = warpEntities[cellWarpIdx]?.warpSys ?? 0;
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

            // -- Lifting Anchor Warps for Edge Exits --
            // This sub-step handles the case where a weft exits to an edge, potentially 
            // requiring the last interacted warp to lift if it was a top interaction.
            const warpEntities = currentCanvasState.warpAndEdgeData.filter(e => e.type === 'warp'); // Ensure warpEntities is in scope
            processedRowsData.forEach(rowData => {
                const passInteractions = rowData.passObj.interactions;
                if (passInteractions.length >= 2) {
                    for (let j = 0; j < passInteractions.length - 1; j++) {
                        const current_interaction = passInteractions[j];
                        const next_interaction = passInteractions[j + 1];

                        const isActualWarp = current_interaction.warpIdx >= 0 && current_interaction.warpIdx < currentNumWarps;
                        const isEdgeNext = next_interaction.warpIdx === -1 || next_interaction.warpIdx === currentNumWarps;

                        // Determine the warp system of the current warp involved in the interaction
                        const anchorWarpSystem = isActualWarp ? (warpEntities[current_interaction.warpIdx]?.warpSys ?? -99) : -99;

                        if (isActualWarp &&
                            current_interaction.isTopInteraction === true &&
                            isEdgeNext &&
                            anchorWarpSystem === 0) {
                            // Ensure warpIdx is valid for cells array (it should be if isActualWarp is true)
                            if (rowData.cells[current_interaction.warpIdx] !== undefined) {
                                rowData.cells[current_interaction.warpIdx] = 1; // Lift anchor warp
                            }
                        }
                    }
                }
            });

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
                        const warpEntities = currentCanvasState.warpAndEdgeData.filter(e => e.type === 'warp');
                        // turnContext.turnWarpIdx is 0-indexed visual warp number
                        const physicalSystemAtTurnWarp = warpEntities[turnContext.turnWarpIdx]?.warpSys ?? 0;

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
                            const warpEntities = currentCanvasState.warpAndEdgeData.filter(e => e.type === 'warp');
                            const physicalWarpSystemAtAdjacent = warpEntities[adjacentWarpToPotentiallyLift]?.warpSys ?? 0;
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
                        const warpEntities = currentCanvasState.warpAndEdgeData.filter(e => e.type === 'warp');
                        const prevPassEndWarpPhysicalSystem = warpEntities[prevPassLastInt.warpIdx]?.warpSys ?? 0;

                        if (prevPassEndWarpPhysicalSystem < newPassEffectiveSystem) { // Prev end warp is physically higher
                            // Only attempt to set cell if prevPassLastInt.warpIdx is a valid warp index
                            if (prevPassLastInt.warpIdx >= 0 && prevPassLastInt.warpIdx < currentNumWarps) {
                                if (!hasDirectInteractionInPass(currentRowData.passObj, prevPassLastInt.warpIdx)) {
                                    currentRowData.cells[prevPassLastInt.warpIdx] = 1; // BLACK
                                }
                            }
                        }

                        // 2. Lift Intervening Warps in Current Pass
                        // (If their physical system is higher than the weft's new effective system)
                        const minWarpIdx = Math.min(prevPassLastInt.warpIdx, currentPassFirstInt.warpIdx);
                        const maxWarpIdx = Math.max(prevPassLastInt.warpIdx, currentPassFirstInt.warpIdx);

                        for (let warpIdxInBetween = minWarpIdx + 1; warpIdxInBetween < maxWarpIdx; warpIdxInBetween++) { // Strictly between
                            const warpEntitiesInner = currentCanvasState.warpAndEdgeData.filter(e => e.type === 'warp'); // Redundant filter, but for clarity
                            const physicalSystemOfWarpInBetween = warpEntitiesInner[warpIdxInBetween]?.warpSys ?? 0;
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

        // Helper Functions
        function updateSequenceNumbers(removedSequence: number) {
            // Update all sequence numbers in warpAndEdgeData
            for (let entity of canvasState.warpAndEdgeData) {
                if (entity.type === 'warp') {
                    // Process top wefts
                    for (let assignment of entity.topWeft) {
                        if (assignment.sequence > removedSequence) {
                            assignment.sequence--;
                        }
                    }
                    // Process bottom wefts
                    for (let assignment of entity.bottomWeft) {
                        if (assignment.sequence > removedSequence) {
                            assignment.sequence--;
                        }
                    }
                } else if (entity.type === 'edge') {
                    // Process edge systems
                    for (let systemArray of entity.edgeSys) {
                        for (let assignment of systemArray) {
                            if (assignment.sequence > removedSequence) {
                                assignment.sequence--;
                            }
                        }
                    }
                }
            }

            // Decrement the global counter
            canvasState.clickSequence--;
        }

        function getDotInfo(originalDotIndex: number) {
            const numLeftEdgeDots = activeWarpSystems;
            const numWarpCoreDots = numWarps * 2;

            // Check Left Edge Dots
            if (originalDotIndex < numLeftEdgeDots) {
                return {
                    idx: 0, // Left Edge entity is always at index 0 in warpAndEdgeData
                    posType: 'edgeSys',
                    warpSysId: originalDotIndex // For left edge, originalDotIndex is the system level
                };
            }
            // Check Warp Core Dots
            else if (originalDotIndex < numLeftEdgeDots + numWarpCoreDots) {
                const adjustedIndex = originalDotIndex - numLeftEdgeDots;
                const warpVisualOrder = Math.floor(adjustedIndex / 2); // 0 for 1st warp, 1 for 2nd, etc.
                const isTop = adjustedIndex % 2 === 0;
                return {
                    idx: warpVisualOrder + 1, // Warps start at index 1 in warpAndEdgeData
                    posType: isTop ? 'topWeft' : 'bottomWeft'
                    // warpSysId is not applicable for warps
                };
            }
            // Must be Right Edge Dots
            else {
                const systemLevelOnRightEdge = originalDotIndex - (numLeftEdgeDots + numWarpCoreDots);
                return {
                    idx: numWarps + 1, // Right Edge entity is at the last index
                    posType: 'edgeSys',
                    warpSysId: systemLevelOnRightEdge
                };
            }
        }

        // Bezier helper functions
        function generateUUID() {
            // Generate a simple unique ID for anchors
            return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }

        function calculateBezierControlPoints(anchors, tension = 0.16666) {
            if (!anchors || anchors.length < 1) {
                return;
            }
            if (anchors.length === 1) {
                anchors[0].cpBefore = { ...anchors[0].pos };
                anchors[0].cpAfter = { ...anchors[0].pos };
                return;
            }
            const n = anchors.length;
            for (let i = 0; i < n; i++) {
                // Always use open spline logic for p0 and p2
                const p0 = anchors[Math.max(0, i - 1)].pos;
                const p1 = anchors[i].pos;
                const p2 = anchors[Math.min(n - 1, i + 1)].pos;

                // Calculate cpAfter for p1 (current anchor at index i)
                if (i < n - 1) { // Can calculate cpAfter if not the last point
                    anchors[i].cpAfter = {
                        x: p1.x + (p2.x - p0.x) * tension,
                        y: p1.y + (p2.y - p0.y) * tension,
                    };
                } else { // Last point of an open spline
                    anchors[i].cpAfter = { ...p1 };
                }

                // Calculate cpBefore for p1 (current anchor at index i)
                if (i > 0) { // Can calculate cpBefore if not the first point
                    anchors[i].cpBefore = {
                        x: p1.x - (p2.x - p0.x) * tension,
                        y: p1.y - (p2.y - p0.y) * tension,
                    };
                } else { // First point of an open spline
                    anchors[i].cpBefore = { ...p1 };
                }
            }
            // Special handling for endpoints of open splines (this logic remains largely the same as before for !isClosed)
            if (n > 1) { // n is always > 1 here due to earlier checks
                anchors[0].cpBefore = { ...anchors[0].pos };
                anchors[0].cpAfter = {
                    x: anchors[0].pos.x + (anchors[1].pos.x - anchors[0].pos.x) * tension * 2,
                    y: anchors[0].pos.y + (anchors[1].pos.y - anchors[0].pos.y) * tension * 2
                };
                if (n === 2) {
                    anchors[0].cpAfter = { x: anchors[0].pos.x + (anchors[1].pos.x - anchors[0].pos.x) * 0.333, y: anchors[0].pos.y + (anchors[1].pos.y - anchors[0].pos.y) * 0.333 };
                }
                anchors[n - 1].cpAfter = { ...anchors[n - 1].pos };
                anchors[n - 1].cpBefore = {
                    x: anchors[n - 1].pos.x - (anchors[n - 1].pos.x - anchors[n - 2].pos.x) * tension * 2,
                    y: anchors[n - 1].pos.y - (anchors[n - 1].pos.y - anchors[n - 2].pos.y) * tension * 2
                };
                if (n === 2) {
                    anchors[n - 1].cpBefore = { x: anchors[n - 1].pos.x - (anchors[n - 1].pos.x - anchors[n - 2].pos.x) * 0.333, y: anchors[n - 1].pos.y - (anchors[n - 1].pos.y - anchors[n - 2].pos.y) * 0.333 };
                }
            }
        }

        function renderBezierPath(pathAnchors, pathWeftId, pInstance) {
            if (!pathAnchors || pathAnchors.length < 2) {
                return; // Need at least two anchors to draw a segment
            }

            // pInstance refers to the p5 instance 'p'
            pInstance.strokeWeight(3);
            pInstance.noFill();

            const baseWeftColor = pInstance.color(ACCESSIBLE_COLORS[pathWeftId % ACCESSIBLE_COLORS.length]);
            pInstance.colorMode(pInstance.HSB, 360, 100, 100);
            const baseHue = pInstance.hue(baseWeftColor);
            const baseSat = Math.min(pInstance.saturation(baseWeftColor) * 1.25, 100);
            const baseBright = pInstance.brightness(baseWeftColor) * 0.8;
            const startColor = pInstance.color(baseHue, baseSat, baseBright);
            pInstance.colorMode(pInstance.RGB, 255);

            const numSubdivisionsPerMainSegment = 15;

            for (let i = 0; i < pathAnchors.length - 1; i++) {
                const anchor1 = pathAnchors[i];
                const anchor2 = pathAnchors[i + 1];

                const p1 = anchor1.pos;
                const cp1_out = anchor1.cpAfter;
                const cp2_in = anchor2.cpBefore;
                const p2_pos = anchor2.pos;

                for (let k = 0; k < numSubdivisionsPerMainSegment; k++) {
                    const t_local0 = k / numSubdivisionsPerMainSegment;
                    const t_local1 = (k + 1) / numSubdivisionsPerMainSegment;

                    const pt_start_x = pInstance.bezierPoint(p1.x, cp1_out.x, cp2_in.x, p2_pos.x, t_local0);
                    const pt_start_y = pInstance.bezierPoint(p1.y, cp1_out.y, cp2_in.y, p2_pos.y, t_local0);
                    const pt_end_x = pInstance.bezierPoint(p1.x, cp1_out.x, cp2_in.x, p2_pos.x, t_local1);
                    const pt_end_y = pInstance.bezierPoint(p1.y, cp1_out.y, cp2_in.y, p2_pos.y, t_local1);

                    const t_avg_local = (t_local0 + t_local1) / 2;
                    const globalProgress = pathAnchors.length > 1 ? (i + t_avg_local) / (pathAnchors.length - 1) : 1;

                    const segmentColor = pInstance.lerpColor(startColor, baseWeftColor, globalProgress);
                    pInstance.stroke(segmentColor);
                    pInstance.line(pt_start_x, pt_start_y, pt_end_x, pt_end_y);
                }
            }
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