import { Injectable, ViewRef } from '@angular/core';
import { generateId } from 'adacad-drafting-lib';
import { NoteComponent } from '../../mixer/palette/note/note.component';
import { Bounds, Note, Point } from '../model/datatypes';




@Injectable({
  providedIn: 'root'
})
export class NotesService {


  //id in array should always match note id. 
  notes: Array<Note>;


  constructor() {
    this.notes = [];
  }

  clear() {
    this.notes = [];
  }

  createNote(tl: Point, component: NoteComponent, ref: ViewRef, note: any): number {

    let gennote: Note = null;
    if (note == null) {
      gennote = {
        id: generateId(8),
        topleft: {
          x: tl.x,
          y: tl.y
        },
        title: "",
        text: "",
        ref: ref,
        color: "#FFFF00",
        component: component,
        imageurl: null,
        width: 200,
        height: 200
      }
    } else {

      if (note.interlacement !== undefined) {
        tl.x = note.interlacement.j;
        tl.y = note.interlacement.i;
      }

      gennote = {
        id: generateId(8),
        topleft: {
          x: tl.x,
          y: tl.y
        },
        title: (note.title !== undefined) ? note.title : "",
        text: note.text,
        ref: ref,
        color: (note.color !== undefined) ? note.color : "#FFFF00",
        component: component,
        imageurl: (note.imageurl !== undefined) ? note.imageurl : null,
        width: (note.width !== undefined) ? note.width : 200,
        height: (note.height !== undefined) ? note.height : 200,
      }
    }

    this.notes.push(gennote);
    return gennote.id;

  }

  copyNote(note: Note): Note {
    const newnote: Note = {
      id: note.id,
      topleft: note.topleft,
      title: note.title,
      text: note.text,
      color: note.color,
      ref: note.ref,
      component: note.component,
      imageurl: note.imageurl,
      width: note.width,
      height: note.height
    }
    return newnote;

  }

  createBlankNote(): Note {
    const note: Note = {
      id: generateId(8),
      topleft: {
        x: 0,
        y: 0
      },
      title: "",
      text: "",
      color: "#FFFF00",
      ref: null,
      component: null,
      imageurl: null,
      width: 200,
      height: 200
    }

    this.notes.push(note);
    return note;

  }

  getComponents(): Array<NoteComponent> {
    return this.notes.map(el => el.component);
  }

  getRefs(): Array<ViewRef> {
    return this.notes.map(el => el.ref);
  }

  exportForSaving(): Array<any> {
    return this.notes.map(note => {
      return {
        id: note.id,
        title: note.title,
        text: note.text,
        color: note.color,
        topleft: note.topleft,
        imageurl: note.imageurl,
        width: note.width,
        height: note.height
      }
    });
  }

  /**
   * this function returns the smallest bounding box that can contain all of the notes. This function does not consider the scrolling (all measures are relative to the current view window). getClientRect factors in scale, so the x, y and width/height will have the current scaling factored in. To adjust for this, this function needs to take in the current zoom
   * @returns The Bounds or null (if there are no nodes with which to measure)
   */
  getNoteBoundingBox(id_list: Array<number>): Bounds | null {

    if (this.notes.length == 0 || id_list.length == 0) return null;

    const raw_rects = id_list
      .map(id => document.getElementById('note-' + id))
      .filter(div => div !== null)
      .map(div => { return { x: div.offsetLeft, y: div.offsetTop, width: div.offsetWidth, height: div.offsetHeight } });


    const min: Point = raw_rects.reduce((acc, el) => {
      let adj_x = el.x;
      let adj_y = el.y;
      if (adj_x < acc.x) acc.x = adj_x;
      if (adj_y < acc.y) acc.y = adj_y;
      return acc;
    }, { x: 1000000, y: 100000 });

    const max: Point = raw_rects.reduce((acc, el) => {
      let adj_right = el.x + el.width;
      let adj_bottom = el.y + el.height;
      if (adj_right > acc.x) acc.x = adj_right;
      if (adj_bottom > acc.y) acc.y = adj_bottom;
      return acc;
    }, { x: 0, y: 0 });


    let bounds: Bounds = {
      topleft: { x: min.x, y: min.y },
      width: max.x - min.x,
      height: max.y - min.y
    }

    //console.log('BOUNDS FOR NOTES', min, max, bounds)
    return bounds;


  }

  // /** called on load new file as well as undo, redo  */
  // reloadNotes(ns: Array<any>) : Array<Note>{

  //   console.log("LOADING NOTES", ns);
  //   ns.forEach(newnote => {
  //     const found = this.notes.find(el => el.id === newnote.id);
  //     if(found !== undefined){
  //       found.text = newnote.text;
  //       found.interlacement= newnote.interlacement;
  //       found.ref= (newnote.ref === undefined) ? null : newnote.ref;
  //       found.component= (newnote.component === undefined) ? null : newnote.component
  //     }else{
  //       this.notes.push({
  //         id: newnote.id,
  //         text: newnote.text,
  //         interlacement: newnote.interlacement,
  //         ref: (newnote.ref === undefined) ? null : newnote.ref,
  //         component: (newnote.component === undefined) ? null : newnote.component
  //       })
  //     }
  //   });

  //   this.notes = this.notes.filter(el => ns.find(nsel => nsel.id === el.id) !== undefined);

  //   return ns;
  // }

  /**
   * gets the note associated with a given id. 
   * @param id 
   * @returns the note object or undefined if not found
   */
  get(id: number): Note {
    return this.notes.find(el => el.id == id);
  }

  delete(id: number) {
    this.notes = this.notes.filter(el => el.id != id);
  }

  setColor(id: number, color: string) {
    let note = this.get(id);
    note.color = color;
  }

  setPosition(id: number, topleft: Point) {
    let note = this.get(id);
    note.topleft.x = topleft.x;
    note.topleft.y = topleft.y

  }

  getNoteIdList() {
    return this.notes.map(note => note.id);
  }


}
