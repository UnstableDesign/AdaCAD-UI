import { Draft, Loom, LoomSettings, sameOrNewerVersion } from "adacad-drafting-lib";
import { Cell, Drawdown, flipDraft, getDraftAsImage, getDraftName, initDraft, unpackDrawdownFromArray, unpackDrawdownFromBitArray, warps, wefts } from "adacad-drafting-lib/draft";
import { jsPDF } from "jspdf";
import { FileService } from "../provider/file.service";
import { MaterialsService } from "../provider/materials.service";
import { SystemsService } from "../provider/systems.service";
import { Bounds } from "./datatypes";
import { defaults } from "./defaults";



const parseSavedDrawdown = (dd: Array<Array<Cell>>): Drawdown => {

    const drawdown: Drawdown = [];
    if (dd === undefined) return [];

    for (var i = 0; i < wefts(dd); i++) {
        drawdown.push([]);
        for (var j = 0; j < warps(dd); j++) {
            drawdown[i][j] = dd[i][j];
        }
    }

    return drawdown;
}


/**
 * creates a draft object from saved data. Handles different forms of saved drafts. 
 * @param data : a draft node object from the saved file
 */
export const loadDraftFromFile = (data: any, version: string, src: string): Promise<{ draft: Draft, id: number }> => {
    const draft: Draft = initDraft();


    if (data.id !== undefined) draft.id = data.id;

    if (data.draft_name === undefined) {
        draft.gen_name = (data.gen_name === undefined) ? defaults.draft_name : data.gen_name;
        draft.ud_name = (data.ud_name === undefined) ? '' : data.ud_name;

    } else {
        draft.gen_name = data.draft_name;
        draft.ud_name = '';


    }



    if (version === undefined || version === null || !sameOrNewerVersion(version, '3.4.5')) {
        draft.drawdown = parseSavedDrawdown(data.pattern);
    } else {
        if (data.super_compressed_drawdown !== undefined) {
            draft.drawdown = unpackDrawdownFromBitArray(data.super_compressed_drawdown, data.warps, data.wefts)
        } else if (data.compressed_drawdown !== undefined) {

            // console.log("UNPACKING", data.compressed_drawdown, data.warps, data.wefts);


            let compressed: Uint8ClampedArray;
            if (src == 'upload') {
                compressed = new Uint8ClampedArray(data.compressed_drawdown);
            } else {
                compressed = data.compressed_drawdown;
            }

            draft.drawdown = unpackDrawdownFromArray(data.compressed_drawdown, data.warps, data.wefts)

        } else {
            draft.drawdown = parseSavedDrawdown(data.drawdown);
        }

    }

    draft.rowShuttleMapping = (data.rowShuttleMapping === undefined) ? [] : data.rowShuttleMapping;
    draft.rowSystemMapping = (data.rowSystemMapping === undefined) ? [] : data.rowSystemMapping;
    draft.colShuttleMapping = (data.colShuttleMapping === undefined) ? [] : data.colShuttleMapping;;
    draft.colSystemMapping = (data.colSystemMapping === undefined) ? [] : data.colSystemMapping;;

    return Promise.resolve({ draft: draft, id: draft.id });

}

/**
* sets up the draft from the information saved in a .ada file
* returns the loom as well as the draft_id that this loom is linked with 
* @param data 
*/
export const loadLoomFromFile = (loom: any, version: string, id: number): Promise<{ loom: Loom, id: number }> => {
    console.log('[loadLoomFromFile] Loading loom from file, id:', id, 'version:', version);
    console.log('[loadLoomFromFile] Raw loom data:', loom);

    if (loom == null) {
        console.log('[loadLoomFromFile] Loom is null, returning null');
        return Promise.resolve(null);
    }

    if (!sameOrNewerVersion(version, '3.4.5')) {
        console.log('[loadLoomFromFile] Version < 3.4.5, converting old treadling style');
        //tranfer the old treadling style on looms to the new style updated in 3.4.5
        loom.treadling = loom.treadling.map(treadle_id => {
            if (treadle_id == -1) return [];
            else return [treadle_id];
        });

    } else {
        //handle case where firebase does not save empty treadles
        console.log('[loadLoomFromFile] Processing treadling for version >= 3.4.5, original treadling:', loom.treadling);
        for (let i = 0; i < loom.treadling.length; i++) {
            if (loom.treadling[i].length == 1 && loom.treadling[i][0] == -1) loom.treadling[i] = [];
        }
        console.log('[loadLoomFromFile] Processed treadling:', loom.treadling);
    }

    console.log('[loadLoomFromFile] Loaded loom successfully:', {
        id: id,
        threading: loom.threading,
        treadling: loom.treadling,
        tieup: loom.tieup
    });

    return Promise.resolve({ loom, id });


}


export const saveAsWif = async (fs: FileService, draft: Draft, loom: Loom, loom_settings: LoomSettings) => {

    const a = document.createElement('a')
    return fs.saver.wif(draft, loom, loom_settings)
        .then(href => {
            a.href = href;
            a.download = getDraftName(draft) + ".wif";
            a.click();
        });

}


export const saveAsPrint = async (el: any, draft: Draft, floats: boolean, use_colors: boolean, selected_origin_option: number, ms: MaterialsService, ss: SystemsService, fs: FileService) => {

    let b = el;
    let context = b.getContext('2d');
    b.width = (warps(draft.drawdown) + 3) * 10;
    b.height = (wefts(draft.drawdown) + 7) * 10;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, b.width, b.height);

    switch (selected_origin_option) {
        case 0:
            draft = await flipDraft(draft, true, false);
            break;

        case 1:
            draft = await flipDraft(draft, true, true);
            break;

        case 2:
            draft = await flipDraft(draft, false, true);

            break;

    }


    let system = null;

    for (let j = 0; j < draft.colShuttleMapping.length; j++) {
        let color = ms.getColor(draft.colShuttleMapping[j]);
        switch (selected_origin_option) {
            case 0:
            case 1:
                system = ss.getWarpSystemCode(draft.colSystemMapping[draft.colSystemMapping.length - 1 - j]);

                break;
            case 2:
            case 3:
                system = ss.getWarpSystemCode(draft.colSystemMapping[j]);

                break;
        }

        context.fillStyle = color;
        context.strokeStyle = "#666666";
        context.fillRect(30 + (j * 10), 16, 8, 8);
        context.strokeRect(30 + (j * 10), 16, 8, 8);

        context.font = "10px Arial";
        context.fillStyle = "#666666";
        context.fillText(system, j * 10 + 32, 10)


    }


    for (let j = 0; j < draft.rowShuttleMapping.length; j++) {

        switch (selected_origin_option) {
            case 1:
            case 2:
                system = ss.getWeftSystemCode(draft.rowSystemMapping[draft.rowSystemMapping.length - 1 - j]);

                break;
            case 0:
            case 3:
                system = ss.getWeftSystemCode(draft.rowSystemMapping[j]);

                break;
        }

        let color = ms.getColor(draft.rowShuttleMapping[j]);
        context.fillStyle = color;
        context.strokeStyle = "#666666";
        context.fillRect(16, j * 10 + 31, 8, 8);
        context.strokeRect(16, j * 10 + 31, 8, 8);

        context.font = "10px Arial";
        context.fillStyle = "#666666";
        context.fillText(system, 0, 28 + (j + 1) * 10)


    }
    let img = getDraftAsImage(draft, 10, floats, use_colors, ms.getShuttles());
    context.putImageData(img, 30, 30);

    context.font = "12px Arial";
    context.fillStyle = "#000000";
    let textstring = getDraftName(draft) + " // " + warps(draft.drawdown) + " x " + wefts(draft.drawdown);
    context.fillText(textstring, 30, 50 + wefts(draft.drawdown) * 10)

    const a = document.createElement('a')
    return fs.saver.jpg(b)
        .then(href => {
            a.href = href;
            a.download = getDraftName(draft) + ".png";
            a.click();
        });

}


export const saveAsColoringPage = async (el: any, draft: Draft, ms: MaterialsService, ss: SystemsService, fs: FileService) => {

    let b = el;
    let context = b.getContext('2d');
    const cellSize = 40;
    b.width = (warps(draft.drawdown)) * cellSize;
    b.height = (wefts(draft.drawdown)) * cellSize;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, b.width, b.height);

    // Draw the draft image (black and white for coloring page)
    let img = getDraftAsImage(draft, cellSize, true, false, ms.getShuttles());
    context.putImageData(img, 0, 0);


    // Convert canvas to image data URL
    const imageDataUrl = b.toDataURL('image/png');

    // Create PDF with letter size (8.5" x 11" = 612 x 792 points)
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter'
    });

    // Letter size dimensions in points
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 36; // 0.5" margins
    const availableWidth = pageWidth - (2 * margin);
    const availableHeight = pageHeight - (2 * margin);

    // Calculate scaling to fit within available space
    const imageWidth = b.width;
    const imageHeight = b.height;
    const scaleX = availableWidth / imageWidth;
    const scaleY = availableHeight / imageHeight;
    const scale = Math.min(scaleX, scaleY);

    // Calculate scaled dimensions
    const scaledWidth = imageWidth * scale;
    const scaledHeight = imageHeight * scale;

    // Center the image on the page
    const x = margin + (availableWidth - scaledWidth) / 2;
    const y = margin + (availableHeight - scaledHeight) / 2;

    // Add image to PDF
    pdf.addImage(imageDataUrl, 'PNG', x, y, scaledWidth, scaledHeight);

    // Save PDF
    pdf.save(getDraftName(draft) + ".pdf");

    return Promise.resolve();

}

export const saveAsPng = async (el: any, draft: Draft, selected_origin_option: number, ms: MaterialsService, fs: FileService) => {
    let context = el.getContext('2d');
    el.width = warps(draft.drawdown);
    el.height = wefts(draft.drawdown);
    let img = getDraftAsImage(draft, 1, false, false, ms.getShuttles());
    context.putImageData(img, 0, 0);
    const a = document.createElement('a')
    return fs.saver.png(el)
        .then(href => {
            a.href = href;
            a.download = (draft.id) + "_bitmap.png";
            a.click();
        });


}

export const saveAsBmp = async (el: any, draft: Draft, selected_origin_option: number, ms: MaterialsService, fs: FileService) => {
    let context = el.getContext('2d');

    switch (selected_origin_option) {
        case 0:
            draft = await flipDraft(draft, true, false);
            break;

        case 1:
            draft = await flipDraft(draft, true, true);
            break;

        case 2:
            draft = await flipDraft(draft, false, true);

            break;

    }

    el.width = warps(draft.drawdown);
    el.height = wefts(draft.drawdown);
    let img = getDraftAsImage(draft, 1, false, false, ms.getShuttles());

    // console.log("IMAGE ", img.colorSpace)
    // for(let i = 0; i < img.data.length; i+=4){
    //   console.log(img.data[i], img.data[i+1],img.data[i+2],img.data[i+3])
    // }



    context.putImageData(img, 0, 0);

    const a = document.createElement('a')
    return fs.saver.bmp(el)
        .then(href => {
            a.href = href;
            a.download = getDraftName(draft) + "_bitmap.jpg";
            a.click();
        });

}

/**
 * given a list of Bounds objects, this function will merge the bounds such that the top left point represents the top-most and left-most of the values and the width and height contain all values
 * @param list 
 * @returns 
 */
export const mergeBounds = (list: Array<Bounds>): Bounds | null => {

    list = list.filter(el => el !== null && el !== undefined);
    if (list.length == 0) return null;

    const first = list.pop();

    const tlbr = list.reduce((acc, val) => {

        if (val.topleft.x < acc.topleft.x) acc.topleft.x = val.topleft.x;
        if (val.topleft.y < acc.topleft.y) acc.topleft.y = val.topleft.y;
        if (val.topleft.x + val.width > acc.botright.x) acc.botright.x = val.topleft.x + val.width;
        if (val.topleft.y + val.height > acc.botright.y) acc.botright.y = val.topleft.y + val.height;
        return acc;
    }, { topleft: first.topleft, botright: { x: first.topleft.x + first.width, y: first.topleft.y + first.height } })


    return {
        topleft: { x: tlbr.topleft.x, y: tlbr.topleft.y },
        width: (tlbr.botright.x - tlbr.topleft.x),
        height: (tlbr.botright.y - tlbr.topleft.y),
    }

}




