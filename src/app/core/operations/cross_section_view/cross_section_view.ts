import { Draft, NumParam, OpParamVal, OpInput, DynamicOperation, OperationInlet, CanvasParam } from "../../model/datatypes";
import { getOpParamValById, getAllDraftsAtInlet } from "../../model/operations";
import { Sequence } from "../../model/sequence";
import { initDraftFromDrawdown, generateMappingFromPattern, warps, wefts } from "../../model/drafts";
import * as p5 from 'p5';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;

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
        const canvasWidth = CANVAS_WIDTH; // Standard canvas width
        const canvasHeight = CANVAS_HEIGHT; // Standard canvas height

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
// p5.js sketch creator function
const createSketch = (param: any, updateCallback: Function) => {
    // Return the p5 sketch function
    return (p: any) => {
        // Get initial state or use defaults
        const state = param.value || {
            points: [],
            view: { zoom: 1.0, offsetX: 0, offsetY: 0 }
        };

        // Points array for storing drawing
        let points = state.points || [];
        let isDragging = false;
        let isOverClearButton = false;

        // Setup function - runs once
        p.setup = () => {
            console.log('[cross_section_view.ts] p5.js setup function called');
            p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
            p.background(240);
        };

        // Draw function - updates canvas
        p.draw = () => {
            p.background(240);

            // Draw grid
            p.stroke(200);
            for (let i = 0; i < CANVAS_WIDTH; i += 20) {
                p.line(i, 0, i, CANVAS_HEIGHT);
            }
            p.line(0, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT / 2); // Horizontal midline

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
                p.text("Click and drag to draw a cross-section curve", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
            }

            // Draw clear button
            const buttonWidth = 50;
            const buttonHeight = 25;
            const buttonMarginX = 10;
            const buttonY = 10;
            const buttonX = CANVAS_WIDTH - buttonWidth - buttonMarginX;
            isOverClearButton = p.mouseX > buttonX && p.mouseX < buttonX + buttonWidth && p.mouseY > buttonY && p.mouseY < buttonY + buttonHeight;
            p.fill(isOverClearButton ? 220 : 200);
            p.stroke(180);
            p.rect(buttonX, buttonY, buttonWidth, buttonHeight, 5);
            p.fill(60);
            p.noStroke();
            p.textAlign(p.CENTER, p.CENTER);
            p.text("Clear", buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);
        };

        // Handle mouse press - start drawing or clear
        p.mousePressed = () => {
            // Check if clear button is clicked
            if (isOverClearButton) {
                points = [];
                const newState = {
                    points: [],
                    view: { ...state.view }
                };
                updateCallback(newState);
                return;
            }

            // Check if mouse is inside canvas
            if (p.mouseX >= 0 && p.mouseX < CANVAS_WIDTH && p.mouseY >= 0 && p.mouseY < CANVAS_HEIGHT) {
                isDragging = true;
                points.push({ x: p.mouseX, y: p.mouseY });

                // Create a new state object to ensure change detection
                const newState = {
                    points: [...points],
                    view: { ...state.view }
                };

                // Update parameter value
                updateCallback(newState);
            }
        };

        // Handle mouse drag - continue adding points
        p.mouseDragged = () => {
            if (isDragging && p.mouseX >= 0 && p.mouseX < CANVAS_WIDTH && p.mouseY >= 0 && p.mouseY < CANVAS_HEIGHT) {
                points.push({ x: p.mouseX, y: p.mouseY });

                // Update state
                const newState = {
                    points: [...points],
                    view: state.view
                };

                // Update parameter value
                updateCallback(newState);
            }
        };

        // Handle mouse release - finish drawing
        p.mouseReleased = () => {
            if (isDragging) {
                isDragging = false;
                console.log('[cross_section_view.ts] Mouse released in canvas');

                // Sort points by x coordinate
                points.sort((a, b) => a.x - b.x);

                // Update state with sorted points
                const newState = {
                    points: points,
                    view: state.view
                };

                // Update parameter value - this triggers operation updates
                updateCallback(newState);
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