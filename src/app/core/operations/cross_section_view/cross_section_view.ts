import { Draft, NumParam, OpParamVal, OpInput, Operation, OperationInlet } from "../../model/datatypes";
import { getOpParamValById, getAllDraftsAtInlet } from "../../model/operations";
import { Sequence } from "../../model/sequence";
import { initDraftFromDrawdown, generateMappingFromPattern, warps, wefts } from "../../model/drafts";

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

const params = [num_warps];

// Define inlets (inputs from other operations)
const systems: OperationInlet = {
    name: 'systems draft',
    type: 'static',
    value: null,
    uses: "warp-and-weft-data",
    dx: 'Optional draft that provides system mappings for the output',
    num_drafts: 1
};

const inlets = [systems];

// The main function that performs the operation
const perform = (param_vals: Array<OpParamVal>, op_inputs: Array<OpInput>) => {
    // Get parameter values
    const draft_width: number = getOpParamValById(0, param_vals);
    const draft_height: number = 1; // Fixed height at 1 row

    // Create a blank pattern of specified size
    let pattern = new Sequence.TwoD();
    pattern.setBlank(false);
    pattern.fill(draft_width, draft_height);

    // Initialize the draft from the pattern
    let output_draft = initDraftFromDrawdown(pattern.export());

    // Apply system mappings if a systems draft is provided
    const system_drafts = getAllDraftsAtInlet(op_inputs, 0);
    if (system_drafts && system_drafts.length > 0) {
        const system_draft = system_drafts[0];

        // Extract system information
        let weft_system_map = new Sequence.OneD(system_draft.rowSystemMapping);
        let warp_system_map = new Sequence.OneD(system_draft.colSystemMapping);
        let weft_shuttle_map = new Sequence.OneD(system_draft.rowShuttleMapping);
        let warp_shuttle_map = new Sequence.OneD(system_draft.colShuttleMapping);

        // Determine unique warp and weft systems
        let unique_warp_systems = [...new Set(warp_system_map.val())];

        // Create custom system mapping arrays for the cross seciton draft
        let cross_warp_mapping = [];
        let cross_weft_mapping = [];

        // Generate alternating warp systems (1,2,1,2...) if multiple systems exist
        if (unique_warp_systems.length > 1) {
            for (let i = 0; i < draft_width; i++) {
                cross_warp_mapping.push(unique_warp_systems[i % unique_warp_systems.length]);
            }
        } else {
            // If only one warp system, use it for all warps
            cross_warp_mapping = Array(draft_width).fill(unique_warp_systems[0]);
        }

        // Always use weft system 'a' (represented by 0) for the single row
        const weft_system_a = 0; // System 'a' is always 0
        cross_weft_mapping = [weft_system_a];

        // Generate shuttle mappings
        let cross_warp_shuttle_mapping = [];
        let cross_weft_shuttle_mapping = [];

        if (unique_warp_systems.length > 0) {
            for (let i = 0; i < draft_width; i++) {
                const system_index = i % unique_warp_systems.length;
                const corresponding_shuttle = warp_shuttle_map.val()[
                    warp_system_map.val().indexOf(unique_warp_systems[system_index])
                ];
                cross_warp_shuttle_mapping.push(corresponding_shuttle);
            }
        } else {
            cross_warp_shuttle_mapping = Array(draft_width).fill(warp_shuttle_map.val()[0]);
        }

        // Find the shuttle associated with weft system 'a'
        const index_of_system_a = weft_system_map.val().indexOf(weft_system_a);
        cross_weft_shuttle_mapping = [
            index_of_system_a >= 0 ? weft_shuttle_map.val()[index_of_system_a] : weft_shuttle_map.val()[0]
        ];

        // Apply mappings to the output draft
        output_draft.colSystemMapping = cross_warp_mapping;
        output_draft.rowSystemMapping = cross_weft_mapping;
        output_draft.colShuttleMapping = cross_warp_shuttle_mapping;
        output_draft.rowShuttleMapping = cross_weft_shuttle_mapping;
    }

    // Return a Promise with the draft output
    return Promise.resolve([output_draft]);
};

// Function to generate a meaningful name for the output
const generateName = (param_vals: Array<OpParamVal>, op_inputs: Array<OpInput>): string => {
    const num_warps: number = getOpParamValById(0, param_vals);
    return 'cross section draft ' + num_warps + 'x1';
};

// Export the operation object
export const cross_section_view: Operation = {
    name,
    old_names,
    params,
    inlets,
    perform,
    generateName
};