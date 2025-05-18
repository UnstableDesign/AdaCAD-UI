import { Draft, NumParam, OpParamVal, OpInput, DynamicOperation, OperationInlet, CanvasParam } from "../../model/datatypes";
import { getOpParamValById, getAllDraftsAtInlet } from "../../model/operations";
import { Sequence } from "../../model/sequence";
import { initDraftFromDrawdown } from "../../model/drafts";
// p5 import is in the parameter component

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;

const name = "cross_section_view";
const old_names = [];

// Canvas parameter - stores canvas state and configuration for the sketch
const canvasParam: CanvasParam = {
    name: 'cross_section_canvas',
    type: 'p5-canvas',
    value: {
        canvasState: {
            activeWeft: null,
            selectedDots: [], // Array of dot originalIndices
            dotFills: [],     // Array<Array<number>>: dotFills[dotOriginalIndex] = [weftId1, weftId2...]
            permanentSplines: [], // format: { weft: number, dots: number[], closed: boolean }
            warpData: [],       // format: Array<{ warpSys: number, topWeft: Array<{weft: number, sequence: number}>, bottomWeft: Array<{weft: number, sequence: number}> }>
            clickSequence: 0
        },
        config: {
            numWarps: 8,
            warpSystems: 2,
            weftSystems: 5
        },
        view: { zoom: 1.0, offsetX: 0, offsetY: 0 }
    },
    dx: 'Interactive canvas for drawing cross-section paths.'
};

// Define parameters that users can configure
const num_warps_param: NumParam = {
    name: 'Number of Warps',
    type: 'number',
    min: 1,
    max: 16,
    value: 8,
    dx: "Number of warps (width) in the cross section draft"
};

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

const params = [canvasParam, num_warps_param, warp_systems_param, weft_systems_param];

const inlets = [];

// Main perform function - placeholder for now
const perform = (op_params: Array<OpParamVal>, op_inputs: Array<OpInput>): Promise<Array<Draft>> => {
    console.log("perform called with params:", op_params);
    
    const num_warps_val = getOpParamValById(1, op_params); // Index of num_warps_param

    let pattern = new Sequence.TwoD();
    let row = new Sequence.OneD();
    row.pushMultiple(0, num_warps_val); // Create a blank row with the specified number of warps
    pattern.pushWeftSequence(row.val());

    let d = initDraftFromDrawdown(pattern.export());
    // System/shuttle mappings can be minimal or omitted if not meaningful for blank draft
    d.colSystemMapping = Array(num_warps_val).fill(0);
    d.rowSystemMapping = [0];
    d.colShuttleMapping = Array(num_warps_val).fill(0);
    d.rowShuttleMapping = [0];

    return Promise.resolve([d]);
};

// Generate a meaningful name for the operation result
const generateName = (param_vals: Array<OpParamVal>, op_inputs: Array<OpInput>): string => {
    const num_warps_val: number = getOpParamValById(1, param_vals); // Index of num_warps_param
    return 'cross section ' + num_warps_val + 'x1';
};

const onParamChange = (param_vals: Array<OpParamVal>, inlets: Array<OperationInlet>, inlet_vals: Array<any>, changed_param_id: number, changed_param_single_value: any): Array<any> => {
    return inlet_vals; // Return unmodified inlets as per standard dynamic op requirements
};

// p5.js sketch creator function
const createSketch = (param: any, updateCallback: Function) => {
    return (p: any) => {
        const ACCESSIBLE_COLORS = [
            "#F4A7B9", "#A7C7E7", "#C6E2E9", "#FAD6A5", "#D5AAFF", "#B0E57C",
            "#FFD700", "#FFB347", "#87CEFA", "#E6E6FA", "#FFE4E1", "#C1F0F6"
        ];
        const SKETCH_TOP_MARGIN = 140; // from dev.js topMargin
        const SKETCH_LEFT_MARGIN = 60; // from dev.js leftMargin
        const SKETCH_CANVAS_WIDTH = CANVAS_WIDTH; // AdaCAD op constant
        const SKETCH_CANVAS_HEIGHT = CANVAS_HEIGHT; // AdaCAD op constant

        // ---- Local state mirrored from param and dev.js globals ----
        let localConfig = JSON.parse(JSON.stringify(param.value.config || { numWarps: 8, warpSystems: 2, weftSystems: 5 }));
        let { numWarps, warpSystems, weftSystems } = localConfig;

        // Initialize canvasState ensuring all fields from dev.js are present
        const initialCanvasState = {
            activeWeft: null,
            selectedDots: [],
            dotFills: [],
            permanentSplines: [],
            warpData: [],
            clickSequence: 0,
            ...param.value.canvasState // Spread potentially pre-existing state
        };
        // Ensure dotFills is initialized correctly if not present or not an array (e.g. from old state)
        if (!Array.isArray(initialCanvasState.dotFills)) initialCanvasState.dotFills = [];


        let localCanvasState = JSON.parse(JSON.stringify(initialCanvasState));
        // Destructure for direct use in sketch logic, mirroring dev.js variables
        let { activeWeft, selectedDots, dotFills, permanentSplines, warpData, clickSequence } = localCanvasState;

        let currentSpline = []; // Equivalent to currentSpline in dev.js, for active drawing
        let calculatedWarpDots = []; // Calculated positions, not part of saved state. {x, y, originalIndex, warpColumn}

        // ---- Helper to send state updates back to AdaCAD ----
        const callUpdate = () => {
            // Pack back destructured variables into localCanvasState before sending
            localCanvasState = { activeWeft, selectedDots, dotFills, permanentSplines, warpData, clickSequence };
            const newState = {
                canvasState: JSON.parse(JSON.stringify(localCanvasState)), // Deep copy
                config: JSON.parse(JSON.stringify(localConfig)),       // Deep copy
                view: JSON.parse(JSON.stringify(param.value.view || { zoom: 1.0, offsetX: 0, offsetY: 0 }))
            };
            updateCallback(newState);
        };

        // ---- Functions ported and adapted from dev.js ----
        const initializeWarpDataAndDots = () => {
            warpData = [];
            clickSequence = 0;
            selectedDots = []; // Reset from dev.js's resetCanvas
            dotFills = [];     // Reset from dev.js's resetCanvas
            currentSpline = []; // Reset from dev.js's resetCanvas
            permanentSplines = [];// Reset from dev.js's resetCanvas
            activeWeft = null;   // Reset from dev.js's resetCanvas

            // Calculate warp dot positions (part of dev.js drawWarpLines)
            calculatedWarpDots = [];
            let spacingX = (SKETCH_CANVAS_WIDTH - SKETCH_LEFT_MARGIN) / (numWarps + 1);
            let spacingY = (SKETCH_CANVAS_HEIGHT - SKETCH_TOP_MARGIN) / (warpSystems + 1);

            for (let i = 0; i < numWarps; i++) {
                let x = SKETCH_LEFT_MARGIN + spacingX * (i + 1);
                let warpRowForVisual = i % warpSystems; // For the central visual dot
                let y_visual_center = SKETCH_TOP_MARGIN + spacingY * (warpRowForVisual + 1);

                // Add top and bottom interaction dots for this warp column
                calculatedWarpDots.push({ x: x, y: y_visual_center - 20, originalIndex: i * 2, warpColumn: i });
                dotFills.push([]); // Initialize fill array for the top dot
                calculatedWarpDots.push({ x: x, y: y_visual_center + 20, originalIndex: i * 2 + 1, warpColumn: i });
                dotFills.push([]); // Initialize fill array for the bottom dot

                // Initialize warpData entry
                warpData.push({
                    warpSys: i % warpSystems, // System this warp belongs to visually
                    topWeft: [],
                    bottomWeft: []
                });
            }
            console.log("Initialized warpData:", JSON.parse(JSON.stringify(warpData)));
            console.log("Initialized dotFills:", JSON.parse(JSON.stringify(dotFills)));
        };

        const getDotInfo = (dotOriginalIndex: number) => {
            return {
                warpIdx: Math.floor(dotOriginalIndex / 2), // The column index of the warp
                isTop: dotOriginalIndex % 2 === 0
            };
        };

        const updateSequenceNumbers = (removedSequence: number) => {
            for (let warp of warpData) {
                warp.topWeft = warp.topWeft.map(assignment => {
                    if (assignment.sequence > removedSequence) {
                        return { ...assignment, sequence: assignment.sequence - 1 };
                    }
                    return assignment;
                }).filter(a => a.sequence != null); // clean up if needed
                warp.bottomWeft = warp.bottomWeft.map(assignment => {
                    if (assignment.sequence > removedSequence) {
                        return { ...assignment, sequence: assignment.sequence - 1 };
                    }
                    return assignment;
                }).filter(a => a.sequence != null); // clean up if needed
            }
            if (clickSequence > 0) clickSequence--;
            // console.log("Updated sequence numbers, new clickSequence:", clickSequence, "warpData:", JSON.parse(JSON.stringify(warpData)));
        };

        const resetSketchFull = () => { // Corresponds to resetCanvas in dev.js
            initializeWarpDataAndDots(); // This resets most state variables
            // activeWeft is reset inside initializeWarpDataAndDots
            p.noLoop(); // As per dev.js resetCanvas calling redraw (which implies setup's noLoop if activeWeft is null)
            callUpdate();
            p.redraw();
        };


        // ---- P5.js Sketch Implementation ----
        p.setup = () => {
            p.createCanvas(SKETCH_CANVAS_WIDTH, SKETCH_CANVAS_HEIGHT);
            p.textSize(14);
            initializeWarpDataAndDots(); // Initial setup of data structures and dot positions
            if (activeWeft === null) { // Match dev.js behavior
                p.noLoop();
            }
            p.redraw();
        };

        p.draw = () => {
            p.background(255);
            drawWarpLines();
            drawWeftDots();
            drawWarpInteractionDots(); // Renamed from drawWarpDots in dev.js for clarity
            drawPermanentSplines();
            drawStickySpline(); // (drawTemporaryActiveSpline)
            drawResetButton(); // Draw the reset button
        };

        const drawWarpLines = () => {
            let spacingX = (SKETCH_CANVAS_WIDTH - SKETCH_LEFT_MARGIN) / (numWarps + 1);
            let spacingY = (SKETCH_CANVAS_HEIGHT - SKETCH_TOP_MARGIN) / (warpSystems + 1);

            for (let i = 0; i < numWarps; i++) {
                let x = SKETCH_LEFT_MARGIN + spacingX * (i + 1);
                p.stroke(0);
                p.strokeWeight(1);
                p.line(x, SKETCH_TOP_MARGIN, x, SKETCH_CANVAS_HEIGHT); // Vertical warp line

                let warpRowForVisual = i % warpSystems;
                let y_visual_center = SKETCH_TOP_MARGIN + spacingY * (warpRowForVisual + 1);
                p.noStroke();
                p.fill(50);
                p.ellipse(x, y_visual_center, 18, 18); // Central visual dot for the warp
            }
        };

        const drawWeftDots = () => {
            let spacing = (SKETCH_CANVAS_HEIGHT - SKETCH_TOP_MARGIN) / (weftSystems + 1);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(16);
            for (let i = 0; i < weftSystems; i++) {
                let y = SKETCH_TOP_MARGIN + spacing * (i + 1);
                let weftColor = ACCESSIBLE_COLORS[i % ACCESSIBLE_COLORS.length];
                p.fill(weftColor);
                p.stroke(activeWeft === i ? 80 : 200);
                p.strokeWeight(activeWeft === i ? 2 : 1);
                p.ellipse(SKETCH_LEFT_MARGIN / 2, y, 24, 24);
                p.fill(0);
                p.noStroke();
                p.text(String.fromCharCode(97 + i), SKETCH_LEFT_MARGIN / 2, y);
            }
        };

        const drawWarpInteractionDots = () => { // Was drawWarpDots in dev.js
            for (let i = 0; i < calculatedWarpDots.length; i++) {
                let dot = calculatedWarpDots[i];
                // dotFills is Array<Array<number>>, indexed by originalIndex
                const fillsForThisDot = dotFills[dot.originalIndex] || [];

                if (selectedDots.includes(dot.originalIndex) && fillsForThisDot.length > 0) {
                    p.fill(ACCESSIBLE_COLORS[fillsForThisDot[0] % ACCESSIBLE_COLORS.length]);
                    p.stroke(0);
                } else {
                    p.fill(255);
                    p.stroke(180);
                }
                p.strokeWeight(1);
                p.ellipse(dot.x, dot.y, 12, 12);

                for (let r = 1; r < fillsForThisDot.length; r++) {
                    p.noFill();
                    p.stroke(ACCESSIBLE_COLORS[fillsForThisDot[r] % ACCESSIBLE_COLORS.length]);
                    p.strokeWeight(2);
                    p.ellipse(dot.x, dot.y, 14 + r * 4, 14 + r * 4);
                }
            }
        };

        const drawPermanentSplines = () => {
            for (let spline of permanentSplines) {
                if (spline.dots.length < 1) continue; // Safeguard
                p.stroke(ACCESSIBLE_COLORS[spline.weft % ACCESSIBLE_COLORS.length]);
                p.strokeWeight(3);
                p.noFill();

                let points = [];
                for (let i = 0; i < spline.dots.length; i++) {
                    let dot = calculatedWarpDots[spline.dots[i]]; // Use originalIndex to find dot in calculatedWarpDots
                    if (!dot) continue; // Safeguard
                    points.push({ x: dot.x, y: dot.y });
                    // dev.js spline curve adjustment logic (removed for direct port, can be added back if necessary)
                }

                if (points.length < 2) { // If only one point, draw nothing or a single dot marker if desired. dev.js does not draw.
                    if (points.length === 1 && spline.closed) { // dev.js draws line from point to itself if closed with 1 dot
                        // p.ellipse(points[0].x, points[0].y, 5,5); // example for single dot viz
                    }
                    continue;
                }

                if (points.length < 3 || spline.closed) { // dev.js: handles 2 points with line, or closed splines with lines
                    for (let j = 0; j < points.length - 1; j++) {
                        p.line(points[j].x, points[j].y, points[j + 1].x, points[j + 1].y);
                    }
                    if (spline.closed && points.length > 0) { // Ensure closing line is drawn for closed splines.
                        // dev.js connects last to first if closed and has points
                        p.line(points[points.length - 1].x, points[points.length - 1].y, points[0].x, points[0].y);
                    }
                } else { // Open splines with 3+ points are drawn as curves in dev.js
                    p.beginShape();
                    p.curveVertex(points[0].x, points[0].y); // Repeat first for Catmull-Rom
                    for (let pt of points) {
                        p.curveVertex(pt.x, pt.y);
                    }
                    p.curveVertex(points[points.length - 1].x, points[points.length - 1].y); // Repeat last
                    p.endShape();
                }
            }
        };

        const drawStickySpline = () => { // drawTemporaryActiveSpline
            if (currentSpline.length > 0 && activeWeft !== null) {
                let lastDotOriginalIndex = currentSpline[currentSpline.length - 1];
                let lastDot = calculatedWarpDots[lastDotOriginalIndex];
                if (lastDot) {
                    p.stroke(ACCESSIBLE_COLORS[activeWeft % ACCESSIBLE_COLORS.length]);
                    p.strokeWeight(2);
                    p.line(lastDot.x, lastDot.y, p.mouseX, p.mouseY);
                }
            }
        };

        const resetButton = { x: 10, y: 10, w: 80, h: 30, label: "Reset" };
        const drawResetButton = () => {
            const isOver = p.mouseX > resetButton.x && p.mouseX < resetButton.x + resetButton.w &&
                p.mouseY > resetButton.y && p.mouseY < resetButton.y + resetButton.h;
            p.fill(isOver ? 200 : 220);
            p.stroke(180);
            p.rect(resetButton.x, resetButton.y, resetButton.w, resetButton.h, 5);
            p.fill(0);
            p.noStroke();
            p.textAlign(p.CENTER, p.CENTER);
            p.text(resetButton.label, resetButton.x + resetButton.w / 2, resetButton.y + resetButton.h / 2);
        };

        p.mousePressed = () => {
            let clickedOnUIElement = false; // Flag to prevent deselection if UI is hit

            // Check reset button first
            if (p.mouseX > resetButton.x && p.mouseX < resetButton.x + resetButton.w &&
                p.mouseY > resetButton.y && p.mouseY < resetButton.y + resetButton.h) {
                resetSketchFull();
                clickedOnUIElement = true; // Technically UI, but handled.
                return; // Full reset, no further processing.
            }

            // Weft selector clicks
            let weftSpacing = (SKETCH_CANVAS_HEIGHT - SKETCH_TOP_MARGIN) / (weftSystems + 1);
            for (let i = 0; i < weftSystems; i++) {
                let y = SKETCH_TOP_MARGIN + weftSpacing * (i + 1);
                if (p.dist(p.mouseX, p.mouseY, SKETCH_LEFT_MARGIN / 2, y) < 12) { // 12 is radius of weft dot
                    if (activeWeft === i) {
                        activeWeft = null;
                        currentSpline = [];
                        p.noLoop();
                    } else {
                        activeWeft = i;
                        currentSpline = [];
                        p.loop();
                    }
                    clickedOnUIElement = true;
                    callUpdate();
                    p.redraw();
                    return;
                }
            }

            // Warp dot clicks
            if (activeWeft !== null) {
                for (let i = 0; i < calculatedWarpDots.length; i++) { // i is the originalIndex
                    let dot = calculatedWarpDots[i];
                    if (p.dist(p.mouseX, p.mouseY, dot.x, dot.y) < 10) { // Clicked on a warp dot (radius 6, hit area 10)
                        const dotOriginalIndex = i; // In dev.js, i is the direct index into warpDots
                        const { warpIdx, isTop } = getDotInfo(dotOriginalIndex);

                        if (!warpData[warpIdx]) {
                            console.error("warpData missing for warpIdx:", warpIdx, "dotOriginalIndex:", dotOriginalIndex); return;
                        }
                        const weftArray = isTop ? warpData[warpIdx].topWeft : warpData[warpIdx].bottomWeft;

                        // REMOVING a weft assignment
                        if (selectedDots.includes(dotOriginalIndex) && (dotFills[dotOriginalIndex] || []).includes(activeWeft)) {
                            dotFills[dotOriginalIndex] = (dotFills[dotOriginalIndex] || []).filter(w => w !== activeWeft);
                            if ((dotFills[dotOriginalIndex] || []).length === 0) {
                                selectedDots = selectedDots.filter(idx => idx !== dotOriginalIndex);
                            }

                            const weftAssignmentIndex = weftArray.findIndex(item => item.weft === activeWeft);
                            if (weftAssignmentIndex !== -1) {
                                const removedSequence = weftArray[weftAssignmentIndex].sequence;
                                weftArray.splice(weftAssignmentIndex, 1);
                                updateSequenceNumbers(removedSequence);
                            }

                            permanentSplines = permanentSplines.map(spline => {
                                if (spline.weft === activeWeft) {
                                    return { ...spline, dots: spline.dots.filter(idx => idx !== dotOriginalIndex) };
                                }
                                return spline;
                            }).filter(spline => spline.dots.length >= (spline.closed ? 1 : 2)); // keep splines with enough points

                            currentSpline = currentSpline.filter(idx => idx !== dotOriginalIndex);
                            console.log(`Removed weft ${activeWeft} from dot ${dotOriginalIndex}, warpData:`, JSON.parse(JSON.stringify(warpData)));
                        }
                        // ADDING a weft assignment or starting/continuing/closing a spline
                        else {
                            if (!selectedDots.includes(dotOriginalIndex)) {
                                selectedDots.push(dotOriginalIndex);
                                // Ensure dotFills[dotOriginalIndex] is an array before pushing
                                if (!Array.isArray(dotFills[dotOriginalIndex])) dotFills[dotOriginalIndex] = [];
                                dotFills[dotOriginalIndex].push(activeWeft); // First fill for this dot with activeWeft

                                weftArray.push({ weft: activeWeft, sequence: clickSequence });
                                clickSequence++;
                            } else if (!(dotFills[dotOriginalIndex] || []).includes(activeWeft)) {
                                // Ensure dotFills[dotOriginalIndex] is an array
                                if (!Array.isArray(dotFills[dotOriginalIndex])) dotFills[dotOriginalIndex] = [];
                                dotFills[dotOriginalIndex].push(activeWeft); // Subsequent fill, different weft

                                weftArray.push({ weft: activeWeft, sequence: clickSequence });
                                clickSequence++;
                            } else if ((dotFills[dotOriginalIndex] || []).includes(activeWeft) && currentSpline.length === 0) {
                                // Case from dev.js: dot is already assigned this weft, start a new spline drawing from here
                                currentSpline = [dotOriginalIndex];
                                p.loop(); // ensure draw updates for sticky line
                            }

                            // Spline segment creation logic from dev.js
                            if (currentSpline.length > 0 && currentSpline[currentSpline.length - 1] !== dotOriginalIndex) { // if currentSpline has a start and we clicked a new dot
                                let prev = currentSpline[currentSpline.length - 1];
                                // Find if there's an existing open spline for this weft
                                let existingOpenSpline = permanentSplines.find(s => s.weft === activeWeft && !s.closed);
                                if (existingOpenSpline) {
                                    existingOpenSpline.dots.push(dotOriginalIndex);
                                } else {
                                    permanentSplines.push({ weft: activeWeft, dots: [prev, dotOriginalIndex], closed: false });
                                }
                            }

                            // Spline closing logic from dev.js
                            if (currentSpline.length > 0 && currentSpline[0] === dotOriginalIndex && currentSpline.length > 1) { // Clicked on the first dot of the current spline (and it has at least one segment)
                                let splineToClose = permanentSplines.find(s => s.weft === activeWeft && !s.closed && s.dots[0] === currentSpline[0]);
                                if (splineToClose) {
                                    if (splineToClose.dots[splineToClose.dots.length - 1] !== dotOriginalIndex) { // if the closing point wasn't the last one added
                                        splineToClose.dots.push(dotOriginalIndex);
                                    }
                                    splineToClose.closed = true;
                                } else { // This handles if currentSpline was like [A,B] and then A is clicked.
                                    // We need to ensure that a permanentSpline corresponding to currentSpline exists or is created.
                                    // The segment adding logic above might have already done this.
                                    // If currentSpline was [A,B,C] and A is clicked, it should close A-B-C-A
                                    // Let's re-check the last open spline, or create one based on currentSpline.
                                    let lastOpenSpline = permanentSplines.length > 0 ? permanentSplines[permanentSplines.length - 1] : null;
                                    if (lastOpenSpline && lastOpenSpline.weft === activeWeft && !lastOpenSpline.closed) {
                                        if (lastOpenSpline.dots[lastOpenSpline.dots.length - 1] !== dotOriginalIndex) lastOpenSpline.dots.push(dotOriginalIndex);
                                        lastOpenSpline.closed = true;
                                    } else { // currentSpline has points, but no matching open permSpline, create a new closed one.
                                        let newSplineDots = [...currentSpline];
                                        if (newSplineDots[newSplineDots.length - 1] !== dotOriginalIndex) newSplineDots.push(dotOriginalIndex); else if (newSplineDots.length === 1) newSplineDots.push(dotOriginalIndex); //for single point closed spline [A,A]
                                        permanentSplines.push({ weft: activeWeft, dots: newSplineDots, closed: true });
                                    }
                                }
                                currentSpline = [];
                                activeWeft = null;
                                p.noLoop();
                            } else if (!((dotFills[dotOriginalIndex] || []).includes(activeWeft) && currentSpline.length === 0 && currentSpline[0] === dotOriginalIndex)) { // if not starting on existing and closing immediately
                                // If not closing, and not the special case of starting on an existing dot (which already sets currentSpline)
                                // Add current dot to currentSpline (if it's not already the last one)
                                if (currentSpline.length === 0 || currentSpline[currentSpline.length - 1] !== dotOriginalIndex) {
                                    currentSpline.push(dotOriginalIndex);
                                }
                                if (currentSpline.length === 1) p.loop(); // ensure draw updates for sticky line if we just started
                            }
                            console.log(`Added/updated weft ${activeWeft} to dot ${dotOriginalIndex}, currentSpline: ${JSON.stringify(currentSpline)}, permanentSplines: ${JSON.stringify(permanentSplines)}`);
                            console.log(`warpData:`, JSON.parse(JSON.stringify(warpData)));
                        }
                        clickedOnUIElement = true;
                        callUpdate();
                        p.redraw();
                        return; // Processed dot click
                    }
                }
            }

            // Clicked outside interactive elements
            if (!clickedOnUIElement && activeWeft !== null) {
                currentSpline = []; // Clear current drawing spline
                activeWeft = null;  // Deselect weft
                p.noLoop();
                callUpdate();
                p.redraw();
            }
        };

        // ---- AdaCAD Specific: Handle updates from outside the sketch ----
        p.updateWithNewProps = (newParam) => {
            const newConfig = newParam.value.config;
            const newCanvasState = newParam.value.canvasState;
            let configChanged = false;

            if (localConfig.numWarps !== newConfig.numWarps ||
                localConfig.warpSystems !== newConfig.warpSystems ||
                localConfig.weftSystems !== newConfig.weftSystems) {

                console.log("Config changed. Old:", localConfig, "New:", newConfig);
                localConfig = JSON.parse(JSON.stringify(newConfig));
                ({ numWarps, warpSystems, weftSystems } = localConfig);
                configChanged = true;
                // Full re-initialization if config changes, similar to dev.js updateValues -> resetCanvas
                initializeWarpDataAndDots();
            }

            // Update local canvas state if it has changed externally (e.g. undo/redo, load)
            // This should overwrite the sketch's current state with the new one.
            // Ensure all fields are copied.
            const updatedStateFromParams = {
                activeWeft: null, selectedDots: [], dotFills: [], permanentSplines: [], warpData: [], clickSequence: 0,
                ...newCanvasState
            };
            if (!Array.isArray(updatedStateFromParams.dotFills)) updatedStateFromParams.dotFills = [];


            // Only update if not a config change (which already resets state)
            // Or if specifically the state is different (e.g. undo/redo)
            if (!configChanged && JSON.stringify(localCanvasState) !== JSON.stringify(updatedStateFromParams)) {
                console.log("Canvas state updated externally.");
                localCanvasState = JSON.parse(JSON.stringify(updatedStateFromParams));
                ({ activeWeft, selectedDots, dotFills, permanentSplines, warpData, clickSequence } = localCanvasState);
                // If dotFills or warpData structure is critical and might be malformed from an old state, validate/re-initialize here.
                // For now, assume newCanvasState is valid.
                if (!Array.isArray(dotFills)) dotFills = []; // re-ensure
                while (dotFills.length < numWarps * 2) dotFills.push([]); // ensure dotFills has enough empty arrays


                // Recalculate visual dots as numWarps might be part of canvasState in some scenarios (though config is source of truth)
                // But primarily, ensure calculatedWarpDots is up-to-date if anything that affects it changed.
                // Config change already handles this via initializeWarpDataAndDots.
            }

            // Ensure drawing loop is active if a weft is selected
            if (activeWeft !== null) p.loop(); else p.noLoop();

            console.log("updateWithNewProps done. activeWeft:", activeWeft, "currentSpline:", currentSpline);
            callUpdate(); // Reflect any state absorption.
            p.redraw();
        };
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
    dynamic_param_id: [1, 2, 3], // Indices of num_warps, warp_systems, weft_systems
    dynamic_param_type: 'null',
    onParamChange,
    createSketch
};