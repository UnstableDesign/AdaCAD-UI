import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AnalyzedImage, Color, filterToUniqueValues, generateId, SingleImage } from 'adacad-drafting-lib';
import { IndexedColorMediaProxy, MediaInstance } from '../model/datatypes';
import { UploadService } from './upload.service';


/**
 * this service keeps track of the media stored in storage that are associated with this file, along_with any additional meta-data about that media that is required for the 
 */

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private upSvc = inject(UploadService);
  private httpClient = inject(HttpClient);


  current: Array<MediaInstance> = [];



  isAlreadyLoaded(id: number): boolean {
    console.log("IS ALREADY LOADED ", this.current.find(el => el.id == id) !== undefined);
    return this.current.find(el => el.id == id) !== undefined;
  }

  /**
   * called when a new file is loaded, 
   * compiles all the media refs that need to be loaded into memory. Data contains any additional meta-data to factor in while loading
   * @param to_load a list of ids and associated data 
   * @returns 
   */
  loadMediaFromUpload(to_load: Array<MediaInstance>): Promise<any> {



    const fns = to_load
      .filter(el => el.ref !== '')
      .filter(el => !this.isAlreadyLoaded(el.id))
      .map(el => {
        if (el.type == 'indexed_color_image') return this.loadIndexedColorFile(el.id, el.ref, null)
        else return this.loadImage(el.id, el.ref)
      });
    return Promise.all(fns);
  }



  /**
   * this is called when a file with indexed color data is loaded into the system 
   * @param to_load the indexed color image object as it is saved. 
   * @returns 
   */
  loadMediaFromFileLoad(to_load: Array<{ id: number, ref: string, data: any }>): Promise<any> {
    console.log("LOAD MEDIA FROM FILE LOAD", to_load, this.current.slice());
    const fns = to_load
      .filter(el => el.ref !== '')
      .filter(el => !this.isAlreadyLoaded(el.id))
      .map(el => {
        return this.loadIndexedColorFile(el.id, el.ref, el.data)
      });
    return Promise.all(fns);
  }


  /** 
   * gets the media object from firebase storage
  */
  async processMedia(url): Promise<any> {
    return await this.httpClient.get(url, { responseType: 'blob' }).toPromise();
  }

  /**
   * loads an indexed color file
   * @param id the unique reference for this file
   * @param data an object containing any color or color_mapping data that has already been stored for this item
   * @returns 
   */
  loadIndexedColorFile(id: number, ref: string, saved_data: { colors: Array<any>, color_mapping: Array<any> }): Promise<MediaInstance> {

    if (id == -1) {
      id = generateId(8);
    }

    let color_mapping = [];
    if (saved_data !== null) color_mapping = saved_data.color_mapping;

    let colors = [];
    if (saved_data !== null) colors = saved_data.colors;

    let url = "";

    //retrieve the media object from the server
    return this.upSvc.getDownloadData(ref).then(obj => {
      if (obj === undefined) return null;
      url = obj;
      return this.processMedia(obj);

    }).then(blob => {

      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      var image = new Image();
      image.src = url;
      image.crossOrigin = "Anonymous";

      return image.decode().then(() => {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        if (image.naturalWidth > 10000) Promise.reject('width error');
        if (image.naturalHeight > 10000) Promise.reject('height error');

        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        var imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const pixels = imgdata.data;

        //console.log("Create Pixel Array")
        //process the pixels into meaningful values;
        const all_colors: Array<any> = [];
        for (let i = 0; i < pixels.length; i += 4) {

          let r: string = pixels[i].toString(16);
          let r_val: number = pixels[i];

          if (r.length == 1) r = '0' + r;

          let g: string = pixels[i + 1].toString(16);
          let g_val: number = pixels[i + 1];
          if (g.length == 1) g = '0' + g;

          let b: string = pixels[i + 2].toString(16);
          let b_val: number = pixels[i + 2];

          if (b.length == 1) b = '0' + b;

          const is_black: boolean = ((r_val + g_val + b_val / 3) < (255 / 2))
          const o = pixels[i + 3].toString(16);


          all_colors.push({ r: r_val, g: g_val, b: b_val, hex: '#' + r + '' + g + '' + b, black: is_black });
        }

        let filewarning = "";
        let seen_vals = [];
        let unique_count = 0;


        for (let i = 0; i < all_colors.length && unique_count < 100; i++) {
          if (seen_vals.find(el => el.hex == all_colors[i].hex) == undefined) {
            unique_count++;
            seen_vals.push(all_colors[i]);
          }
        }



        if (unique_count >= 100) {
          filewarning = "this image contains more than 100 colors and will take too much time to process, consider indexing to a smaller color space"
          return Promise.reject(filewarning);
        }

        /**this is expensive, so just do a fast run to make sure the size is okay before we go into this */

        if (colors.length == 0) {
          colors = filterToUniqueValues(seen_vals);
        }


        let image_map: Array<Array<number>> = [];
        if (colors.length > 100) {
          filewarning = "this image contains " + colors.length + " color and will take too much time to process, consider indexing to a smaller color space"
          return Promise.reject(filewarning);
        }
        else {
          const image_map_flat: Array<number> = all_colors.map(item => colors.findIndex(el => el.hex === item.hex));

          let cur_i = 0;
          let cur_j = 0;
          image_map_flat.forEach((id, ndx) => {
            cur_i = Math.floor(ndx / imgdata.width);
            cur_j = ndx % imgdata.width;

            if (cur_i >= image_map.length) image_map.push([]);
            image_map[cur_i][cur_j] = id;
          });
        }

        const prox = this.createProximityMap(colors);
        if (color_mapping.length == 0) {
          color_mapping = this.createColorMap(colors, prox, -1);
        }


        var obj: AnalyzedImage = {
          name: 'placeholder',
          data: imgdata,
          colors: colors,
          colors_mapping: color_mapping,
          proximity_map: prox,
          image: image,
          image_map: image_map,
          width: imgdata.width,
          height: imgdata.height,
          type: 'image',
          warning: filewarning
        }

        return this.addMediaNameFromStorage(ref, obj);

      }).then(imageobj => {

        if (imageobj.data == null) {
          return Promise.reject("no image object found when loading indexed color file");
        }
        const media_ref = this.addIndexColorMediaInstance(id, ref, imageobj)
        return Promise.resolve(media_ref);
      });
    });
  }

  loadImageViaURL(id: number, ref: string): Promise<any> {
    return this.upSvc.getDownloadURL(ref)
  }

  /**
   * loads an image  file
   * @param id the unique reference for this file
   * @param data an object containing any color or color_mapping data that has already been stored for this item
   * @returns 
   */
  loadImage(id: number, ref: string): Promise<MediaInstance> {

    if (id == -1) {
      id = generateId(8);
    }

    let url = "";

    //retrieve the media object from the server
    return this.upSvc.getDownloadData(ref).then(obj => {
      if (obj === undefined) return null;
      url = obj;
      return this.processMedia(obj);

    }).then(blob => {

      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      var image = new Image();
      image.src = url;
      image.crossOrigin = "Anonymous";

      return image.decode().then(() => {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        var imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height);


        var obj: SingleImage = {
          name: 'placeholder',
          data: imgdata,
          image: image,
          width: imgdata.width,
          height: imgdata.height,
          type: 'image',
          warning: ''
        }


        return Promise.resolve(obj);
      }).then(imageobj => {

        if (imageobj == null) {
          return Promise.reject("no image object found when loading single image  file");
        }
        const media_ref = this.addSingleImageMediaInstance(id, ref, imageobj)
        return Promise.resolve(media_ref);
      });
    });
  }



  addMediaNameFromStorage(ref: string, img: AnalyzedImage): Promise<AnalyzedImage> {
    return this.upSvc.getDownloadMetaData(ref)
      .then(metadata => {
        if (metadata.customMetadata.filename !== undefined) img.name = metadata.customMetadata.filename;
        return Promise.resolve(img);
      })
  }


  createColorMap(colors: Array<Color>, prox: Array<{ a: number, b: number, dist: number }>, space: number): Array<{ from: number, to: number }> {

    let color_map = colors.map((color, ndx) => { return { from: ndx, to: ndx }; });
    let prox_copy = prox.slice();
    //we don't care what the size of the color space is, so just return a 1-1 list. 
    if (space == -1 || space > colors.length) {
      return color_map;
    }


    //use a greedy method until we get to our number
    // For each number in the color list, find the closest color and return it with the distance to that color
    // Find teh closest distance, and map the "from" and "to" based to. Update any to's of teh from value to the new value. 
    // If there are multiple closests, just keep consuming until we're done. 

    for (let i = 0; i < colors.length - space; i++) {

      //get the smallest d-in the set. 
      let min_dist = prox_copy.reduce((acc, val) => {
        if (val.dist < acc.dist) return val;
        return acc;
      }, { a: -1, b: -1, dist: 1000000000 });

      color_map.forEach(val => {
        if (val.from == min_dist.a) val.to = min_dist.b;
        else if (val.to == min_dist.a) val.to = min_dist.b;
      });


      prox_copy = prox_copy.filter(el => el.a != min_dist.a && el.b !== min_dist.a)


    }

    return color_map;


  }

  /**
     * computes the euclidean distance squared of two color values. 
     * @param a 
     * @param b 
     * @returns 
     */
  distanceFn(a: Color, b: Color): number {
    return Math.pow(a.r - b.r, 2) + Math.pow(a.g - b.g, 2) + Math.pow(a.b - b.b, 2)
  }

  createProximityMap(colors: Array<Color>): Array<{ a: number, b: number, dist: number }> {
    //console.log("create proximity map")
    let prox = [];
    for (let a = 0; a < colors.length; a++) {
      for (let b = a + 1; b < colors.length; b++) {
        prox.push({ a, b, dist: this.distanceFn(colors[a], colors[b]) })
      }
    }
    return prox;
  }

  /**
   * loads a media instance into the table
   * @param id - a unique id for this media instance
   * @param ref - the reference to media in Firebase storage
   * @param img - specific settings for this media instance
   */
  addIndexColorMediaInstance(id: number, ref: string, img: AnalyzedImage): MediaInstance {

    let obj: MediaInstance = { id, ref, type: 'indexed_color_image', img }
    this.current.push(obj);
    return obj;
  }


  /**
 * loads a media instance into the table
 * @param id - a unique id for this media instance
 * @param ref - the reference to media in Firebase storage
 * @param img - specific settings for this media instance
 */
  addSingleImageMediaInstance(id: number, ref: string, data: any): MediaInstance {
    //console.log("LOADING IN DATA ", data)
    let obj: MediaInstance = { id, ref, img: data, type: 'image' }
    this.current.push(obj);
    return obj;
  }

  copyIndexedImage(img: AnalyzedImage): AnalyzedImage {
    return {
      name: img.name,
      data: img.data,
      type: img.type,
      colors: img.colors.slice(),
      colors_mapping: img.colors_mapping.map(el => { return { from: el.from, to: el.to } }),
      proximity_map: img.proximity_map.slice(),
      image: img.image,
      image_map: img.image_map,
      width: img.width,
      height: img.height,
      warning: img.warning
    }
  }


  duplicateIndexedColorImageInstance(id: number): MediaInstance {
    let i = this.getMedia(id);
    if (i == null) return null;
    let image_copy: AnalyzedImage = this.copyIndexedImage(<AnalyzedImage>i.img);
    return this.addIndexColorMediaInstance(generateId(8), i.ref, image_copy);

  }



  updateIndexColorMediaInstance(id: number, img: AnalyzedImage) {
    let obj = this.getMedia(id);
    if (obj !== null) {
      obj.img = img;
    }
  }


  getMedia(id: number): MediaInstance {
    //console.log("HAS MEDIA ", id)
    let obj = this.current.find(el => el.id == id);
    if (obj === undefined) return null;
    return obj;
  }

  clearMedia() {
    this.current = [];
  }

  removeInstance(id: number) {
    this.current = this.current.filter(el => el.id !== id);
  }



  exportIndexedColorImageData(): Array<IndexedColorMediaProxy> {
    const export_data: Array<MediaInstance> = this.current
      .filter(el => el.type == "indexed_color_image");


    const formatted: Array<IndexedColorMediaProxy> = export_data.map(
      el => { return { id: el.id, ref: el.ref, colors: (<AnalyzedImage>el.img).colors, color_mapping: (<AnalyzedImage>el.img).colors_mapping } }
    );

    return formatted;

  }





}
