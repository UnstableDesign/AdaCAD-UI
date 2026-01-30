import { inject, Injectable } from '@angular/core';
import { defaults, generateId, Loom, LoomSettings, Material, sameOrNewerVersion } from 'adacad-drafting-lib';
import { createCell, Draft, Drawdown, initDraftFromDrawdown, warps, wefts } from 'adacad-drafting-lib/draft';
import { getLoomUtilByType, initLoom, numFrames, numTreadles } from 'adacad-drafting-lib/loom';
import { DraftNodeProxy, Fileloader, FileMeta, FileSaver, LoadResponse, OpComponentProxy, SaveObj, StatusMessage } from '../model/datatypes';
import { loadDraftFromFile, loadLoomFromFile } from '../model/helper';
import { getBool, getColorTable, getColToShuttleMapping, getInt, getLiftPlan, getRowToShuttleMapping, getString, getSubstringAfter, getThreading, getTieups, getTreadling } from '../model/wif';
import { ImporttodraftService } from './importtodraft.service';
import { MaterialsService } from './materials.service';
import { MediaService } from './media.service';
import { NotesService } from './notes.service';
import { SystemsService } from './systems.service';
import { TreeService } from './tree.service';
import { VersionService } from './version.service';
import { WorkspaceService } from './workspace.service';
import { ZoomService } from './zoom.service';




/**
 * this service handles the processing of data from an uplaoded file. 
 * It is called from the InitModal when the user uploads data. 
 * The principle sholud be that you can load any .ada file into 
 * mixer or weaver, no matter what. 
 */

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private tree = inject(TreeService);
  private ns = inject(NotesService);
  private ms = inject(MaterialsService);
  private ss = inject(SystemsService);
  private vs = inject(VersionService);
  private ws = inject(WorkspaceService);
  private zs = inject(ZoomService);
  private media = inject(MediaService);
  private importtodraftSvc = inject(ImporttodraftService);


  status: Array<StatusMessage> = [];
  loader: Fileloader = null;
  saver: FileSaver = null;

  constructor() {


    this.status = [
      { id: 0, message: 'success', success: true },
      { id: 1, message: 'incompatable type', success: false }
    ];


    /**
     * file loader loads files of different types, 
     * for .adaFiles, it gets the data listed in SaveObj and begins to process it
     */
    const dloader: Fileloader = {

      ada: async (data: SaveObj | any, meta: FileMeta, src: string): Promise<LoadResponse> => {
        console.log("LOADING FILE", data);
        if (meta.desc === undefined) meta.desc = ""
        if (meta.name == undefined) meta.name = 'draft'
        if (meta.from_share == undefined) meta.from_share = ''
        if (meta.id === -1) meta.id = generateId(8);

        let draft_nodes: Array<DraftNodeProxy> = [];
        let ops: Array<OpComponentProxy> = [];
        let version = "0.0.0";

        this.clearAll();

        if (data == undefined) return Promise.reject(" there is no data")

        if (data.version !== undefined) version = data.version;

        if (data.zoom !== undefined) {
          this.zs.import(data.zoom)
        }

        if (data.workspace !== undefined) {
          this.ws.loadWorkspace(data.workspace);
        } else {
          this.ws.initDefaultWorkspace();
        }

        if (data.shuttles !== undefined) {
          this.ms.overloadShuttles(data.shuttles);

        } else {
          if (data.materials !== undefined) {
            this.ms.overloadShuttles(data.materials);
          }
        }

        const loom_elements = []
        const loom_fns = []
        const draft_elements = [];
        const draft_fns = [];

        if (!sameOrNewerVersion(version, '3.4.9')) {
          data.nodes.forEach(node => {
            if (node.bounds !== undefined) node.topleft = node.bounds.topleft;
          })
        }

        if (sameOrNewerVersion(version, '3.4.5')) {

          draft_nodes = data.draft_nodes;

          if (draft_nodes == undefined) draft_nodes = [];

          if (draft_nodes !== undefined) {



            draft_nodes.forEach((el, ndx) => {

              if (el.draft_id !== el.node_id) {
                el.draft_id = el.node_id;
                if (el.draft !== null && el.draft !== undefined) el.draft.id = el.node_id;

                if (el.compressed_draft !== null && el.compressed_draft !== undefined) el.compressed_draft.id = el.node_id;

                if (data.draft_nodes[ndx].draft_name !== undefined) {
                  el.ud_name = '';
                  el.gen_name = data.draft_nodes[ndx].draft_name;
                }


              }

              if (el.draft == undefined && el.compressed_draft !== undefined && el.compressed_draft !== null) {
                draft_fns.push(loadDraftFromFile(el.compressed_draft, version, src));
                draft_elements.push(el);
              } else if (el.draft !== null && el.draft !== undefined) {
                draft_fns.push(loadDraftFromFile(el.draft, version, src));
                draft_elements.push(el);
              }

              if (el.loom !== null && el.loom !== undefined) {
                loom_fns.push(loadLoomFromFile(el.loom, version, el.draft_id));
                loom_elements.push(el);
              }




            });
          }

        } else {

          //handle old file types that didn't separate out drafts
          if (data.drafts === undefined) data.drafts = [data];


          data.nodes
            .filter(el => el.type === 'draft')
            .forEach(async node => {

              const loom = data.looms.find(loom => loom.draft_id === node.node_id);
              const draft = data.drafts.find(draft => draft.id === node.node_id);


              const dn: DraftNodeProxy = {
                node_id: (node === undefined) ? -1 : node.node_id,
                draft_id: node.node_id,
                ud_name: (node.draft_name) ? node.draft_name : node.ud_name,
                gen_name: (node.draft_name) ? node.draft_name : node.gen_name,
                draft: null,
                notes: (draft.notes === undefined) ? '' : draft.notes,
                compressed_draft: null,
                draft_visible: (node === undefined) ? true : node.draft_visible,
                loom: null,
                loom_settings: (loom === undefined)
                  ? {
                    type: this.ws.type,
                    epi: defaults.loom_settings.epi,
                    ppi: defaults.loom_settings.ppi,
                    units: this.ws.units,
                    frames: this.ws.min_frames,
                    treadles: this.ws.min_treadles
                  }
                  :
                  {
                    type: loom.type ?? defaults.loom_settings.type,
                    epi: loom.epi ?? defaults.loom_settings.epi,
                    ppi: loom.ppi ?? defaults.loom_settings.ppi,
                    units: loom.units ?? defaults.loom_settings.units,
                    frames: loom.min_frames ?? defaults.loom_settings.frames,
                    treadles: loom.min_treadles ?? defaults.loom_settings.treadles
                  },
                render_colors: (node === undefined || node.render_colors === undefined) ? true : node.render_colors,
                scale: (node === undefined || node.scale === undefined) ? 1 : node.scale,
              }

              draft_nodes.push(dn);

              if (draft !== null && draft !== undefined) {
                draft_fns.push(loadDraftFromFile(draft, version, 'db'));

                if (loom !== null && loom !== undefined) {
                  loom_fns.push(loadLoomFromFile(loom, version, draft.id));
                }
              }
            });

        }

        return Promise.all(draft_fns)
          .then(res => {
            //res contains a list of ids and drafts

            res.forEach(result => {
              let draft_ndx = draft_nodes.findIndex(el => el.draft_id == result.id);
              if (draft_ndx !== -1) draft_nodes[draft_ndx].draft = result.draft;



            })

            return Promise.all(loom_fns)
          })
          .then(res => {
            console.log('[file.service] All looms loaded from file, count:', res.length);
            res.forEach((result, index) => {
              console.log(`[file.service] Processing loaded loom ${index}:`, {
                id: result.id,
                loom: result.loom ? {
                  threading: result.loom.threading,
                  treadling: result.loom.treadling,
                  tieup: result.loom.tieup
                } : null
              });
              let draft_ndx = draft_nodes.findIndex(el => el.draft_id == result.id);
              if (draft_ndx !== -1) {
                draft_nodes[draft_ndx].loom = result.loom;
                console.log(`[file.service] Loom assigned to draft node at index ${draft_ndx}, draft_id: ${draft_nodes[draft_ndx].draft_id}`);
              } else {
                console.warn(`[file.service] Could not find draft node for loom id: ${result.id}`);
              }
            })


            draft_nodes
              .filter(el => el.draft !== null)
              .forEach(el => {
                //scan the systems and add any that need to be added
                if (el.draft !== null && el.draft !== undefined && el.draft.rowSystemMapping !== undefined) {
                  el.draft.rowSystemMapping.forEach(el => {
                    if (this.ss.getWeftSystem(el) === undefined) this.ss.addWeftSystemFromId(el);
                  });
                }

                //scan the systems and add any that need to be added
                if (el.draft !== null && el.draft !== undefined && el.draft.colSystemMapping !== undefined) {
                  el.draft.colSystemMapping.forEach(el => {
                    if (this.ss.getWarpSystem(el) === undefined) this.ss.addWarpSystemFromId(el);
                  });
                }
              })


            if (data.ops !== undefined) {
              ops = data.ops.map(data => {
                const op: OpComponentProxy = {
                  node_id: data.node_id,
                  name: data.name,
                  params: data.params,
                  inlets: (data.inlets === undefined) ? [0] : data.inlets
                }
                return op;
              });
            }

            let indexed_images = [];
            if (data.indexed_image_data !== undefined) {
              indexed_images = data.indexed_image_data;
            }

            const envt: SaveObj = {
              version: data.version,
              workspace: data.workspace,
              zoom: data.zoom,
              type: 'mixer',
              nodes: (data.nodes === undefined) ? [] : data.nodes,
              tree: (data.tree === undefined) ? [] : data.tree,
              draft_nodes: draft_nodes,
              notes: (data.notes === undefined) ? [] : data.notes,
              ops: ops,
              materials: [],
              indexed_image_data: indexed_images
            }

            return Promise.resolve({ data: envt, meta, status: 0 });

          }
          )





      },

      paste: async (data: any): Promise<LoadResponse> => {


        let draft_nodes: Array<DraftNodeProxy> = [];
        let ops: Array<OpComponentProxy> = [];
        let version = data.version;



        if (data.shuttles !== undefined) {
          //handle shuttles here
        }

        const loom_elements = []
        const loom_fns = []
        const draft_elements = [];
        const draft_fns = [];

        draft_nodes = data.draft_nodes;

        draft_nodes.forEach(el => {
          if (el.compressed_draft !== null && el.compressed_draft !== undefined) {
            draft_fns.push(loadDraftFromFile(el.compressed_draft, version, 'db'));
            draft_elements.push(el);

            if (el.loom !== null && el.loom !== undefined) {
              loom_fns.push(loadLoomFromFile(el.loom, version, el.compressed_draft.id));
              loom_elements.push(el);
            }
          }


        });

        return Promise.all(draft_fns)
          .then(res => {

            for (let i = 0; i < draft_elements.length; i++) {
              draft_elements[i].draft = res[i].draft;
            }

            return Promise.all(loom_fns)
          })
          .then(res => {

            for (let i = 0; i < loom_elements.length; i++) {
              draft_elements[i].loom = res[i];
            }

            draft_nodes
              .filter(el => el.compressed_draft !== null)
              .forEach(el => {
                //scan the systems and add any that need to be added
                if (el.compressed_draft !== null && el.compressed_draft !== undefined && el.compressed_draft.rowSystemMapping !== undefined) {
                  el.compressed_draft.rowSystemMapping.forEach(el => {
                    if (this.ss.getWeftSystem(el) === undefined) this.ss.addWeftSystemFromId(el);
                  });
                }

                //scan the systems and add any that need to be added
                if (el.compressed_draft !== null && el.compressed_draft !== undefined && el.compressed_draft.colSystemMapping !== undefined) {
                  el.compressed_draft.colSystemMapping.forEach(el => {
                    if (this.ss.getWarpSystem(el) === undefined) this.ss.addWarpSystemFromId(el);
                  });
                }
              })


            let indexed_images = [];
            if (data.indexed_image_data !== undefined) {
              indexed_images = data.indexed_image_data;
            }


            if (data.ops !== undefined) {
              ops = data.ops.map(data => {
                const op: OpComponentProxy = {
                  node_id: data.node_id,
                  name: data.name,
                  params: data.params,
                  inlets: (data.inlets === undefined) ? [0] : data.inlets
                }
                return op;
              });
            }




            const envt: SaveObj = {
              version: '0.0.0',
              workspace: null,
              zoom: null,
              type: 'partial',
              nodes: (data.nodes === undefined) ? [] : data.nodes,
              tree: (data.tree === undefined) ? [] : data.tree,
              draft_nodes: draft_nodes,
              notes: [],
              ops: ops,
              materials: [],
              indexed_image_data: indexed_images
            }

            const meta = {
              id: -1,
              name: 'paste',
              desc: 'a file represeting copied information',
              from_share: '',
              share_owner: ''

            }

            return Promise.resolve({ data: envt, meta, status: 0 });

          }
          )





      },

      wif: async (filename: string, data: any): Promise<LoadResponse> => {


        //normalize the data to use only \n as the line ending
        data = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');


        var stringWithoutMetadata = getSubstringAfter("CONTENTS", data);
        let warps: number = getInt("Threads", getSubstringAfter("WARP]", stringWithoutMetadata));
        let wefts: number = getInt("Threads", getSubstringAfter("WEFT]", stringWithoutMetadata));
        let epi: number = getInt("Spacing", getSubstringAfter("WARP]", stringWithoutMetadata));
        let ppi: number = getInt("Spacing", getSubstringAfter("WEFT]", stringWithoutMetadata));
        let units: string = getString("Units", getSubstringAfter("WARP]", stringWithoutMetadata));
        let frames = getInt("Shafts", stringWithoutMetadata);
        let treadles = getInt("Treadles", stringWithoutMetadata);



        if (warps == -1 || wefts == -1) {
          console.error("no warp or weft number found");
          return Promise.reject("no warp or weft number found");
        }
        if (warps === -1) warps = defaults.warps;
        if (wefts === -1) wefts = defaults.wefts;
        if (epi === -1) epi = defaults.loom_settings.epi;
        if (ppi === -1) ppi = defaults.loom_settings.ppi;
        if (units === undefined) units = defaults.loom_settings.units;
        if (frames === -1) frames = defaults.loom_settings.frames;
        if (treadles === -1) treadles = defaults.loom_settings.treadles;

        if (warps * wefts > this.ws.max_draft_input_area) return Promise.reject('image size error');

        //;({"Decipoints","Inches","Centimeters"})
        let formattedUnits: 'in' | 'cm' = 'in';
        switch (units) {
          case "Decipoints":
            formattedUnits = "in";
            break;
          case "Inches":
            formattedUnits = "cm";
            break;
          case "Centimeters":
            formattedUnits = "cm";
            break;
          default:
            formattedUnits = <'in' | 'cm'>defaults.loom_settings.units;
            break;
        }

        const loom_settings: LoomSettings = {
          type: 'frame',
          frames,
          treadles,
          units: formattedUnits,
          epi,
          ppi,
        }
        console.log("LOOM SETTINGS", loom_settings);

        console.log('[file.service WIF] Instantiating loom with parameters:', { warps, wefts, frames, treadles });
        const loom = initLoom(warps, wefts, frames, treadles);
        console.log('[file.service WIF] Loom instantiated:', {
          threading: loom.threading,
          treadling: loom.treadling,
          tieup: loom.tieup
        });

        const hasThreading = getBool("THREADING", stringWithoutMetadata);
        const hasTreadling = getBool("TREADLING", stringWithoutMetadata);
        const hasTieup = getBool("TIEUP", stringWithoutMetadata);
        const hasLiftPlan = getBool("LIFTPLAN", stringWithoutMetadata);

        console.log("HAS THREADING", hasThreading);
        console.log("HAS TREADLING", hasTreadling);
        console.log("HAS TIEUP", hasTieup);
        console.log("HAS LIFT PLAN", hasLiftPlan);

        if (hasTreadling) {
          loom.treadling = getTreadling(stringWithoutMetadata, wefts);
        } else if (hasLiftPlan) {
          loom_settings.type = 'direct';
          loom.treadling = getLiftPlan(stringWithoutMetadata, wefts);
        }

        if (hasThreading) {
          loom.threading = getThreading(stringWithoutMetadata, warps);
        }

        if (hasTieup) {
          loom.tieup = getTieups(stringWithoutMetadata, frames, treadles);
        }



        const utils = getLoomUtilByType(loom_settings.type);
        return utils.computeDrawdownFromLoom(loom).then(drawdown => {


          const draft = initDraftFromDrawdown(drawdown);

          if (getBool("COLOR TABLE", data)) {

            const hasRange = getString("Range", data) !== undefined;
            const hasForm = getString("Form", data) !== undefined;



            if (hasForm || hasRange) {

              let min = (hasRange) ? getString("Range", data).split(",")[0] : 0;
              let max = (hasRange) ? getString("Range", data).split(",")[1] : 255;

              let color_table: Array<Material> = getColorTable(data, +min, +max);

              let material_map: { old_id: number, new_id: number }[] = [];
              for (let i = 0; i < color_table.length; i++) {
                let matching_id = this.ms.getShuttleByRGB(color_table[i].rgb.r, color_table[i].rgb.g, color_table[i].rgb.b);
                var id_copy = color_table[i].id;
                if (matching_id === -1) {
                  var new_id = this.ms.addShuttle(color_table[i]);
                  material_map.push({ old_id: id_copy, new_id });
                } else {
                  material_map.push({ old_id: id_copy, new_id: matching_id });
                }
              }

              const originalRowShuttleMapping = getRowToShuttleMapping(data, wefts);
              const originalColShuttleMapping = getColToShuttleMapping(data, warps);



              draft.rowShuttleMapping = originalRowShuttleMapping.map(el => material_map.find(m => m.old_id == el)?.new_id ?? 0);
              draft.colShuttleMapping = originalColShuttleMapping.map(el => material_map.find(m => m.old_id == el)?.new_id ?? 0);

            }
          }




          let dnp: DraftNodeProxy = {
            node_id: -1,
            draft_id: draft.id,
            ud_name: 'imported wif',
            gen_name: 'imported wif',
            notes: 'imported from wif',
            draft: draft,
            compressed_draft: null,
            draft_visible: true,
            loom: loom,
            loom_settings: loom_settings,
            render_colors: true,
            scale: 1
          }

          const envt: SaveObj = {
            version: '0.0.0',
            workspace: null,
            zoom: null,
            type: 'wif',
            nodes: [],
            tree: null,
            draft_nodes: [dnp],
            notes: [],
            ops: [],
            materials: [],
            indexed_image_data: []
          }

          const meta = {
            id: -1,
            name: data.name + ' (wif import)',
            desc: 'a file representing imported wif information from ' + data.name,
            from_share: '',
            share_owner: ''

          }

          this.importtodraftSvc.uploadComplete(data.ref);
          return Promise.resolve({ data: envt, meta, status: 0 });





        }).catch(error => {
          this.importtodraftSvc.uploadComplete(data.ref);
          console.error("error computing drawdown", error);
          return Promise.reject("error computing drawdown");
        });










      },
      bitmap: async (filename: string, data: any): Promise<LoadResponse> => {

        console.log("LOADING BITMAP", filename, data);
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var image = new Image();
        image.src = data.url;
        image.crossOrigin = "Anonymous";


        return image.decode().then(() => {
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;


          if (image.naturalWidth * image.naturalHeight > this.ws.max_draft_input_area) return Promise.reject('image size error');


          const drawdown: Drawdown = [];
          for (let i = 0; i < canvas.height; i++) {
            drawdown.push([]);
            for (let j = 0; j < canvas.width; j++) {
              drawdown[i][j] = createCell(false);
            }
          }
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          var imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height);

          const pixels = imgdata.data;
          for (let i = 0; i < pixels.length; i += 4) {
            let i_ndx = Math.floor((i / 4) / image.naturalWidth);
            let j_ndx = Math.floor(((i / 4) % image.naturalWidth));
            let r = pixels[i];
            let g = pixels[i + 1];
            let b = pixels[i + 2];
            let a = pixels[i + 3];
            const is_black: boolean = ((r + g + b / 3) < (255 / 2))
            drawdown[i_ndx][j_ndx] = createCell(is_black);
          }

          const draft = initDraftFromDrawdown(drawdown);


          let dnp: DraftNodeProxy = {
            node_id: -1,
            draft_id: draft.id,
            ud_name: data.name,
            gen_name: data.name,
            notes: 'imported from bitmap: ' + data.name,
            draft: draft,
            compressed_draft: null,
            draft_visible: true,
            loom: null,
            loom_settings: defaults.loom_settings as LoomSettings,
            render_colors: true,
            scale: 1
          }

          const envt: SaveObj = {
            version: '0.0.0',
            workspace: null,
            zoom: null,
            type: 'wif',
            nodes: [],
            tree: null,
            draft_nodes: [dnp],
            notes: [],
            ops: [],
            materials: [],
            indexed_image_data: []
          }

          const meta = {
            id: -1,
            name: data.name + ' (bitmap import)',
            desc: 'a file representing imported bitmap information from ' + data.name,
            from_share: '',
            share_owner: ''

          }

          this.importtodraftSvc.uploadComplete(data.ref);
          return Promise.resolve({ data: envt, meta, status: 0 });


        }).catch(error => {
          console.error("error loading bitmap", error);
          this.importtodraftSvc.uploadComplete(data.ref);
          return Promise.reject("error loading bitmap");
        });
      }
    }





    const dsaver: FileSaver = {

      copy: async (include: Array<number>): Promise<SaveObj> => {

        const out: SaveObj = {
          type: 'partial',
          version: this.vs.currentVersion(),
          workspace: null,
          zoom: null,
          nodes: this.tree.exportNodesForSaving(),
          tree: this.tree.exportTreeForSaving(),
          draft_nodes: await this.tree.exportDraftNodeProxiesForSaving(),
          ops: this.tree.exportOpMetaForSaving(),
          notes: [],
          materials: this.ms.exportForSaving(),
          indexed_image_data: this.media.exportIndexedColorImageData()
        }

        //now filter out things that aren't relevant
        out.nodes = out.nodes.filter(node => include.find(el => el == node.node_id) !== undefined);
        out.nodes.forEach(node => { node.topleft = { x: node.topleft.x + 50, y: node.topleft.y + 50 } });
        out.tree = out.tree.filter(tn => include.find(el => el == tn.node) !== undefined);
        out.draft_nodes = out.draft_nodes.filter(dn => include.find(el => el == dn.node_id) !== undefined);
        out.ops = out.ops.filter(op => include.find(el => el == op.node_id) !== undefined)


        return Promise.resolve(out);

      },

      ada: async (): Promise<{ json: string, file: SaveObj }> => {


        return this.tree.exportDraftNodeProxiesForSaving().then(draft_nodes => {
          const out: SaveObj = {
            version: this.vs.currentVersion(),
            workspace: this.ws.exportWorkspace(),
            type: 'mixer',
            zoom: this.zs.export(),
            nodes: this.tree.exportNodesForSaving(),
            tree: this.tree.exportTreeForSaving(),
            draft_nodes: draft_nodes,
            ops: this.tree.exportOpMetaForSaving(),
            notes: this.ns.exportForSaving(),
            materials: this.ms.exportForSaving(),
            indexed_image_data: this.media.exportIndexedColorImageData()
          }
          var theJSON = JSON.stringify(out);
          return Promise.resolve({ json: theJSON, file: out });
        })

      },
      wif: async (draft: Draft, loom: Loom, loom_settings: LoomSettings): Promise<string> => {





        if (loom === null) {

          //force loom type to something with shafts;
          loom_settings.type = 'frame';
          loom = await getLoomUtilByType(loom_settings.type).computeLoomFromDrawdown(draft.drawdown, loom_settings);

        }

        const shuttles: Array<Material> = this.ms.getShuttles();
        //will need to import the obj for draft2wif.ts and then use it and pass this.weave for fileContents
        var fileType = "text/plain";

        var fileContents = "[WIF]\nVersion=1.1\nDate=June 11, 2024\nDevelopers=unstabledesignlab@gmail.com\nSource Program=AdaCAD\nSource Version=" + this.vs.currentVersion() + "\n[CONTENTS]";

        if (loom_settings.type == 'direct') {
          fileContents += "\nCOLOR PALETTE=true\nWEAVING=true\nWARP=true\nWEFT=true\nLIFTPLAN=true\nCOLOR TABLE=true\nWARP COLORS=true\nTREADLING=true\nWEFT COLORS=true\n";
        } else {
          fileContents += "\nCOLOR PALETTE=true\nWEAVING=true\nWARP=true\nWEFT=true\nTIEUP=true\nCOLOR TABLE=true\nTHREADING=true\nWARP COLORS=true\nTREADLING=true\nWEFT COLORS=true\n";
        }


        //COLOR PALETTE DEFINITION
        fileContents += "[COLOR PALETTE]\n";
        fileContents += "Entries=" + (shuttles.length).toString() + "\n";
        fileContents += "Form=RGB\nRange=0,255\n";


        // WEAVING
        fileContents += "[WEAVING]\nShafts=";
        fileContents += numFrames(loom).toString();
        fileContents += "\nTreadles=";
        fileContents += numTreadles(loom).toString();
        fileContents += "\nRising Shed=yes\n";


        // WARP
        fileContents += "[WARP]\nThreads=";
        fileContents += warps(draft.drawdown).toString();

        var warpColors = [];
        for (var i = 0; i < draft.colShuttleMapping.length; i++) {
          if (!warpColors.includes(draft.colShuttleMapping[i])) {
            warpColors.push(draft.colShuttleMapping[i]);
          }
        }
        fileContents += "\nColors=" + warpColors.length.toString(); //check if this is correct, might just need an index into the palette

        //consider adding thickness and spacing in here at some point. 

        // WEFT
        fileContents += "\n[WEFT]\nThreads=";
        fileContents += wefts(draft.drawdown).toString();
        var weftColors = [];
        for (var i = 0; i < draft.colShuttleMapping.length; i++) {
          if (!weftColors.includes(draft.colShuttleMapping[i])) {
            weftColors.push(draft.colShuttleMapping[i]);
          }
        }

        //check if this is coorect, potentially just an index
        fileContents += "\nColors=" + weftColors.length.toString();

        // TIEUP?
        if (loom_settings.type == 'frame') {

          fileContents += "\n[TIEUP]\n";


          var treadles = [];
          for (var i = 0; i < loom.tieup.length; i++) {
            for (var j = 0; j < loom.tieup[i].length; j++) {
              if (loom.tieup[i][j] && !treadles.includes(j)) {
                treadles.push(j);
              }
            }
          }
          for (var i = 0; i < treadles.length; i++) {
            fileContents += (treadles[i] + 1).toString() + "=";
            var lineMarked = false;
            for (var j = 0; j < loom.tieup.length; j++) {
              if (loom.tieup[j][treadles[i]]) {
                if (lineMarked) {
                  fileContents += ",";
                }
                fileContents += (j + 1).toString();
                lineMarked = true;
              }
            }
            fileContents += "\n";
          }
        } else {
          fileContents += "\n";

        }



        //COLOR TABLE

        fileContents += "[COLOR TABLE]\n";
        //Reference: https://css-tricks.com/converting-color-spaces-in-javascript/ for conversion for hex to RGB
        var counter = 1;
        for (var i = 0; i < shuttles.length; i++) {
          fileContents += (counter).toString();
          counter = counter + 1;
          fileContents += "=";
          var hex = shuttles[i].color;
          if (hex.length == 7) {
            var r = "0x" + hex[1] + hex[2];
            var g = "0x" + hex[3] + hex[4];
            var b = "0x" + hex[5] + hex[6];

            fileContents += (+r).toString() + "," + (+g).toString() + "," + (+b).toString() + "\n";
          }
        }

        //THREADING 

        fileContents += "[THREADING]\n";
        for (var i = 0; i < loom.threading.length; i++) {
          var frame = loom.threading[i];
          if (frame != -1) {
            fileContents += (loom.threading.length - i).toString() + "=" + (frame + 1).toString() + "\n";
          }
        }


        //WARP COLORS (I believe this overwrites the default color specified in warps)
        fileContents += "[WARP COLORS]\n";
        for (var i = 0; i < draft.colShuttleMapping.length; i++) {
          fileContents += (i + 1).toString() + "=" + (draft.colShuttleMapping[(draft.colShuttleMapping.length) - (i + 1)] + 1).toString() + "\n";
        }

        //THIS WILL ONLY WORK WITH FRAME LOOM DRAFT STYLE
        if (loom_settings.type !== 'direct') {

          fileContents += "[TREADLING]\n";
          for (var i = 0; i < loom.treadling.length; i++) {
            if (loom.treadling[i].length != 0) {

              fileContents += (i + 1).toString() + "=";
              const commaSeparated = loom.treadling[i].map(el => (el + 1).toString()).join(',');
              fileContents += commaSeparated;
              fileContents += "\n";
            }
          }
        }

        //LIFT PLAN
        if (loom_settings.type == 'direct') {

          fileContents += "[LIFTPLAN]\n";
          for (var i = 0; i < loom.treadling.length; i++) {
            if (loom.treadling[i].length != 0) {

              fileContents += (i + 1).toString() + "=";
              const commaSeparated = loom.treadling[i].map(el => (el + 1).toString()).join(',');
              fileContents += commaSeparated;
              fileContents += "\n";
            }
          }
        }

        //WEFT COLORS
        fileContents += "[WEFT COLORS]\n";
        for (var i = 0; i < draft.rowShuttleMapping.length; i++) { // will likely have to change the way I import too
          fileContents += (i + 1).toString() + "=" + (draft.rowShuttleMapping[i] + 1).toString() + "\n";
        }

        const href: string = "data:" + fileType + ";base64," + btoa(fileContents);
        return Promise.resolve(href);
      },
      bmp: async (canvas: HTMLCanvasElement): Promise<string> => {
        return Promise.resolve(canvas.toDataURL("image/jpeg", 1));

      },
      png: async (canvas: HTMLCanvasElement): Promise<string> => {
        const blob: Blob = await new Promise(resolve => canvas.toBlob(resolve));
        return Promise.resolve(URL.createObjectURL(blob));
      },
      jpg: async (canvas: HTMLCanvasElement): Promise<string> => {
        return Promise.resolve(canvas.toDataURL("image/png"));
      }
    }


    this.loader = dloader;
    this.saver = dsaver;



  }

  clearAll() {
    this.tree.clear();
    this.ms.reset();
    this.ss.reset(),
      this.ns.clear();

  }




}
