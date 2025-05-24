import { Draft, NumParam, OpParamVal, OpInput, DynamicOperation, OperationInlet, CanvasParam } from "../../model/datatypes";
import { getOpParamValById, getAllDraftsAtInlet } from "../../model/operations";
import { Sequence } from "../../model/sequence";
import { initDraftFromDrawdown } from "../../model/drafts";
// p5 import is in the parameter component

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;

const name = "cross_section_view";
const old_names = [];
const dynamic_param_id = [1, 2, 3]; // Indices of num_warps, warp_systems, weft_systems;
const dynamic_param_type = 'null';

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
            warpData: [],       // format: Array<{ warpSys: number, topWeft: Array<{weft: number, sequence: number, pathId: number}>, bottomWeft: Array<{weft: number, sequence: number, pathId: number}> }>
            clickSequence: 0,
            currentPathId: 0
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
    // console.log("perform called with params:", op_params);

    // Step 1: Data Preparation
    // 1.1: Retrieve Inputs
    if (!op_params || op_params.length === 0 || !op_params[0] || !op_params[0].val) {
        console.error("CrossSectionView: Invalid op_params received.");
        // Return a very basic default draft if params are malformed
        const emptyPattern = new Sequence.TwoD();
        emptyPattern.pushWeftSequence(new Sequence.OneD([0]).val()); // 1x1 white cell
        return Promise.resolve([initDraftFromDrawdown(emptyPattern.export())]);
    }

    const canvasParamContainer = op_params[0];
    const canvasParamValue = canvasParamContainer.val;

    if (!canvasParamValue || !canvasParamValue.canvasState || !canvasParamValue.config) {
        console.error("CrossSectionView: canvasState or config is missing.");
        const emptyPattern = new Sequence.TwoD();
        emptyPattern.pushWeftSequence(new Sequence.OneD([0]).val());
        return Promise.resolve([initDraftFromDrawdown(emptyPattern.export())]);
    }

    const canvasState = canvasParamValue.canvasState;
    const config = canvasParamValue.config;
    const numWarps: number = config.numWarps;
    const warpData: Array<{ warpSys: number, topWeft: Array<{ weft: number, sequence: number, pathId: number }>, bottomWeft: Array<{ weft: number, sequence: number, pathId: number }> }> = canvasState.warpData || [];

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

        // For Issue 3 Fix & robust Issue 1 handling: Re-derive colSystemMapping directly from config for a truly blank state.
        d.colSystemMapping = [];
        const currentWarpSystems = config.warpSystems > 0 ? config.warpSystems : 1;
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
        const SKETCH_TOP_MARGIN = 60;
        const SKETCH_LEFT_MARGIN = 60;
        const SKETCH_CANVAS_WIDTH = CANVAS_WIDTH; // AdaCAD op constant
        const SKETCH_CANVAS_HEIGHT = CANVAS_HEIGHT; // AdaCAD op constant

        // Hover function variables
        let hoveredDotIndex = -1;
        let showDeleteButton = false;
        let deleteButtonBounds = null;

        // ---- Local state mirrored from param ----
        let localConfig = JSON.parse(JSON.stringify(param.value.config || { numWarps: 8, warpSystems: 2, weftSystems: 5 }));
        let { numWarps, warpSystems, weftSystems } = localConfig;

        // Initialize canvasState ensuring all fields are present
        const initialCanvasState = {
            activeWeft: null,
            selectedDots: [],
            dotFills: [],
            permanentSplines: [],
            warpData: [],
            clickSequence: 0,
            currentPathId: 0,
            ...param.value.canvasState // Spread potentially pre-existing state
        };
        // Ensure dotFills is initialized correctly if not present or not an array (e.g. from old state)
        if (!Array.isArray(initialCanvasState.dotFills)) initialCanvasState.dotFills = [];


        let localCanvasState = JSON.parse(JSON.stringify(initialCanvasState));
        // Destructure for direct use in sketch logic
        let { activeWeft, selectedDots, dotFills, permanentSplines, warpData, clickSequence, currentPathId } = localCanvasState;

        let currentSpline = [];
        let calculatedWarpDots = []; // Calculated positions, not part of saved state. {x, y, originalIndex, warpColumn}

        // ---- Helper to send state updates back to AdaCAD ----
        const callUpdate = () => {
            // Pack back destructured variables into localCanvasState before sending
            localCanvasState = { activeWeft, selectedDots, dotFills, permanentSplines, warpData, clickSequence, currentPathId };
            const newState = {
                canvasState: JSON.parse(JSON.stringify(localCanvasState)), // Deep copy
                config: JSON.parse(JSON.stringify(localConfig)),       // Deep copy
                view: JSON.parse(JSON.stringify(param.value.view || { zoom: 1.0, offsetX: 0, offsetY: 0 }))
            };
            updateCallback(newState);
        };

        const initializeWarpDataAndDots = () => {
            warpData = [];
            clickSequence = 0;
            selectedDots = [];
            dotFills = [];
            currentSpline = [];
            permanentSplines = [];
            activeWeft = null;
            currentPathId = 0;
            hoveredDotIndex = -1;
            showDeleteButton = false;
            deleteButtonBounds = null;

            // Calculate warp dot positions
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
        };

        const resetSketchFull = () => {
            initializeWarpDataAndDots(); // This resets most state variables
            // activeWeft is reset inside initializeWarpDataAndDots
            p.noLoop();
            callUpdate();
            p.redraw();
        };


        // ---- P5.js Sketch Implementation ----
        p.setup = () => {
            p.createCanvas(SKETCH_CANVAS_WIDTH, SKETCH_CANVAS_HEIGHT);
            p.textSize(14);
            initializeWarpDataAndDots(); // Initial setup of data structures and dot positions
            callUpdate(); // Ensure initial state is propagated
            if (activeWeft === null) {
                p.noLoop();
            }
            p.redraw();
        };

        p.draw = () => {
            p.background(255);
            drawWarpLines();
            drawWeftDots();
            drawWarpInteractionDots();
            drawPermanentSplines();
            drawStickySpline();
            drawResetButton();
            drawDeleteButton();
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

        const drawWarpInteractionDots = () => {
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

        const drawDeleteButton = () => {
            if (showDeleteButton && hoveredDotIndex >= 0 && deleteButtonBounds) {
                // Draw delete button background
                p.fill(255, 100, 100);
                p.stroke(200, 50, 50);
                p.strokeWeight(1);
                p.rect(deleteButtonBounds.x, deleteButtonBounds.y, deleteButtonBounds.w, deleteButtonBounds.h, 2);

                // Draw X
                p.stroke(255);
                p.strokeWeight(2);
                let padding = 3;
                p.line(
                    deleteButtonBounds.x + padding,
                    deleteButtonBounds.y + padding,
                    deleteButtonBounds.x + deleteButtonBounds.w - padding,
                    deleteButtonBounds.y + deleteButtonBounds.h - padding
                );
                p.line(
                    deleteButtonBounds.x + deleteButtonBounds.w - padding,
                    deleteButtonBounds.y + padding,
                    deleteButtonBounds.x + padding,
                    deleteButtonBounds.y + deleteButtonBounds.h - padding
                );
            }
        }

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
                }

                if (points.length < 2) { // If only one point, draw nothing or a single dot marker if desired.
                    if (points.length === 1 && spline.closed) {
                        // p.ellipse(points[0].x, points[0].y, 5,5); // example for single dot viz
                    }
                    continue;
                }

                if (points.length < 3 || spline.closed) { // Handles 2 points with line, or closed splines with lines
                    for (let j = 0; j < points.length - 1; j++) {
                        p.line(points[j].x, points[j].y, points[j + 1].x, points[j + 1].y);
                    }
                    if (spline.closed && points.length > 0) { // Ensure closing line is drawn for closed splines.
                        p.line(points[points.length - 1].x, points[points.length - 1].y, points[0].x, points[0].y);
                    }
                } else { // Open splines with 3+ points are drawn as curves
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

        p.mouseMoved = () => {
            let previousHoveredDot = hoveredDotIndex;
            let previousShowDelete = showDeleteButton;

            // First check if we're hovering over the delete button itself
            if (deleteButtonBounds &&
                p.mouseX >= deleteButtonBounds.x - 2 && p.mouseX <= deleteButtonBounds.x + deleteButtonBounds.w + 2 &&
                p.mouseY >= deleteButtonBounds.y - 2 && p.mouseY <= deleteButtonBounds.y + deleteButtonBounds.h + 2) {
                // Keep the delete button visible when hovering over it
                p.cursor(p.HAND);
                return;
            }

            hoveredDotIndex = -1;
            showDeleteButton = false;
            deleteButtonBounds = null;

            // Check if hovering over any dot
            for (let i = 0; i < calculatedWarpDots.length; i++) {
                let dot = calculatedWarpDots[i];
                if (p.dist(p.mouseX, p.mouseY, dot.x, dot.y) < 10) {
                    hoveredDotIndex = i;

                    // Only show delete button if:
                    // 1. No active weft is selected (not actively drawing)
                    // 2. The dot has at least one weft assigned
                    if (activeWeft === null && dotFills[i].length > 0) {
                        showDeleteButton = true;
                        // Position delete button to the top-right of the dot
                        deleteButtonBounds = {
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
            if (previousHoveredDot !== hoveredDotIndex || previousShowDelete !== showDeleteButton) {
                p.redraw();
            }

            // Update cursor
            if (showDeleteButton && deleteButtonBounds &&
                p.mouseX >= deleteButtonBounds.x && p.mouseX <= deleteButtonBounds.x + deleteButtonBounds.w &&
                p.mouseY >= deleteButtonBounds.y && p.mouseY <= deleteButtonBounds.y + deleteButtonBounds.h) {
                p.cursor(p.HAND);
            } else if (hoveredDotIndex >= 0) {
                p.cursor(p.HAND);
            } else {
                p.cursor(p.ARROW);
            }
        }

        p.mousePressed = () => {
            let clickedOnUIElement = false; // Flag to prevent deselection if UI is hit

            // Check reset button first
            if (p.mouseX > resetButton.x && p.mouseX < resetButton.x + resetButton.w &&
                p.mouseY > resetButton.y && p.mouseY < resetButton.y + resetButton.h) {
                // Reset button clicked
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
                        currentPathId++; // Path ended
                        p.noLoop();
                    } else {
                        activeWeft = i;
                        currentSpline = [];
                        currentPathId++; // New path started
                        p.loop();
                    }
                    clickedOnUIElement = true;
                    callUpdate();
                    p.redraw();
                    return;
                }
            }

            // Check delete button click
            if (showDeleteButton && deleteButtonBounds && activeWeft === null) {
                if (p.mouseX >= deleteButtonBounds.x && p.mouseX <= deleteButtonBounds.x + deleteButtonBounds.w &&
                    p.mouseY >= deleteButtonBounds.y && p.mouseY <= deleteButtonBounds.y + deleteButtonBounds.h) {
                    // Delete the most recent weft from the hovered dot
                    let i = hoveredDotIndex;
                    const { warpIdx, isTop } = getDotInfo(i);
                    const weftArray = isTop ? warpData[warpIdx].topWeft : warpData[warpIdx].bottomWeft;

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
                        const weftIndex = dotFills[i].indexOf(weftToRemove);
                        if (weftIndex !== -1) {
                            dotFills[i].splice(weftIndex, 1);
                        }

                        if (dotFills[i].length === 0) {
                            dotFills[i] = [];
                            selectedDots = selectedDots.filter(idx => idx !== i);
                        }

                        // Remove from warpData
                        const removedSequence = weftArray[mostRecentIndex].sequence;
                        weftArray.splice(mostRecentIndex, 1);
                        updateSequenceNumbers(removedSequence);

                        // Update splines
                        permanentSplines = permanentSplines.map(spline => {
                            if (spline.weft === weftToRemove) {
                                return { ...spline, dots: spline.dots.filter(idx => idx !== i) };
                            }
                            return spline;
                        }).filter(spline => spline.dots.length >= 2);

                        console.log(`Deleted weft ${weftToRemove} from dot ${i}, updated warpData:`, JSON.parse(JSON.stringify(warpData)));
                    }

                    // Reset hover state
                    showDeleteButton = false;
                    hoveredDotIndex = -1;
                    deleteButtonBounds = null;

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
                        const dotOriginalIndex = i;
                        const { warpIdx, isTop } = getDotInfo(dotOriginalIndex);

                        if (!warpData[warpIdx]) {
                            console.error("warpData missing for warpIdx:", warpIdx, "dotOriginalIndex:", dotOriginalIndex); return;
                        }
                        const weftArray = isTop ? warpData[warpIdx].topWeft : warpData[warpIdx].bottomWeft;

                        // REMOVING a weft assignment
                        if (selectedDots.includes(dotOriginalIndex) && (dotFills[dotOriginalIndex] || []).includes(activeWeft)) {
                            // Resume drawing from this dot
                            currentSpline = [i];
                            p.loop();
                            console.log(`Resuming drawing from dot ${i} with weft ${activeWeft}`);
                            p.redraw();
                            return;
                        }
                        // ADDING a weft assignment or starting/continuing/closing a spline
                        else {
                            if (!selectedDots.includes(dotOriginalIndex)) {
                                selectedDots.push(dotOriginalIndex);
                                // Ensure dotFills[dotOriginalIndex] is an array before pushing
                                if (!Array.isArray(dotFills[dotOriginalIndex])) dotFills[dotOriginalIndex] = [];
                                dotFills[dotOriginalIndex].push(activeWeft); // First fill for this dot with activeWeft

                                weftArray.push({ weft: activeWeft, sequence: clickSequence, pathId: currentPathId });
                                clickSequence++;
                            } else if (!(dotFills[dotOriginalIndex] || []).includes(activeWeft)) {
                                // Ensure dotFills[dotOriginalIndex] is an array
                                if (!Array.isArray(dotFills[dotOriginalIndex])) dotFills[dotOriginalIndex] = [];
                                dotFills[dotOriginalIndex].push(activeWeft); // Subsequent fill, different weft

                                weftArray.push({ weft: activeWeft, sequence: clickSequence, pathId: currentPathId });
                                clickSequence++;
                            } else if ((dotFills[dotOriginalIndex] || []).includes(activeWeft) && currentSpline.length === 0) {
                                // dot is already assigned this weft, start a new spline drawing from here
                                currentSpline = [dotOriginalIndex];
                                p.loop(); // ensure draw updates for sticky line
                            }

                            // Spline segment creation logic
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

                            // Spline closing logic
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
                                currentPathId++; // Path ended due to spline closure
                                p.noLoop();
                            } else if (!((dotFills[dotOriginalIndex] || []).includes(activeWeft) && currentSpline.length === 0 && currentSpline[0] === dotOriginalIndex)) { // if not starting on existing and closing immediately
                                // If not closing, and not the special case of starting on an existing dot (which already sets currentSpline)
                                // Add current dot to currentSpline (if it's not already the last one)
                                if (currentSpline.length === 0 || currentSpline[currentSpline.length - 1] !== dotOriginalIndex) {
                                    currentSpline.push(dotOriginalIndex);
                                }
                                if (currentSpline.length === 1) p.loop(); // ensure draw updates for sticky line if we just started
                            }
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
                currentPathId++; // Path ended
                p.noLoop();
                callUpdate();
                p.redraw();
            }
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
    dynamic_param_id,
    dynamic_param_type,
    onParamChange,
    createSketch
};