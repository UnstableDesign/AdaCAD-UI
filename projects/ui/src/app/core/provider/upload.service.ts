import { HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { deleteObject, getDownloadURL, getMetadata, getStorage, ref, uploadBytes, uploadBytesResumable, UploadMetadata } from "@angular/fire/storage";
import { Observable } from 'rxjs';
import { Upload } from '../model/datatypes';
import { FirebaseService } from './firebase.service';

const httpOptions = {
  headers: new HttpHeaders({
  })
};



@Injectable()
export class UploadService {
  private fb = inject(FirebaseService)

  uploadProgress: Observable<number>;
  progress: number;
  imageToShow: any;
  uploads: Array<Upload> = []; //hold a list of all the uploads so we can delete at end. 



  ngOnDestroy() {
    this.uploads.forEach(upload => {
      this.deleteUpload(upload.name);
    });
  }



  createImageFromBlob(image: Blob) {
    let reader = new FileReader();
    reader.addEventListener("load", () => {
      this.imageToShow = reader.result;
    }, false);

    if (image) {
      reader.readAsDataURL(image);
    }
  }


  getHash(upload: Upload): Promise<string> {
    let file = upload.file;

    return new Promise((resolve, reject) => {
      let reader = new FileReader();

      reader.onload = function (event) {
        let data = event.target.result;
        console.log("GET HASH ", data)
        let ret: any = data;
        if (data) {
          let uintArBuff = new Uint8Array(ret);   //Does an array buffer convert to a Uint8Array?
          crypto.subtle.digest('SHA-1', uintArBuff).then(data => {
            var base64 = btoa(
              new Uint8Array(data)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            resolve(base64);
          }
          );
        } else {
          reject('null')
        }
      }
      reader.readAsArrayBuffer(file);

    });
  }



  uploadData(id: string, upload: Upload, metadata: UploadMetadata) {
    console.log("IN UPLOAD DATA")
    this.uploads.push(upload);

    const storage = getStorage();
    const storageRef = ref(storage, 'uploads/' + id);
    const uploadTask = uploadBytesResumable(storageRef, upload.file, metadata);

    uploadTask
      .on('state_changed', (snapshot) => {
        // Observe state change events such as progress, pause, and resume
        // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
        this.progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log('Upload is ' + this.progress + '% done');
        switch (snapshot.state) {
          case 'paused':
            console.log('Upload is paused');
            break;
          case 'running':
            console.log('Upload is running');
            break;
        }
      },
        (error) => {
          console.error(error);
        },
        () => {

        });

    return uploadBytes(storageRef, upload.file, metadata).then((snapshot) => {
      return snapshot;
    }).catch(console.error); //error on get hash
  }




  /**
   * runs checks and, if cleared, pushes the upload to the firebase storage server
   * @param upload the upload data
   * @returns Promise of the result of firebase's upload task, snapshot of the file
   */
  pushUpload(upload: Upload): Promise<any> {

    //const id = Math.random().toString(36).substring(2);
    let id = '';
    let metadata: UploadMetadata = null;
    let uid = (this.fb.auth.currentUser) ? this.fb.auth.currentUser.uid : -1;
    return this.getHash(upload)
      .then(hash => {
        id = hash;
        metadata = {
          customMetadata: { user: uid.toString(), filename: upload.name }
        };
        upload.name = id;

        return this.alreadyLoaded(id);
      })
      .then(already_loaded => {
        if (!already_loaded) {
          return this.uploadData(id, upload, metadata);
        }
      }).catch(console.error);

  }

  // Get metadata properties
  getDownloadMetaData(id: string): Promise<any> {

    const storage = getStorage();
    return getMetadata(ref(storage, 'uploads/' + id))
      .then((metadata) => {
        return Promise.resolve(metadata)
        // Metadata now contains the metadata for 'images/forest.jpg'
      })
      .catch((error) => {
        // Uh-oh, an error occurred!
      });
  }

  getDownloadURL(id: string): Promise<any> {
    const storage = getStorage();
    if (id === 'noinput') return Promise.resolve('');
    return getDownloadURL(ref(storage, 'uploads/' + id));
  }



  /**
   * retreives an item from firebase storage
   * @param id the reference for the item
   * @returns 
   */
  getDownloadData(id: string): Promise<any> {
    const storage = getStorage();
    if (id === 'noinput') return Promise.resolve('');

    // console.log("GET DATA AT ", id)
    this.getDownloadMetaData(id);

    return getDownloadURL(ref(storage, 'uploads/' + id))
      .then((url) => {
        const xhr = new XMLHttpRequest();
        xhr.responseType = 'blob';
        xhr.onload = (event) => {
          const blob = xhr.response;

        };
        xhr.open('GET', url);
        xhr.send();
        return Promise.resolve(url);
      })
      .catch((error) => {
        // A full list of error codes is available at
        // https://firebase.google.com/docs/storage/web/handle-errors
        switch (error.code) {
          case 'storage/object-not-found':
            console.error("file does not exist")
            Promise.resolve(null);
            break;
          case 'storage/unauthorized':
            console.error("not authorized")
            // User doesn't have permission to access the object
            break;
          case 'storage/canceled':
            // User canceled the upload
            console.error("canceled")

            break;

          // ...

          case 'storage/unknown':
            // Unknown error occurred, inspect the server response
            console.error('unknown')
            break;

          default:
            console.error("unhandled error", error.code);
        }
      });
  }

  alreadyLoaded(id): Promise<boolean> {
    const storage = getStorage();
    if (id === 'noinput') return Promise.resolve(false);

    return getDownloadURL(ref(storage, 'uploads/' + id))
      .then((url) => {
        return Promise.resolve(true);
      })
      .catch((error) => {
        switch (error.code) {
          case 'storage/object-not-found':
            console.error("file does not exist")
            return Promise.resolve(false);
            break;
          case 'storage/unauthorized':
            console.error("not authorized")
            // User doesn't have permission to access the object
            return Promise.resolve(false);
            break;
          case 'storage/canceled':
            // User canceled the upload
            console.error("canceled")
            return Promise.resolve(false);
            break;


          case 'storage/unknown':
            // Unknown error occurred, inspect the server response
            console.error('unknown')
            return Promise.resolve(false);

            break;

          default:
            console.error("unhandled error", error.code);
            return Promise.resolve(false);

        }
      });
  }


  deleteUpload(name: string) {

    const storage = getStorage();

    // Create a reference to the file to delete
    const desertRef = ref(storage, 'uploads/' + name);

    // Delete the file
    deleteObject(desertRef).then(() => {
      console.log("file deleted");
    }).catch((error) => {
      // Uh-oh, an error occurred!
    });


  }



}
