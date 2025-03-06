import { ScrollDispatcher } from '@angular/cdk/overlay';
import { HttpClient } from '@angular/common/http';
import { Component, NgZone, OnInit, Optional, ViewChild } from '@angular/core';
import { getAnalytics, logEvent } from '@angular/fire/analytics';
import { Auth, User, authState } from '@angular/fire/auth';
import { MatDialog } from '@angular/material/dialog';
import { ExamplesComponent } from './core/modal/examples/examples.component';
import { LoadfileComponent } from './core/modal/loadfile/loadfile.component';
import { LoginComponent } from './core/modal/login/login.component';
import { MaterialModal } from './core/modal/material/material.modal';
import { createCell } from './core/model/cell';
import { Draft, DraftNode, DraftNodeProxy, FileObj, IndexedColorImageInstance, IndexedColorMediaProxy, LoadResponse, Loom, LoomSettings, NodeComponentProxy, Point, SaveObj, TreeNode, TreeNodeProxy } from './core/model/datatypes';
import { defaults, density_units, editor_modes, loom_types, origin_option_list } from './core/model/defaults';
import { copyDraft, getDraftName, initDraftWithParams } from './core/model/drafts';
import { copyLoom, copyLoomSettings, getLoomUtilByType } from './core/model/looms';
import utilInstance from './core/model/util';
import { AuthService } from './core/provider/auth.service';
import { DesignmodesService } from './core/provider/designmodes.service';
import { FileService } from './core/provider/file.service';
import { FilesystemService } from './core/provider/filesystem.service';
import { MediaService } from './core/provider/media.service';
import { MaterialsService } from './core/provider/materials.service';
import { NotesService } from './core/provider/notes.service';
import { OperationService } from './core/provider/operation.service';
import { StateService } from './core/provider/state.service';
import { SystemsService } from './core/provider/systems.service';
import { TreeService } from './core/provider/tree.service';
import { ViewerService } from './core/provider/viewer.service';
import { WorkspaceService } from './core/provider/workspace.service';
import { ZoomService } from './core/provider/zoom.service';
import { FilebrowserComponent } from './core/ui/filebrowser/filebrowser.component';
import { EditorComponent } from './editor/editor.component';
import { MixerComponent } from './mixer/mixer.component';
import { OperationComponent } from './mixer/palette/operation/operation.component';
import { MultiselectService } from './mixer/provider/multiselect.service';
import { ViewportService } from './mixer/provider/viewport.service';
import { ViewerComponent } from './viewer/viewer.component';
import { UntypedFormControl, Validators } from '@angular/forms';
import { SubdraftComponent } from './mixer/palette/subdraft/subdraft.component';
import { WelcomeComponent } from './core/modal/welcome/welcome.component';
import { VersionService } from './core/provider/version.service';
import { MatSidenav } from '@angular/material/sidenav';
import { ViewadjustService } from './core/provider/viewadjust.service';
import { ViewadjustComponent } from './core/viewadjust/viewadjust.component';
import { ShareComponent } from './core/modal/share/share.component';



@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})


export class AppComponent implements OnInit{
  title = 'app';

  @ViewChild(MixerComponent) mixer;
  @ViewChild(EditorComponent) editor;
  @ViewChild(ViewerComponent) viewer;
  @ViewChild('bitmapImage') bitmap: any;
  @ViewChild(ViewadjustComponent) viewadjust;


  //modals to manage
  filebrowser_modal: MatDialog |any;
  version_modal: MatDialog |any;
  upload_modal: MatDialog |any;
  example_modal: MatDialog |any;
  material_modal: MatDialog |any;
  loading: boolean;

  selected_origin: number;
  
  ui = {
    main: 'mixer',
    fullscreen: false,
    id: -1
  };

  views = [];

  scrollingSubscription: any;

  originOptions: any;

  loomOptions: any;
  
  unitOptions: any;

  editorModes: any;

  selected_editor_mode: any;

  current_version: string; 

  filename_form: UntypedFormControl;

  constructor(
    public auth: AuthService,
    private dialog: MatDialog,
    private dm: DesignmodesService,
    public ss: StateService,
    @Optional() private fbauth: Auth,
    public files: FilesystemService,
    private fs: FileService,
    private http: HttpClient,
    private media: MediaService,
    private ms: MaterialsService,
    public multiselect: MultiselectService,
    private notes: NotesService,
    private ops: OperationService,
    public scroll: ScrollDispatcher,
    public sys_serve: SystemsService,
    private tree: TreeService,
    public vp: ViewportService,
    public ws: WorkspaceService,
    public vas: ViewadjustService,
    public vs: ViewerService,
    public vers: VersionService,
    public zs: ZoomService,

    private zone: NgZone
  ){


    this.current_version = this.vers.currentVersion();
  
    this.originOptions = origin_option_list;
    this.loomOptions = loom_types;
    this.unitOptions = density_units;
    this.editorModes = editor_modes;
    this.selected_editor_mode = defaults.editor;

        //subscribe to the login event and handle what happens in that case 

        if (auth) {
          const success = authState(this.fbauth).subscribe(async user => {
             this.initLoginLogoutSequence(user) 
              
          })
    
       }

       this.scrollingSubscription = this.scroll
       .scrolled()
       .subscribe((data: any) => {
         this.onWindowScroll(data);
 });

  }

  private onWindowScroll(data: any) {
   // if(!this.manual_scroll){
     this.mixer.palette.handleWindowScroll(data);
    //}else{
     // this.manual_scroll = false;
   // }
  }



  ngOnInit(){

    this.filename_form = new UntypedFormControl(this.files.getCurrentFileName(), [Validators.required]);
    this.filename_form.valueChanges.forEach(el => {this.renameWorkspace(el.trim())})


    // const analytics = getAnalytics();
    // logEvent(analytics, 'onload', {
    //   items: [{ uid: this.auth.uid }]
    // });

    let dialogRef = this.dialog.open(WelcomeComponent, {
      height: '400px',
      width: '600px',
    });

  



  }



  ngAfterViewInit() {

    this.recenterViews();
  }


  clearAll() : void{

    this.vs.clearPin();
    this.vs.clearViewer();
    this.mixer.clearView();
    this.media.clearMedia();
    this.editor.clearAll();
    this.viewer.clearView();
    this.tree.clear();
    this.ss.clearTimeline();
    this.ms.reset();

  }




  /**
   * called from the editor when a new draft has been created. 
   * A new draft is created by either opening the draft editor with no draft selected
   * or opening the draft editor with a draft that has a parent (and therefore, a copy is created)
   * @param obj 
   */
  createNewDraftOnMixer(draft: Draft, loom: Loom, loom_settings: LoomSettings) : Promise<number>{

    let id = this.mixer.newDraftCreated(draft, loom, loom_settings); //this registers the draft with the tree. 
    this.tree.setDraftOnly(id, draft);
    this.tree.setLoom(id, loom);
    this.tree.setLoomSettings(id, loom_settings);
    return Promise.resolve(id);
  }

   /**
   * adds a state to the timeline. This should be called 
   * each time a user performs an action that they should be able to undo/redo
   */
    addTimelineState(){
  
     this.fs.saver.ada()
        .then(so => {
          this.ss.addMixerHistoryState(so);
        });
    }
  



  detailViewChange(){
   // this.details.weaveRef.rescale(this.render.getZoom());

  }


  /**
   * 
   */
  deleteCurrentFile(){
    // this.clearAll();
    // if(this.files.file_tree.length > 0){
    //   this.loadFromDB(this.files.file_tree[0].id)
    // }else{
    //   this.files.setCurrentFileInfo(this.files.generateFileId(), 'new blank file', '');
    //   this.open_files.push({
    //     id: this.files.current_file_id,
    //     name: this.files.current_file_name
    //   });
    // }
    // this.saveFile();
  }


  toggleEditorMode(){

    switch(this.selected_editor_mode){
      case 'draft':

        this.mixer.onClose();
        this.editor.onFocus();

        if(this.vs.getViewer() == -1){
          let obj = {
            warps: defaults.warps,
            wefts: defaults.wefts,
            type: defaults.loom_settings.type,
            epi: defaults.loom_settings.epi,
            units: defaults.loom_settings.units,
            frames: defaults.loom_settings.frames,
            treadles:defaults.loom_settings.treadles
          }
          this.generateBlankDraftAndPlaceInMixer(obj, 'toggle');

        }else{
          this.editor.loadDraft(this.vs.getViewer());
          this.editor.onFocus(); 
        }
  
        break;
      case 'mixer':
        this.editor.onClose();
        this.mixer.onFocus(this.editor.id);
        break;
    }


  }

    /**
   * this is emitted from the editor when someone has edited a draft that was generated by an operation. It makes a new subdraft object by copying the original draft and then places it on the mixer. 
   * @param obj 
   */
    cloneDraft(obj:any){
      let draft = copyDraft(obj.draft);
      draft.gen_name = 'copy of '+getDraftName(draft);
      let loom = copyLoom(obj.loom)
      let loom_settings = copyLoomSettings(obj.loom_settings);
      this.createNewDraftOnMixer(draft, loom, loom_settings).then(id => {
        this.vs.setViewer(id);
        this.editor.loadDraft(id);
        this.saveFile();
  
      })
    }

  /**
   * called by an emit on focus for editor, passes an object with:
   *  warps, wefts, type, epi, units, frames, treadles
   *  
   * generates a draft, loom, and loom settings before sending back to the app component to initate it 
   * within both draft detail and the mixer view. Returns a promise to streamline execution
   * 
   * @returns 
   */
  generateBlankDraftAndPlaceInMixer(obj: any, origin: 'toggle' | 'editor' | 'starter' ) : Promise<number>{

    //if it has a parent and it does not yet have a view ref. 
   //this.tree.setSubdraftParent(id, -1)
    const draft = initDraftWithParams({warps: obj.warps, wefts: obj.wefts});
  
    //use the local loom settings
      const loom_settings:LoomSettings = {
        type: obj.type,
        epi: obj.epi,
        units: <"cm" | "in" >obj.units,
        frames: obj.frames,
        treadles: obj.treadles
    }
  
     let loom_util = getLoomUtilByType(loom_settings.type);
      return loom_util.computeLoomFromDrawdown(draft.drawdown, loom_settings)
      .then(loom => {
        return this.createNewDraftOnMixer(draft, loom, loom_settings)})
      .then(draftid => {

        switch(origin){
          case 'toggle':
            this.editor.loadDraft(draftid);
            this.editor.onFocus();
            break;

          case 'starter':
            this.vs.setViewer(draftid);
            this.editor.loadDraft(draftid);
            this.editor.onFocus();
            this.saveFile();
            break;

          case 'editor':
            this.vs.setViewer(draftid);
            this.editor.loadDraft(draftid);
            this.editor.onFocus();
            this.saveFile();
            break;
        }

          return Promise.resolve(draftid);
        })
       



    }

  updateViewAdjustBar(){
    this.viewadjust.updatePosition();
  }


  recenterViews(){
    
    this.editor.centerView();
    this.mixer.centerView();
    // this.sim.centerView();
  }


  share(){
    const dialogRef = this.dialog.open(ShareComponent, {
      width: '600px',
      data: {fileid: this.files.getCurrentFileId()}
    });
  }

  /**
   * this is called when a user pushes save from the topbar
   * @param event 
   */
  public async downloadWorkspace(type: any) : Promise<any>{

    const link = document.createElement('a')


    switch(type){
      // case 'jpg': 

      // //this.printMixer();

      // break;

      // case 'wif': 
      //    this.mixer.downloadVisibleDraftsAsWif();
      //    return Promise.resolve(null);
      // break;

      case 'ada': 
      this.fs.saver.ada().then(out => {
          link.href = "data:application/json;charset=UTF-8," + encodeURIComponent(out.json);
          link.download =  this.files.getCurrentFileName() + ".ada";
          link.click();
        })
      break;

      case 'bmp':
        this.mixer.downloadVisibleDraftsAsBmp();
        return Promise.resolve(null);
      break;
    }
  }






    /**
   * this gets called when a new file is started from the topbar
   * @param result 
   */
    importNewFile(result: LoadResponse){
    

      this.processFileData(result.data)
      .then( data => {
        this.mixer.changeDesignmode('move')
        this.clearAll();
          console.log("imported new file", result, result.data)
        })
        .catch(console.error);
      
    }
  


  /**
   * this is called anytime a user event is fired, 
   * TODO, if the person was LOGGED IN and now LOGGED OUT
   * @param user 
   */
  initLoginLogoutSequence(user:User) {
    console.log("IN LOGIN/LOGOUT ")
    /** TODO: check also if the person is online */



    let searchParams = new URLSearchParams(window.location.search);
    if(searchParams.has('ex')){
      this.loadExampleAtURL(searchParams.get('ex'));  
      return;
    }

    if(searchParams.has('share')){
      this.loadFromShare(searchParams.get('share'));  
      return;
    }

    if(user === null){
      console.log("USER IS NULL")
      this.loadStarterFile();
    }else{

      if(this.auth.isFirstSession() || (!this.auth.isFirstSession() && this.isBlankWorkspace())){

        this.auth.getMostRecentFileIdFromUser(user).then(async fileid => {

          if(fileid !== null){

            const ada = await this.files.getFile(fileid).catch(e => {
              console.error("error on get file ", e)
            });


            const meta = await this.files.getFileMeta(fileid).catch(console.error);           

            if(ada === undefined){
                this.loadBlankFile();

              }else if(meta === undefined){
                this.files.setCurrentFileInfo(fileid, 'file name not found', '', '');
                this.prepAndLoadFile('file name not found', 'db', fileid, '', ada, '');
              
              }else{

                this.files.setCurrentFileInfo(fileid, meta.name, meta.desc, meta.from_share);
                this.prepAndLoadFile(meta.name,'db', fileid, meta.desc, ada,  meta.from_share);
              }

          }else{
             this.auth.getMostRecentAdaFromUser(user).then(async adafile => {
                if(adafile !== null){
                    let fileid = await this.files.convertAdaToFile(user.uid, adafile); 
                    console.log("convert ada to file id ", fileid)
            
                    let ada = await this.files.getFile(fileid);
                    let meta = await this.files.getFileMeta(fileid);           
                    
                    if(ada === undefined){
                      this.loadBlankFile();
                    }else if(meta === undefined){
                      this.files.setCurrentFileInfo(fileid, 'file name not found', '', '');
                      this.prepAndLoadFile('file name not found','db', fileid, '', ada, '');
      
                    }else{
                      this.files.setCurrentFileInfo(fileid, meta.name, meta.desc, meta.from_share);
                      this.prepAndLoadFile(meta.name, 'db', fileid, meta.desc, ada, meta.from_share);
                    }

                }else{
                  this.loadBlankFile();
                  return;
                }
             });
          }
        }) 

      }else{
        
        //this.loadBlankFile();
        this.saveFile();
        this.files.writeNewFileMetaData(
          user.uid, 
          this.files.getCurrentFileId(), 
          this.files.getCurrentFileName(), 
          this.files.getCurrentFileDesc(),
          this.files.getCurrentFileFromShare())

    
      }
      
    }
  }

  insertPasteFile(result: LoadResponse){
    this.processFileData(result.data).then(data => {

    //after we have processed the data, we need to now relink any images that were duplicated in the process. 
    let image_id_map = [];
    result.data.indexed_image_data.forEach(image => {
      let media_item: IndexedColorImageInstance = this.media.duplicateIndexedColorImageInstance(image.id);
      image_id_map.push({from: image.id, to: media_item.id})
    })

    
    result.data.ops.forEach(op => {

      let op_base = this.ops.getOp(op.name);
      op_base.params.forEach((param,ndx) => {

        if(param.type == 'file'){

          let from = op.params[ndx];
          let entry = image_id_map.find(el => el.from == from);

          if(entry !== undefined){
            let img_instance = <IndexedColorImageInstance> this.media.getMedia(entry.to);
            //this is just setting it locally, it needs to set the actual operation
            let op_node = this.tree.getOpNode(op.node_id);
            op_node.params[ndx] = {id: entry.to, data:img_instance.img};

          }
        }
      })
    })


      this.saveFile();
    }
    ).catch(console.error);
  }


  /**
   * runs code that (a) changes all loom types to jacquard and (b) sets all drafts to hidden
   */
  optimizeWorkspace() {

    //set the defaults
    this.ws.hide_mixer_drafts = true;
    this.ws.type = 'jacquard';

     const drafts = this.tree.getDraftNodes();
     drafts.forEach(draft => {
         draft.visible = false;
        
    })


    this.mixer.redrawAllSubdrafts();



  }


  /**
   * this function checks if the user has already started designing so that logging in does not override. 
   * it does this by checking if there is one or viewer drafts in the tree
   * @returns 
   */
  isBlankWorkspace() : boolean {

    if(this.tree.nodes.length == 0) return true;
    else if(this.tree.nodes.length == 1){
      let node = this.tree.nodes[0];
      if(node.type == 'draft'){
        let d = this.tree.getDraft(node.id);
        let loom = this.tree.getLoom(node.id);
        return utilInstance.isBlankDraft(d, loom);
      }else{
        return false;
      }
    }else{
      return false;
    }

  }

  async duplicateFileInDB(fileid: number){
    const ada = await this.files.getFile(fileid);
    const meta = await this.files.getFileMeta(fileid); 
    this.files.duplicate(this.auth.uid, meta.name+"-copy", meta.desc, ada, meta.from_share).then(fileid => {
      this.prepAndLoadFile(meta.name, 'db', fileid, meta.desc, ada, meta.from_share).then(res => {
        this.saveFile();
      });
    })
  }


    /**
     * when someone loads a URL of a shared example, 
     * the system is going to use the fileID in the url to lookup the file in the files database. 
     * it is then going to duplicate that file into the users file list. 
     * while doing so, it needs to copy over elements of the shared file that retain it's legacy and owner.
     * so if it is shared again, that information is retained. 
     * @param shareid 
     */
    async loadFromShare(shareid: string){
      let share_id = -1;
      console.log("LOAD FROM SHARE ", shareid, this.auth.isLoggedIn)

   

      //GET THE SHARED FILE
      this.files.isShared(shareid).then(share_obj => {

        if(share_obj == null){
          return Promise.reject("NO SHARED FILE EXISTS")
        }

        var int_shareid: number = +shareid;
        share_id = int_shareid;
        return Promise.all([this.files.getFile(int_shareid), share_obj, shareid]);

      }).then(file_objs=>{

       if(this.auth.isLoggedIn) this.loadFromShareWhileLoggedIn(file_objs);
       else this.loadFromShareWhileLoggedOut(file_objs);

       
      })
    }

    /**
     * if the user is logged in, this automatically duplicates the shared file into a new file within their 
     * local directory
     * @param file_objs 
     */
    loadFromShareWhileLoggedIn(file_objs:any){

      this.files.duplicate(this.auth.uid, file_objs[1].filename, file_objs[1].desc, file_objs[0], file_objs[2])
        .then(fileid => {
          return Promise.all([this.files.getFile(fileid), this.files.getFileMeta(fileid), fileid]);
        }).then(file_data => {
          return this.prepAndLoadFile(file_data[1].name, 'db', file_data[2], file_data[1].desc, file_data[0],file_data[1].from_share )
        }).catch(err => {
          console.error(err);
        })

    }

    /**
     * if the user isn't logged in, they should still be able to load the file locally. It should just get 
     * a new id in the case they eventually login. 
     * @param share_id 
     */
    loadFromShareWhileLoggedOut(file_objs: any){
      
      this.prepAndLoadFile(file_objs[1].filename, 'db', utilInstance.generateId(8), file_objs[1].desc, file_objs[0], file_objs[2]);
   

    }
  
  

  //must be online
  async loadFromDB(fileid: number){
    const ada = await this.files.getFile(fileid);
    const meta = await this.files.getFileMeta(fileid); 

    this.prepAndLoadFile(meta.name, 'db',fileid, meta.desc, ada, meta.from_share)
    .then(res => {
        this.saveFile();
    });
  
    
  }

  loadBlankFile(){
    this.clearAll();
    this.files.setCurrentFile(this.files.generateFileId(), 'new file', '', '')
    .then(res => {
      this.filename_form.setValue(this.files.getCurrentFileName())
      this.saveFile();
    });
  }

 

  /**
   * loading the starter file will not clear the prior workspace as it assumes that the space is empty on first load
   */
  loadStarterFile(){

    this.files.setCurrentFile(this.files.generateFileId(), 'welcome', '', '').then(res => {
      let obj = {
        warps: defaults.warps,
        wefts: defaults.wefts,
        type: defaults.loom_settings.type,
        epi: defaults.loom_settings.epi,
        units: defaults.loom_settings.units,
        frames: defaults.loom_settings.frames,
        treadles:defaults.loom_settings.treadles
      }

      this.filename_form.setValue(this.files.getCurrentFileName())

      this.generateBlankDraftAndPlaceInMixer(obj, 'starter');
    });

    
    
  }


  loadExampleAtURL(name: string){
    const analytics = getAnalytics();
    logEvent(analytics, 'onurl', {
      items: [{ uid: this.auth.uid, name: name }]
    });

    this.http.get('assets/examples/'+name+".ada", {observe: 'response'}).subscribe((res) => {
      console.log(res);
      if(res.status == 404) return;
      this.clearAll();
      return this.fs.loader.ada(name, 'upload',-1, '', res.body, '')
     .then(loadresponse => {
       this.loadNewFile(loadresponse, 'loadURL')
     });
    }); 
  }




  /**
   * this gets called when a new file is started from the topbar or a new file is reload via undo/redo
   */
  loadNewFile(result: LoadResponse, source: string) : Promise<any>{

    console.log("LOAD NEW FILE ", result)

   return this.files.setCurrentFile(result.id, result.name, result.desc, result.from_share)
   .then(res => {
    this.filename_form.setValue(this.files.getCurrentFileName())
    return this.processFileData(result.data)
   }).then(data => {

       if(source !== 'statechange'){
          if(this.tree.nodes.length > 0){
            this.selected_editor_mode = 'mixer';
          }else{
            this.selected_editor_mode = 'draft'; 
          }
       }else{
          this.selected_editor_mode = 'mixer'
       }
      });

    
  }

   /**
   * this uses the uploaded node data to create new nodes, in addition to any nodes that may already exist
   * @param nodes the nodes from the upload
   * @returns an array of uploaded ids mapped to unique ids in this instance
   */
   async loadNodes(nodes: Array<NodeComponentProxy>) : Promise<any> {

    const functions = nodes.map(n => this.tree.loadNode(<'draft'|'op'|'cxn'> n.type, n.node_id));
    return Promise.all(functions);

  }

  /**
   * uploads the relationships between the nodes as specified in a load file
   * @param id_map the map from uploaded ids to current ids generated by loadNodes
   * @param tns the uploaded treenode data
   * @returns an array of treenodes and the map associated at each tree node
   */
  async loadTreeNodes(id_map: Array<{prev_id: number, cur_id:number}>, tns: Array<TreeNodeProxy>) : Promise<Array<{tn:TreeNode,entry:{prev_id: number, cur_id: number}}>> {
    

    const updated_tnp: Array<TreeNodeProxy> = tns.map(tn => {
     
      //we need these here because firebase does not store arrays of size 0
      if(tn.inputs === undefined) tn.inputs = [];
      if(tn.outputs === undefined) tn.outputs = [];


      const input_list = tn.inputs.map(input => {
        if(typeof input === 'number'){
          const input_in_map = id_map.find(el => el.prev_id === input);

          if(input_in_map !== undefined){
            return {tn: input_in_map.cur_id, ndx: 0};
          }else{
            console.error("could not find matching node");
          }

        }else{
          const input_in_map = id_map.find(el => el.prev_id === input.tn);
          if(input_in_map !== undefined){
            return {tn: input_in_map.cur_id, ndx: input.ndx};
          }else{
            console.error("could not find matching node");
          }
        } 

       
      });

      const output_list:Array<any> = tn.outputs.map(output => {
          //handle files of old type, before inputs were broken into two fields
          if(typeof output === 'number'){
            const output_map = id_map.find(el => el.prev_id === output);
            if(output_map !== undefined){
             return {tn: output_map.cur_id, ndx: 0};
            }else{
              console.error("could not find matching node"); 
            }
          }else{
            
            const output_map = id_map.find(el => el.prev_id === output.tn);

            if(output_map !== undefined){
             return {tn: output_map.cur_id, ndx: output.ndx};
            }else{
              console.error("could not find matching node"); 
            }
          } 
      });
      

      const new_tn: TreeNodeProxy = {
        node: id_map.find(el => el.prev_id === tn.node).cur_id,
        parent: (tn.parent === null || tn.parent === -1) ? -1 : id_map.find(el => el.prev_id === tn.parent).cur_id,
        inputs: input_list,
        outputs: output_list
      }
      
      //console.log("new tn is ", new_tn);
      return new_tn;
    })

    const functions = updated_tnp.map(tn => this.tree.loadTreeNodeData(id_map, tn.node, tn.parent, tn.inputs, tn.outputs));
    return Promise.all(functions);

  }

  logout(){
    this.auth.logout();
  }


  /**
 * something in the materials library changed, check to see if
 * there is a modal showing materials open and update it if there is
 */
  public materialChange() {
  
    this.mixer.materialChange();
    this.editor.redrawSimulation();
    this.saveFile();
  }


  onCopySelections(){
    this.mixer.onCopySelections();
  }


onPasteSelections(){

    //check to make sure something has been copied
    if(this.multiselect.copy == undefined) return;

    this.multiselect.copy.then(ada => {

      return this.fs.loader.paste(ada).then(lr => {
        this.insertPasteFile(lr);
      });
    })

   
   

    this.multiselect.clearSelections();
    
  }

  openLoginDialog() {
    const dialogRef = this.dialog.open(LoginComponent, {
      width: '600px',
    });
  }

  openAboutDialog() {
    window.open('https://docs.adacad.org', '_blank');
  }

  openVersionDialog() {
    window.open('https://github.com/UnstableDesign/AdaCAD/releases', '_blank');


  }

  openHelp() {
    window.open('https://docs.adacad.org/', '_blank');
  }

  openBug() {
    window.open('https://github.com/UnstableDesign/AdaCAD/issues/new', '_blank');
  }





  /**
   * called when a user selects a file to open from the AdaFile Browser
   * @param selectOnly 
   * @returns 
   */
  openAdaFiles(selectOnly:boolean) {
      if(this.filebrowser_modal != undefined && this.filebrowser_modal.componentInstance != null) return;

    this.filebrowser_modal = this.dialog.open(FilebrowserComponent, {
      width: '600px',
      data: {
      selectOnly: selectOnly
     }});

    this.filebrowser_modal.componentInstance.onLoadFromDB.subscribe(event => {
      this.loadFromDB(event);
    });

    this.filebrowser_modal.componentInstance.onCreateFile.subscribe(event => {
      this.loadBlankFile();
    });

    this.filebrowser_modal.componentInstance.onDuplicateFile.subscribe(event => {

      this.duplicateFileInDB(event);
    });





  }


  openMaterials() {
    if(this.material_modal != undefined && this.material_modal.componentInstance != null) return;

    this.material_modal = this.dialog.open(MaterialModal, {data: {}});
    this.material_modal.componentInstance.onMaterialChange.subscribe(event => {
      this.viewer.redraw(this.vs.getViewer());
      if(this.selected_editor_mode == 'mixer') this.mixer.redrawAllSubdrafts();
      else this.editor.redraw();
      this.addTimelineState();

    });
  }


  openExamples() {
    if(this.example_modal != undefined && this.example_modal.componentInstance != null) return;

  this.example_modal = this.dialog.open(ExamplesComponent, {data: {}});
  this.example_modal.componentInstance.onLoadExample.subscribe(event => {
    this.loadExampleAtURL(event);
  });
  this.example_modal.componentInstance.onLoadSharedFile.subscribe(event => {
    this.loadFromShare(event);
  });
  this.example_modal.componentInstance.onOpenFileManager.subscribe(event => {
    this.openAdaFiles(false);
  });


}

  //need to handle this and load the file somehow
  openNewFileDialog() {
  if(this.upload_modal != undefined && this.upload_modal != null) return;


  this.upload_modal = this.dialog.open(LoadfileComponent, {
    data: {
      multiple: false,
      accepts: '.ada',
      type: 'ada',
      title: 'Select an AdaCAD (.ada) file to Import'
    }
  });

  this.upload_modal.afterClosed().subscribe(loadResponse => {
    if(loadResponse !== undefined && loadResponse != true) 
    this.loadNewFile(loadResponse, 'openFile');
    this.upload_modal = undefined;

  });
}



  /**
 * the drafts stored in adacad are ALWAYs oriented with 0,0 as the top left corner
 * any origin change is merely the rendering flipping the orientation. 
 * when the global settings change, the data itself does NOT need to change, only the rendering
 * @param e 
 */
originChange(e:any){
  this.selected_origin = e.value;
  this.ws.selected_origin_option = this.selected_origin;
  this.mixer.originChange(); //force a redraw so that the weft/warp system info is up to date
  this.editor.redraw();
  this.saveFile();
}




prepAndLoadFile(name: string, src: string, id: number, desc: string, ada: any, from_share: '') : Promise<any>{
  this.clearAll();
    return this.fs.loader.ada(name, src, id,desc, ada, from_share).then(lr => {
      return this.loadNewFile(lr, 'prepAndLoad');
    });
}

  /** 
   * Take a fileObj returned from the fileservice and process
   */
async processFileData(data: FileObj) : Promise<string|void>{

  this.loading = true;
  let entry_mapping = [];

  // console.log("PROCESSING ", data)

  //1. filter any operations with a parameter of type file, and load the associated file. 
  const images_to_load = [];

  if(data.filename !== 'paste'){
    //only load in new files if this is a true load event, if it is pasting from exisitng files, it doesn't need to re-analyze the images. 
    if(utilInstance.sameOrNewerVersion(data.version, '4.1.7')){
      //LOAD THE NEW FILE OBJECT
      data.indexed_image_data.forEach(el => {
      images_to_load.push({id: el.id, ref: el.ref, data:{colors: el.colors, color_mapping: el.color_mapping}});
    })

    }else{
      data.ops.forEach(op => {
        const internal_op = this.ops.getOp(op.name); 
        if(internal_op === undefined || internal_op == null|| internal_op.params === undefined) return;
        const param_types = internal_op.params.map(el => el.type);
        param_types.forEach((p, ndx) => {
              //older version stored the media object reference in the parameter
              if(p == 'file'){
                let new_id = utilInstance.generateId(8);
                images_to_load.push({id: new_id, ref: op.params[ndx], data:null});
                op.params[ndx] = new_id; //convert the value stored in memory to the instance id. 
              }
        });
      })

    }
  }
  

  return this.media.loadMediaFromFileLoad(images_to_load).then(el => {
    //2. check the op names, if any op names are old, relink the newer version of that operation. If not match is found, replaces with Rect. 
   // console.log("REPLACE OUTDATED OPS")
    return this.tree.replaceOutdatedOps(data.ops);
  })
  .then(correctedOps => {    
    data.ops = correctedOps; 
    //console.log(" LOAD NODES")
    return this.loadNodes(data.nodes)
  })
  .then(id_map => {
      entry_mapping = id_map;
    //  console.log(" LOAD TREE Nodes")
      return this.loadTreeNodes(id_map, data.treenodes);
    }
  ).then(treenodes => {

    const seednodes: Array<{prev_id: number, cur_id: number}> = treenodes
      .filter(tn => this.tree.isSeedDraft(tn.tn.node.id))
      .map(tn => tn.entry);
    
    const seeds: Array<{entry, id, draft, loom, loom_settings, render_colors, scale, draft_visible}> = seednodes
    .map(sn =>  {


        let d:Draft =null;
        let loom:Loom = null;
        let render_colors = true;
        let draft_visible = true;
        let scale = 1;

      const draft_node = data.nodes.find(node => node.node_id === sn.prev_id);

      let ls: LoomSettings = {
        frames: this.ws.min_frames,
        treadles: this.ws.min_treadles,
        epi: this.ws.epi,
        units: this.ws.units,
        type: this.ws.type
      }

      if(draft_node !== undefined){

        const located_draft:DraftNodeProxy = data.draft_nodes.find(draft => draft.draft_id === draft_node.node_id);

        if(located_draft === undefined){
          console.log("Looking for ", draft_node.node_id,"in", data.draft_nodes.map(el => el.draft_id))
          console.error("could not find draft with id in draft list");
        }
        else{
          //console.log("LOCATED DRAFT ", located_draft)
          d = copyDraft(located_draft.draft)
          ls = copyLoomSettings(located_draft.loom_settings);
          loom = copyLoom(located_draft.loom);
          if(located_draft.render_colors !== undefined) render_colors = located_draft.render_colors; 
          if(located_draft.scale !== undefined) scale = located_draft.scale; 
          if(located_draft.draft_visible !== undefined) draft_visible = located_draft.draft_visible; 
        } 

      }else{
        console.error("draft node could not be found")
      }


      if(d !== null && d !== undefined){
        d.id = (sn.cur_id); //do this so that all draft ids match the component / node ids
      }else{
        d = initDraftWithParams({warps: 1, wefts: 1, drawdown: [[false]]});
        d.id = (sn.cur_id);
      }

        return {
          entry: sn,
          id: sn.cur_id,
          draft: d,
          loom: loom,
          loom_settings: ls,
          render_colors: render_colors,
          scale: scale,
          draft_visible: draft_visible
          }
      
    });

    const seed_fns = seeds.map(seed => this.tree.loadDraftData(seed.entry, seed.draft, seed.loom,seed.loom_settings, seed.render_colors, seed.scale, seed.draft_visible));

    const op_fns = data.ops.map(op => {
      const entry = entry_mapping.find(el => el.prev_id == op.node_id);
      return this.tree.loadOpData(entry, op.name, op.params, op.inlets);
    });

    return Promise.all([seed_fns, op_fns]);

  })
  .then(el => {
      return this.tree.validateNodes();
  })
  .then(el => {
    //console.log("performing top level ops");
      return  this.tree.performTopLevelOps();
  })
  .then(el => {
    //delete any nodes that no longer need to exist

    this.tree.getDraftNodes()
    .filter(el => el.draft === null)
    .forEach(el => {
      if(this.tree.hasParent(el.id)){
        el.draft = initDraftWithParams({warps: 1, wefts: 1, pattern: [[createCell(false)]]});
        el.draft.id = el.id;
      } else{
        this.tree.removeNode(el.id);
      } 
    })
  })
  .then(el => {

    return this.tree.nodes.forEach(node => {
      
      if(!(node.component === null || node.component === undefined)) return;

      const entry = entry_mapping.find(el => el.cur_id === node.id);
      if(entry === undefined) return;
      switch (node.type){
        case 'draft':
          if(!this.tree.hasParent(node.id)){
            this.mixer.loadSubDraft(node.id, this.tree.getDraft(node.id), data.nodes.find(el => el.node_id === entry.prev_id), data.draft_nodes.find(el => el.node_id === entry.prev_id));
          }
          break;
        case 'op':
          const op = this.tree.getOpNode(node.id);
          this.mixer.loadOperation(op.id, op.name, op.params, op.inlets, data.nodes.find(el => el.node_id === entry.prev_id).topleft);
          break;
        case 'cxn':

          //only load UI for connections that go from draft to operation
          let froms = this.tree.getInputs(node.id);
          if(froms.length > 0 && this.tree.getNode(froms[0]).type === 'draft')  this.mixer.loadConnection(node.id)
          break;
      }
    })


  })
  .then(el => {

    //NOW GO THOUGH ALL DRAFT NODES and ADD IN DATA THAT IS REQUIRED
    data.draft_nodes
    .forEach(np => {

      const new_id = entry_mapping.find(el => el.prev_id === np.node_id);
      const node = this.tree.getNode(new_id.cur_id);
      if(node === undefined) return;
      (<DraftNode> node).draft.ud_name = np.draft_name;
      (<DraftNode> node).loom_settings = np.loom_settings; 
      (<DraftNode> node).loom = copyLoom(np.loom); 
      if(np.render_colors !== undefined) (<DraftNode> node).render_colors = np.render_colors; 
      if(np.draft_visible !== undefined) (<DraftNode> node).visible = np.draft_visible; 
      else (<DraftNode> node).visible = !this.ws.hide_mixer_drafts;
      if(np.scale !== undefined) (<DraftNode> node).scale = np.scale; 
    })

   this.tree.getOpNodes().forEach(op => {
    (<OperationComponent> op.component).updateChildren(this.tree.getNonCxnOutputs(op.id));
   })


    data.notes.forEach(note => {
      this.mixer.createNote(note);
  });


  })
  .then(res => {    

    this.loading = false;
    this.updateOrigin(this.ws.selected_origin_option);

    this.mixer.refreshOperations();
    this.mixer.renderChange();
    this.editor.renderChange();



    return Promise.resolve('alldone')
  })
  .catch(e => {
    this.loading = false;
    console.log("ERROR THOWN in process", e);
    this.clearAll();
  });






}



printTreeStatus(name: string, treenode: Array<TreeNode>){

  treenode.forEach(tn => {
    if(tn === undefined){
      console.log("Undefined Node", tn); 
      return;
    }

    if(tn.inputs === undefined){
      console.log("Undefined Inputs", tn); 
      return;  
    }

    if(tn.outputs === undefined){
      console.log("Undefined Outputs", tn); 
      return;  
    }
    
    switch(tn.node.type){
      case 'cxn':
        if(tn.inputs.length !== 1 || tn.outputs.length !== 1)
        console.log("Invalid Number of Inputs/Outputs on Connection", tn); 
        break;

      case 'draft':
          if(tn.inputs.length > 1)
          console.log("Invalid Number of Inputs/Outputs on Draft", tn); 
          break;
    }


  });
}



saveFile(){
  //if this user is logged in, write it to the
  this.fs.saver.ada()
    .then(so => {
      this.ss.addMixerHistoryState(so);
    });
}

setDraftsViewable(val: boolean){
  this.ws.hide_mixer_drafts = val;
}

setAdvancedOperations(val: boolean){
  this.ws.show_advanced_operations = val;
  this.mixer.refreshOperations();
}


openInEditor(id: number){
  this.vs.clearPin();
  this.vs.setViewer(id);
  this.selected_editor_mode = 'draft';
  this.toggleEditorMode();
}

drawModeChange(mode: string){
  this.editor.drawModeChange(mode);
} 


/**
 * TODO: because it reloads the file, and reassigns IDs to drafts, there is no way to link the previous draft detail in the editor
 * with what it's new counterpart will be. For now, I'll just force to mixer view
 */
redo() {

  let so: SaveObj = this.ss.restoreNextMixerHistoryState();
  if(so === null || so === undefined) return;

    this.mixer.clearView();
    this.editor.clearAll();
    this.viewer.clearView();
    this.tree.clear();
    
  this.fs.loader.ada(
    this.files.getCurrentFileName(),
    'redo', 
    this.files.getCurrentFileId(),
    this.files.getCurrentFileDesc(),  
    so,
    this.files.getCurrentFileFromShare()
  )
  .then(lr =>  this.loadNewFile(lr, 'statechange'));

 
}


/**
 * TODO: because it reloads the file, and reassigns IDs to drafts, there is no way to link the previous draft detail in the editor
 * with what it's new counterpart will be. For now, I'll just force to mixer view
 */
  undo() {

  
    let so: SaveObj = this.ss.restorePreviousMixerHistoryState();
    if(so === null || so === undefined) return;
    
    this.mixer.clearView();
    this.editor.clearAll();
    this.viewer.clearView();
    this.tree.clear();


    this.fs.loader.ada(
      this.files.getCurrentFileName(), 
      'undo', 
      this.files.getCurrentFileId(), 
      this.files.getCurrentFileDesc(), 
      so,
      this.files.getCurrentFileFromShare()
    ).then(lr => {
      this.loadNewFile(lr, 'statechange');


    }
    
    );

  
  }

  selectOriginOption(value: number){
    this.ws.selected_origin_option = value;
    this.mixer.originChange(value);

  }

  selectLoom(value: string){
    this.ws.type = value;
    //redraw?
  }

  selectUnit(value: "in" | 'cm'){
    this.ws.units = value;
    //redraw?
  }

  selectEpi(value: number){
    this.ws.epi = value;
    //redraw?
  }

  /**
   * this emerges from the detail or simulation when something needs to trigger the mixer to update
   */
  updateMixer(){
  }

  updateDraftName(id: any){
    
    if(id == -1) return;

    if(this.tree.hasParent(id)){
      let parent = this.tree.getSubdraftParent(id);
      let comp= this.tree.getComponent(parent);
      (<OperationComponent> comp).draftContainers.forEach(el => el.updateName());
    }else{
      let comp= this.tree.getComponent(id);
      (<SubdraftComponent> comp).draftcontainer.updateName();
    }
  }

  renameWorkspace(name: string){
    let id = this.files.getCurrentFileId();
    this.files.renameFile(id, name);
  }



   /**
    * the origin must be updated after the file has been loaded. 
    * @param selection 
    */
  updateOrigin(selection: number){
    this.selected_origin = selection
    
  }

  updateMixerView(event: any){
    this.mixer.renderChange(event);
  }

  /**
   * used to set the default value on the slider
   */
  getActiveZoomIndex() : number{
    if(this.viewer !== undefined && this.viewer.view_expanded){
      return this.zs.zoom_table_ndx_viewer;
    }else if(this.selected_editor_mode == 'mixer'){
      return this.zs.zoom_table_ndx_mixer;
    } else {
      return this.zs.zoom_table_ndx_editor;
    }
  }


  zoomToFit(){

    const view_window:HTMLElement = document.getElementById('scrollable-container');
    if(view_window === null || view_window === undefined) return;


    if(this.viewer.view_expanded){
      this.viewer.renderChange();
    }else if(this.selected_editor_mode == 'mixer'){

      let selections = this.multiselect.getSelections();  

      let node_list = (selections.length == 0) ? this.tree.getNodeIdList() : selections;
      let note_list = (selections.length == 0) ? this.notes.getNoteIdList() : [];

      const b_nodes = this.tree.getNodeBoundingBox(node_list);
      const n_nodes =  this.notes.getNoteBoundingBox(note_list);
      const bounds = utilInstance.mergeBounds([b_nodes, n_nodes]);
      
      if(bounds == null) return;

      let prior = this.zs.getMixerZoom();
      this.zs.zoomToFitMixer(bounds, view_window.getBoundingClientRect());
      this.mixer.renderChange(prior);

      //since bounds is in absolute terms (relative to the child div, we need to convert the top left into the scaled space)
      view_window.scroll({
        top: bounds.topleft.y*this.zs.getMixerZoom(),
        left: bounds.topleft.x*this.zs.getMixerZoom(),
        behavior: "instant",
      })





    } else {
     // this.zs.zoomToFitEditor()
      this.editor.renderChange();
    }
  }

  zoomOut(){

    if(this.viewer.view_expanded){
      this.zs.zoomOutViewer();
      this.viewer.renderChange();
    }else if(this.selected_editor_mode == 'mixer'){
      const prior = this.zs.getMixerZoom();
      this.zs.zoomOutMixer();
      this.mixer.renderChange(prior);




    } else {
      this.zs.zoomOutEditor()
      this.editor.renderChange();
    }
  }

  zoomIn(){
    if(this.viewer.view_expanded){
      this.zs.zoomInViewer();
      this.viewer.renderChange();
    }else if(this.selected_editor_mode == 'mixer'){
      const prior = this.zs.getMixerZoom();
      this.zs.zoomInMixer();
      this.mixer.renderChange(prior);
    } else {
      this.zs.zoomInEditor()
      this.editor.renderChange();
    }

  }

  /**
   * this function looks at all subdrafts and operations on the palette and repositons them such that they do not overlap eachother.
   * It works by
   */
  onExplode(){

    this.mixer.explode();

  }

  zoomChange(ndx: number){
    if(this.viewer.view_expanded){
      this.zs.setZoomIndexOnViewer(ndx);
      this.viewer.renderChange();
    }else if(this.selected_editor_mode == 'mixer'){
      this.zs.setZoomIndexOnMixer(ndx);
      this.mixer.renderChange();
    } else {
      this.zs.setZoomIndexOnEditor(ndx)
      this.editor.renderChange();
    }
  }

  saveDraftAs(format: string){

    if(!this.vs.hasViewer()) return;

    let draft:Draft = this.tree.getDraft(this.vs.getViewer());
    let b = this.bitmap.nativeElement;

    switch(format){
      case 'bmp':
        utilInstance.saveAsBmp(b, draft, this.ws.selected_origin_option, this.ms, this.fs)
        break;
      case 'jpg':
        let visvars = this.viewer.getVisVariables();
        utilInstance.saveAsPrint(b, draft, visvars.use_floats, visvars.use_colors, this.ws.selected_origin_option, this.ms, this.sys_serve, this.fs)
        break;
      case 'wif':
        let loom = this.tree.getLoom(this.vs.getViewer() );
        let loom_settings = this.tree.getLoomSettings(this.vs.getViewer() );
        utilInstance.saveAsWif(this.fs, draft, loom, loom_settings)
      break;
    }


  }

}
