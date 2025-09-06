import { Injectable, NgZone, inject } from '@angular/core';
import { Auth, authState, getAuth } from '@angular/fire/auth';
import { get as fbget, getDatabase, onChildAdded, onChildRemoved, onDisconnect, onValue, orderByChild, update, ref as fbref, ref, remove, query, onChildChanged, set } from '@angular/fire/database';
import { Observable, Subject } from 'rxjs';
import { FilebrowserComponent } from '../ui/filebrowser/filebrowser.component';
import { SaveObj, ShareObj } from '../model/datatypes';
import { Database } from '@angular/fire/database';
import { generateId } from 'adacad-drafting-lib';



@Injectable({
  providedIn: 'root'
})
export class FilesystemService {
  private auth = inject(Auth, { optional: true });
  private db = inject(Database);
  private zone = inject(NgZone)

  file_tree_change$ = new Subject<any>();
  file_saved_change$ = new Subject<any>();
  shared_file_change$ = new Subject<any>();
  public_file_change$ = new Subject<any>();

  file_tree: Array<any> = [];
  public_files: Array<any> = [];

  private current_file_id: number = -1;
  public current_file_name: string = '';
  public current_file_desc: string = '';
  public current_file_from_share: string = '';

  connected: boolean = false;

  updateUItree: Observable<Array<any>>;


 constructor() {

      const presenceRef = ref(this.db, "disconnectmessage");
     
      // Write a string when this client loses connection
      onDisconnect(presenceRef).set("I disconnected!");

      const connectedRef = ref(this.db, ".info/connected");
      onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
          console.log("connected");
          this.connected = true;
        } else {
          console.log("not connected");
          this.connected = false;
        }
      });

      this.file_tree = [];

      //SETUP COLLECTION OF SHARED FILES (DOES NOT REQUIRE LOGIN)
      const sharedFiles = query(ref(this.db, 'shared'));

      onChildAdded(sharedFiles, (childsnapshot) => {
        //only add values that haven't already been added
        if(this.file_tree.find(el => el.id === parseInt(childsnapshot.key)) !== undefined){
            this.shared_file_change$.next(this.file_tree.slice());
        }

        if(childsnapshot.val().public){
          if(this.public_files.find(el => el.id === parseInt(childsnapshot.key)) === undefined){
            this.public_files.push({id: childsnapshot.key, val: childsnapshot.val()})
            this.public_file_change$.next(this.public_files.slice());
          }
        }
      }); 

      onChildChanged(sharedFiles, (data) => {
        const ndx = this.file_tree.findIndex(el => parseInt(el.id) === parseInt(data.key));
        if(ndx !== -1){

          this.isShared(data.key).then(res => {
            this.file_tree[ndx].shared = res;
            this.shared_file_change$.next(this.file_tree.slice());
          }).catch(err => console.error("caught"))
 
        }

        if(data.val().public){
          const ndx = this.public_files.findIndex(el => el.id == data.key);
          if(ndx !== -1){
            this.public_files[ndx].val = data.val();
            this.public_file_change$.next(this.public_files.slice());
          }
        }

      });

        //needs to redraw the files list 
        onChildRemoved(sharedFiles, (removedItem) => {

          const removedId = removedItem.key;
          const ndx = this.file_tree.findIndex(el => parseInt(el.id) === parseInt(removedId));
          if(ndx !== -1){
              this.file_tree[ndx].shared = null;
              this.shared_file_change$.next(this.file_tree.slice());
          }

          if(removedItem.val().public){
            this.public_files = this.public_files.filter(el => el.id !== removedId);
            this.public_file_change$.next(this.public_files.slice());
          }
          
        });
      


      authState(this.auth).subscribe(user => {

        if(user == null){
          this.file_tree = [];
          return;
        } 
       
        
        const userFiles = query(ref(this.db, 'users/'+user.uid+'/files'), orderByChild('timestamp'));

        //called once per item, then on subsequent changes
        onChildAdded(userFiles, (childsnapshot) => {

          //only add values that haven't already been added
          if(this.file_tree.find(el => el.id === parseInt(childsnapshot.key)) === undefined){
            
            this.addToTree(parseInt(childsnapshot.key), childsnapshot.val(), undefined);


            this.isShared(childsnapshot.key).then(res => {
              this.updateShareObj(parseInt(childsnapshot.key), res);
              this.file_tree_change$.next(this.file_tree.slice());

            }).catch(err => {
              //file note shared 
            })


          }
        }); 

        

        

       
    
        //called when anything in meta changes
        onChildChanged(userFiles, (data) => {
            const ndx = this.file_tree.findIndex(el => parseInt(el.id) === parseInt(data.key));
            if(ndx !== -1){
              this.file_tree[ndx].meta.name = data.val().name;

              this.isShared(data.key).then(res => {
                this.file_tree[ndx].shared = res;
                this.file_tree_change$.next(this.file_tree.slice());

              }).catch(err => {
                this.file_tree_change$.next(this.file_tree.slice());
              })
     
            }
        });

       
        
        //needs to redraw the files list 
        onChildRemoved(userFiles, (removedItem) => {
          const removedId = removedItem.key;
          this.file_tree = this.file_tree.filter(el => parseInt(el.id) !== parseInt(removedId));
          this.file_tree_change$.next(this.file_tree.slice());
        });

      
      });

        
  }

  /**
    sets the current file data locally 
   */
  public setCurrentFile(id: number, name: string, desc: string, from_share: string) : Promise<boolean>{

        this.setCurrentFileInfo(id, name, desc, from_share);
        return Promise.resolve(true);
 
  }

  // public unloadFile(id: number){
  //   this.loaded_files = this.loaded_files.filter(el => el.id !== id);
  //   if(this.current_file_id == id) this.current_file_id = -1;
  //   this.loaded_file_change$.next(this.file_tree.slice());

  // }

  public setCurrentFileId(id: number){
    this.current_file_id = id;
  }

  public getCurrentFileId(){
    return this.current_file_id;
  }

  public getCurrentFileName() : string{
    return this.current_file_name;
  }

  public getCurrentFileDesc() : string{
    return this.current_file_desc;
  }

  public getCurrentFileFromShare() : string{
    return this.current_file_from_share;
  }



  
  public changeObserver(target: FilebrowserComponent) : Observable<Array<any>>{
    return new Observable<Array<any>>((observer) => {

      const handler = observer.next(this.file_tree);
    }) 
  }
  

  public clearTree(){
    this.file_tree = [];
  }
  


  /**
   * adds to the local tree for the UI
   */
  addToTree(fileid: number, meta: any, shared: ShareObj){

    var dateFormat = new Date(meta.timestamp);
    meta.date = dateFormat.toLocaleDateString();

    this.file_tree.unshift({
      id: fileid,
      meta: meta,
      shared: shared
    })
  }

  /**
   * adds to the local tree for the UI
   */
  updateShareObj(fileid: number, shared: ShareObj){

    const ndx = this.file_tree.findIndex(el => el.id == fileid);
    if(ndx !== -1){
      this.file_tree[ndx].shared = shared;
    }
  }


  /**
   * sets the current metadata locally only
   * @param fileid 
   * @param name 
   * @param desc 
   */
  setCurrentFileInfo(fileid: number, name: string, desc: string, from_share: string){
   
    if(fileid === null || fileid == undefined) return; 

    if(desc === null || desc === undefined) desc = '';
    if(name === null || name === undefined) name = 'no name'; 
    if(from_share === null || from_share === undefined) name = ''; 
   
    this.setCurrentFileId(fileid);
    this.current_file_name = name;
    this.current_file_desc = desc;
    this.current_file_from_share = from_share;

  }

  //performs this action locally and writes the changes to the database
  renameFile(fileid: number, newname: string){
  
    if(fileid === null || fileid == undefined) return; 
    if(newname === null || newname === undefined) newname = 'no name'; 

    if(fileid == this.getCurrentFileId()) this.current_file_name = newname;

    if(!this.connected) return;

    const auth = getAuth();
    const user = auth.currentUser;
    
    if(user){
      update(fbref(this.db, 'users/'+user.uid+'/files/'+fileid),{
        name: newname});
    }
  }

  updateDescription(fileid: number, desc: string){
  
    if(fileid === null || fileid == undefined) return; 
    if(desc === null || desc === undefined) desc = ''; 
    

    if(!this.connected) return;

    const auth = getAuth();
    const user = auth.currentUser;
    if(user){
      update(fbref(this.db, 'users/'+user.uid+'/files/'+fileid),{
        desc: desc});
    }
  }


  generateFileId() : number{
    return generateId(8);
  }

  /**
   * if a user only has an ada file on their user id, this converts it to a file that is stored in teh filesystem
   * @param ada 
   * @returns the id of the file
   */
  convertAdaToFile(uid: string, ada: any) : Promise<number>{
    
   const fileid = this.generateFileId();
   this.writeFileData(fileid, ada);
   this.writeFileMetaData(uid, fileid, 'recovered draft', '', '')
   return Promise.resolve(fileid);
    
  }

/**
 * takes the current state, gives it a new file ID and pushes it to the database
 * @returns the id of the file
 */
duplicate(uid: string, name: string, desc: string, ada: any, from_share: string) : Promise<number>{

  const fileid = this.generateFileId();
  this.writeFileData(fileid, ada);
  this.writeFileMetaData(uid, fileid, name, desc, from_share)
  return Promise.resolve(fileid);
    
  }
   

/**
 * creates a new reference for a shared file 
 * @param file_id 
 * @param share_data 
 * @returns 
 */
createSharedFile(file_id: string, share_data: ShareObj) : Promise<string> {
  if(!this.connected) return;

  const ref = fbref(this.db, 'shared/'+file_id);

  return set(ref,share_data)
  .then(success => {
    return Promise.resolve(file_id)

  })
  .catch(err => {
    console.error(err);
    return Promise.reject("could not create new shared item")

  })


}

/**
 * checks if and how a particular file id is being shared
 * @param file_id 
 */
isShared(file_id:string) : Promise<ShareObj> {
  // if(!this.connected) return Promise.reject("no internet connection");


  const ref = fbref(this.db,'shared/' + file_id);
  return fbget(ref)
  .then((filedata) => {
      if(filedata.exists()){

        const share_obj:ShareObj = {
          desc: filedata.val().desc,
          license: filedata.val().license,
          filename: filedata.val().filename,
          img: filedata.val().img,
          owner_creditline: filedata.val().owner_creditline,
          owner_uid: filedata.val().owner_uid, 
          owner_url: filedata.val().owner_url,
          public: filedata.val().public
        }

        return Promise.resolve(share_obj);
        
      }else{
       return Promise.reject('No shared file with id: '+file_id)
      }

    })
}



/**
 * called when a user changes the license for a shared file. 
 * @param fileid 
 * @param license 
 * @returns 
 */
updateSharedFile(fileid: string, share: ShareObj) : Promise<any>{
  if(!this.connected) return Promise.reject("not logged in");

  const ref = fbref(this.db, 'shared/'+fileid);

    update(ref,share)
    .then(success => {
      return Promise.resolve(true);
    })
    .catch(err => {
      console.error(err);
      return Promise.resolve(false);
    })

}


/**
 * called when a user changes the license for a shared file. 
 * @param fileid 
 * @param license 
 * @returns 
 */
updateSharedLicense(fileid: string, license: string) : Promise<any>{
  if(!this.connected) return Promise.reject("not logged in");

  const ref = fbref(this.db, 'shared/'+fileid);

    update(ref,{license: license})
    .then(success => {
      return Promise.resolve(true);
    })
    .catch(err => {
      console.error(err);
      return Promise.resolve(false);
    })

}

/**
   * The shared entry is not the same as the file. This operation removes the entry to this file in the shared this.db but the file that was shared still exists in the files this.db. This will automatically rename that file to reflect that it used to be shared. 
   * @returns the file data
   */
removeSharedFile(file_id: string) : Promise<any> {
  if(!this.connected) return Promise.reject("get shared file is not logged in");


  let int_id: number = +file_id;
  const auth = getAuth();
  const user = auth.currentUser;
  remove(fbref(this.db, `shared/${file_id}`));


  this.getFileMeta(int_id).then(meta => {
    if(user){
      update(fbref(this.db, 'users/'+user.uid+'/files/'+file_id),{name: meta.name + "(previously shared)"});
    }
  })



}


  /**
   * gets the file at a given id
   * @returns the file data
   */
  getFile(fileid: number) : Promise<any> {
    if(!this.connected) return Promise.reject("get file is not logged in");

    return fbget(fbref(this.db, `filedata/${fileid}`))
    .then((filedata) => {


        if(filedata.exists()){

          return Promise.resolve(filedata.val().ada);

        }else{
         return Promise.reject("User found but file id not found")
        }

      }).catch(e => {console.error(e)});

  }


  /**
   * calls when a file is selected to be deleted from the files list
   * deletes all references to the file and then deletes from the users file list
   * @param fileid 
   * @returns 
   */
  removeFile(fileid: number) {
        
    if(!this.connected) return;

    const auth = getAuth();
    const user = auth.currentUser;

    if(user == null) return;
    remove(fbref(this.db, `filedata/${fileid}`));
    remove(fbref(this.db, 'users/'+user.uid+'/files/'+fileid));


  }

  /**
   * gets the file meta for a given id. 
   * @param fileid 
   * @returns the meta data
   */
  getFileMeta(fileid: number) : Promise<any> {
    const auth = getAuth();
    const user = auth.currentUser;

    if(user == null) return Promise.reject("user not logged in");
    
    return fbget(fbref(this.db, 'users/'+user.uid+'/files/'+fileid)).then((meta) => {

        if(meta.exists()){          
          let obj = {
            desc: meta.val().desc,
            last_opened: meta.val().last_opened, 
            name: meta.val().name,
            timestamp: meta.val().timestamp, 
            from_share: (meta.val().from_share == undefined ) ? '' : meta.val().from_share
          }


          return Promise.resolve(obj);
        }else{
          return Promise.reject("No meta data found for file id "+fileid)
        }

      });
    }



    /**
     * usually called after new data is written, this updates the time at which the file was updated and makes sure the current file id is the one that is saved as the last file opened. 
     * @param fileid 
     * @returns 
     */
  updateSaveTime(fileid: number){
    if(!this.connected) return;
    const auth = getAuth();
    const user = auth.currentUser;

    if(user == null) return;

    const stamp = Date.now();
    update(fbref(this.db, `users/${user.uid}`),{last_opened: fileid});
    update(fbref(this.db, 'users/'+user.uid+'/files/'+fileid),{
      timestamp: stamp,
    });


    
  }



  /**
   * writes the data for the currently open file to the database
   * @param cur_state 
   * @returns 
   */
  writeFileData(fileid: number, cur_state: SaveObj) {

    console.log("WRITING FILE DATA FOR ", fileid)

    if(!this.connected) return;

    const ref = fbref(this.db, 'filedata/'+fileid);

    update(ref,{ada: cur_state})
    .then(success => {
      this.updateSaveTime(fileid)
    })
    .catch(err => {
      console.error(err);
    })
  }


 writeFileMetaData(uid: string, fileid: number, name: string, desc: string, from_share: string) {

      if(!this.connected) return;

      if(from_share == undefined || from_share == null) from_share = '';

      const stamp = Date.now();
      update(fbref(this.db, 'users/'+uid+'/files/'+fileid),{
        name: name,
        desc: desc,
        timestamp: stamp, 
        from_share: from_share
      });
      update(fbref(this.db, 'users/'+uid),{last_opened: fileid});

    }
    
    





  
}



