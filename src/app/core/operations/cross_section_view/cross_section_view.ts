import { Draft, NumParam, OpParamVal, OpInput, DynamicOperation, OperationInlet, CanvasParam } from "../../model/datatypes";
import { getOpParamValById, getAllDraftsAtInlet } from "../../model/operations";
import { Sequence } from "../../model/sequence";
import { initDraftFromDrawdown, generateMappingFromPattern, warps, wefts } from "../../model/drafts";
import * as p5 from 'p5';

const name = "cross_section_view";
const old_names = [];

// Define parameters that users can configure
const num_warps: NumParam = {
    name: 'num warps',
    type: 'number',
    min: 1,
    max: 100,
    value: 20,
    dx: "Number of warps (width) in the cross section draft"
};

// Canvas parameter - stores points and view state
const canvasParam: CanvasParam = {
    name: 'cross_section',
    type: 'p5-canvas',
    value: {
        points: [],
        view: { zoom: 1.0, offsetX: 0, offsetY: 0 }
    },
    dx: ''
};

const params = [canvasParam, num_warps];

// Define inlets (inputs from other operations)
const systems: OperationInlet = {
    name: 'systems draft',
    type: 'static',
    value: null,
    uses: "draft",
    dx: "Optional draft to extract system information from",
    num_drafts: 1
};

const inlets = [systems];

// Main perform function - converts canvas data to draft
const perform = (op_params: Array<OpParamVal>, op_inputs: Array<OpInput>): Promise<Array<Draft>> => {
    // Get parameter values
    const canvasState = getOpParamValById(0, op_params);
    const num_warps = getOpParamValById(1, op_params);

    // Get draft dimensions
    const width = num_warps;
    const height = 1; // Cross section is always 1 weft tall

    // Create pattern sequence
    let pattern = new Sequence.TwoD();

    // Generate a row based on canvas points
    let row = new Sequence.OneD();

    // If we have points drawn in the canvas
    if (canvasState && canvasState.points && canvasState.points.length > 0) {
        const points = canvasState.points;
        const canvasWidth = 300; // Standard canvas width
        const canvasHeight = 200; // Standard canvas height

        // Initialize all cells to 0 (warp down)
        for (let i = 0; i < width; i++) {
            row.push(0);
        }

        // For each point, calculate corresponding draft cell
        points.forEach(point => {
            // Scale x from canvas to draft coordinate
            const x = Math.floor((point.x / canvasWidth) * width);

            // Set the warp to up at this position
            if (x >= 0 && x < width) {
                row.set(x, 1);
            }
        });
    } else {
        // Default pattern if no points
        row.pushMultiple(0, width);
    }

    // Create the draft
    pattern.pushWeftSequence(row.val());
    let d = initDraftFromDrawdown(pattern.export());

    // Use systems from input draft if available
    const inputDrafts = getAllDraftsAtInlet(op_inputs, 0);
    if (inputDrafts.length > 0) {
        const inputDraft = inputDrafts[0];
        d.colShuttleMapping = inputDraft.colShuttleMapping.slice(0, width);
        d.colSystemMapping = inputDraft.colSystemMapping.slice(0, width);
        d.rowShuttleMapping = inputDraft.rowShuttleMapping.slice(0, 1);
        d.rowSystemMapping = inputDraft.rowSystemMapping.slice(0, 1);
    }

    return Promise.resolve([d]);
};

// Generate a meaningful name for the operation result
const generateName = (param_vals: Array<OpParamVal>, op_inputs: Array<OpInput>): string => {
    const num_warps: number = getOpParamValById(1, param_vals);
    return 'cross section draft ' + num_warps + 'x1';
};

const onParamChange = (param_vals: Array<OpParamVal>, inlets: Array<OperationInlet>, inlet_vals: Array<any>, changed_param_id: number, param_val: any): Array<any> => {
    // In this operation, we don't need dynamic inlet changes
    return inlet_vals;
};

// P5.js sketch creator function
const createSketch = (param: any, updateCallback: Function) => {
    // Return the P5 sketch function
    return (p: any) => {
        // Get initial state or use defaults
        const state = param.value || {
            points: [],
            view: { zoom: 1.0, offsetX: 0, offsetY: 0 }
        };

        // Points array for storing drawing
        let points = state.points || [];
        let isDragging = false;

        // Setup function - runs once
        p.setup = () => {
            console.log('P5.js setup function called');
            p.createCanvas(300, 200);
            p.background(240);
        };

        // Draw function - updates canvas
        p.draw = () => {
            p.background(240);

            // Draw grid
            p.stroke(200);
            for (let i = 0; i < 300; i += 20) {
                p.line(i, 0, i, 200);
            }
            p.line(0, 100, 300, 100); // Horizontal midline

            // Draw existing points and connecting lines
            if (points.length > 0) {
                p.stroke(0);
                p.strokeWeight(2);

                // Draw lines connecting points
                p.beginShape();
                p.noFill();
                points.forEach(point => {
                    p.vertex(point.x, point.y);
                });
                p.endShape();

                // Draw points
                p.fill(255, 0, 0);
                p.noStroke();
                points.forEach(point => {
                    p.ellipse(point.x, point.y, 8, 8);
                });
            }

            // Draw instructions if no points
            if (points.length === 0) {
                p.fill(100);
                p.noStroke();
                p.textAlign(p.CENTER, p.CENTER);
                p.text("Click and drag to draw a cross-section curve", 150, 100);
            }
        };

        // Handle mouse press - start drawing
        p.mousePressed = () => {
            // Check if mouse is inside canvas
            if (p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height) {
                console.log('Mouse pressed in canvas');
                points = []; // Reset points
                isDragging = true;
                points.push({ x: p.mouseX, y: p.mouseY });

                // Create a new state object to ensure change detection
                const newState = {
                    points: [...points],
                    view: { ...state.view }
                };
                
                // Update parameter value
                updateCallback(newState);
                p.redraw();

                return false;  // Tells p5.js to prevent default behavior and stop propagation
            }
            return true; // Allow mouse event to continue if outside canvas
        };

        // Handle mouse drag - continue adding points
        p.mouseDragged = () => {
            if (isDragging && p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height) {
                points.push({ x: p.mouseX, y: p.mouseY });

                // Update state
                const newState = {
                    points: points,
                    view: state.view
                };

                // Update parameter value
                updateCallback(newState);

                p.redraw();
                return false;
            }
            return true; // Allow mouse event to continue if outside canvas
        };

        // Handle mouse release - finish drawing
        p.mouseReleased = () => {
            if (isDragging) {
                isDragging = false;
                console.log('Mouse released in canvas');

                // Sort points by x coordinate
                points.sort((a, b) => a.x - b.x);

                // Update state with sorted points
                const newState = {
                    points: points,
                    view: state.view
                };

                // Update parameter value - this triggers operation updates
                updateCallback(newState);

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
    dynamic_param_id: [],
    dynamic_param_type: 'null',
    onParamChange,
    createSketch
};