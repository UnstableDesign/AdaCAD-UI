import { inject, Injectable } from '@angular/core';
import { defaults as LibDefaults, LoomSettings, setMaxArea } from 'adacad-drafting-lib';
import { Subject } from 'rxjs';
import { FileMeta } from '../model/datatypes';
import { defaults } from '../model/defaults';
import { FirebaseService } from './firebase.service';

@Injectable({
  providedIn: 'root'
})

/**
 * store any global workspace settings here:
 * Sync these with firebase so they are remembered across user sessions
 */
export class WorkspaceService {


  file_favorites: Array<number> = [];
  min_frames: number = defaults.loom_settings.frames;
  min_treadles: number = defaults.loom_settings.treadles;
  type: string = defaults.loom_settings.type; //'rigid', 'direct', 'frame', 'jacquard'
  epi: number = defaults.loom_settings.epi;
  ppi: number = defaults.loom_settings.ppi;
  units: 'in' | 'cm' = <'in' | 'cm'>defaults.loom_settings.units;
  oversize_dim_threshold: number = defaults.oversize_dim_threshold;
  max_draft_input_area: number = LibDefaults.max_area;

  show_materials: boolean = defaults.show_materials;
  black_cell_up: boolean = defaults.black_cell_up;
  number_threading: boolean = defaults.number_threading;

  hide_mixer_drafts: boolean = defaults.hide_mixer_drafts;
  show_advanced_operations: boolean = defaults.show_advanced_operations;
  /**
   * when looking at the draft viewer, where should the (0, 0) point of the drawdown sit. 
   * 0 top right, 1 bottom right, 2 bottom left, 3 top left
   */
  selected_origin_option: number = defaults.selected_origin_option;

  /*
  these thresholds help control for slowdowns
  */
  force_jacquard_threshold: number = defaults.force_jacquard_threshold;
  largest_lcm_factor: number = defaults.largest_lcm_factor;

  /*
  store information associated with the current file
  */
  private current_file: FileMeta = {
    id: -1,
    name: 'no name',
    desc: '',
    from_share: '',
    share_owner: ''

  }

  onFileOpen = new Subject<FileMeta>();
  onFileOpen$ = this.onFileOpen.asObservable();

  onFilenameUpdated = new Subject<string>();
  onFilenameUpdated$ = this.onFilenameUpdated.asObservable();

  fb = inject(FirebaseService);

  constructor() { }


  public setCurrentFile(meta: FileMeta) {
    console.log("SETTING CURRENT FILE ", meta)
    this.current_file = meta;
    this.onFileOpen.next(meta);
    this.onFilenameUpdated.next(meta.name);
  }

  public getCurrentFile(): FileMeta {
    return this.current_file;
  }

  public setCurrentFileName(name: string) {
    this.current_file.name = name;
    this.onFilenameUpdated.next(this.current_file.name);
  }

  public setCurrentFileDesc(desc: string) {
    this.current_file.desc = desc;
  }

  public setCurrentDraftSizeLimit(limit: number) {
    setMaxArea(limit);
    this.max_draft_input_area = limit;
  }
  public setOversizeRendering(limit: number) {
    this.oversize_dim_threshold = limit;
  }


  getWorkspaceLoomSettings(): LoomSettings {
    const ls: LoomSettings = {
      type: this.type,
      epi: this.epi,
      ppi: this.ppi,
      frames: this.min_frames,
      treadles: this.min_treadles,
      units: this.units
    }
    return ls;
  }


  initDefaultWorkspace() {
    this.min_frames = defaults.loom_settings.frames;
    this.min_treadles = defaults.loom_settings.treadles;
    this.type = defaults.loom_settings.type; //'rigid', 'direct', 'frame', 'jacquard'
    this.epi = defaults.loom_settings.epi;
    this.ppi = defaults.loom_settings.ppi;
    this.units = <'in' | 'cm'>defaults.loom_settings.units;
    this.show_materials = defaults.show_materials;
    this.black_cell_up = defaults.black_cell_up;
    this.number_threading = defaults.number_threading;
    this.selected_origin_option = defaults.selected_origin_option;
    this.hide_mixer_drafts = defaults.hide_mixer_drafts;
    this.show_advanced_operations = defaults.show_advanced_operations;
    this.oversize_dim_threshold = defaults.oversize_dim_threshold;
    this.max_draft_input_area = LibDefaults.max_area;

  }

  loadWorkspace(data) {
    this.min_frames = data.min_frames ?? defaults.loom_settings.frames;
    this.min_treadles = data.min_treadles ?? defaults.loom_settings.treadles;
    this.type = data.type ?? defaults.loom_settings.type;
    this.epi = data.epi ?? defaults.loom_settings.epi;
    this.ppi = data.ppi ?? defaults.loom_settings.ppi;
    this.units = data.units ?? defaults.loom_settings.units;
    this.show_materials = data.show_materials ?? defaults.show_materials;
    this.black_cell_up = data.black_cell_up ?? defaults.black_cell_up;
    this.number_threading = data.number_threading ?? defaults.number_threading;
    this.selected_origin_option = data.selected_origin_option ?? defaults.selected_origin_option;
    this.file_favorites = (data.file_favorites === undefined) ? [] : data.file_favorites;
    this.hide_mixer_drafts = (data.hide_mixer_drafts === undefined) ? true : data.hide_mixer_drafts;
    this.show_advanced_operations = (data.show_advanced_operations === undefined) ? false : data.show_advanced_operations;
    this.max_draft_input_area = (data.max_draft_input_area === undefined) ? LibDefaults.max_area : data.max_draft_input_area;
    this.oversize_dim_threshold = (data.oversize_dim_threshold === undefined) ? defaults.oversize_dim_threshold : data.oversize_dim_threshold;
    this.show_advanced_operations = (data.show_advanced_operations === undefined) ? false : data.show_advanced_operations;


    if (this.max_draft_input_area !== LibDefaults.max_area) {
      setMaxArea(this.max_draft_input_area)
    }
  }


  isFrame(): boolean {
    if (this.type === 'frame') return true;
    return false;
  }

  // addAuthor(author_id: string){
  //     this.authors.push(author_id);
  // }


  /**
   * given an array of looms, infers the data from what is most commonly used
   * this assumes that most exports will have common loom data
   * @param looms 
   */
  // async inferData(loom_settings: Array<LoomSettings>) : Promise<any> {
  //   if(loom_settings.length === 0) return Promise.resolve("no looms");

  //   //filter out null or undefined looms
  //   loom_settings = loom_settings.filter(el => !(el === undefined || el === null)); 


  //   this.min_frames = utilInstance.getMostCommon(
  //     loom_settings.map(el => el.frames)
  //   );
  //   this.min_treadles = utilInstance.getMostCommon(
  //     loom_settings.map(el => el.treadles)
  //   );
  //   this.type = utilInstance.getMostCommon(
  //     loom_settings.map(el => el.type)
  //   );
  //   this.units = utilInstance.getMostCommon(
  //     loom_settings.map(el => el.units)
  //   );

  //   this.epi = utilInstance.getMostCommon(
  //     loom_settings.map(el => el.epi)
  //   );

  //   return "done";
  // }

  exportWorkspace(): any {
    return {
      min_frames: this.min_frames,
      min_treadles: this.min_treadles,
      type: this.type,
      epi: this.epi,
      ppi: this.ppi,
      units: this.units,
      show_materials: this.show_materials,
      black_cell_up: this.black_cell_up,
      number_threading: this.number_threading,
      selected_origin_option: this.selected_origin_option,
      file_favorites: this.file_favorites.slice(),
      hide_mixer_drafts: this.hide_mixer_drafts,
      show_advanced_operations: this.show_advanced_operations,
      oversize_dim_threshold: this.oversize_dim_threshold,
      max_draft_input_area: this.max_draft_input_area
    }
  }

  toggleFavorite(id: number) {
    const found = this.file_favorites.find(el => el === id);
    if (found) {
      this.file_favorites = this.file_favorites.filter(el => el !== id)
    } else {
      this.file_favorites.push(id);
    }
  }

  isFavorite(id: number): boolean {
    const found = this.file_favorites.find(el => el === id);
    if (found === undefined) return false;
    else return true;
  }

}
