import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { ErrorStatement, ErrorType } from '../model/datatypes';

@Injectable({
  providedIn: 'root'
})





/**
 * creates a centralized location for functions to submit errors that may have taken place such that they can be handled or shape rendering. 
 */
export class ErrorBroadcasterService {

  errorBroadcasterSubject: Subject<string>;
  errorBroadcast$;

  originatingNodes: Array<ErrorStatement> = []; // a collection of any tree nodes that are affected by an error. 


  constructor() {
    this.errorBroadcasterSubject = new Subject<string>();
    this.errorBroadcast$ = this.errorBroadcasterSubject.asObservable();
  }

  ngOnInit() {

  }

  postError(node_id: number, type: ErrorType, label: string, affected_nodes?: Array<number>) {
    if (!this.hasError(node_id)) {
      const errorNode: ErrorStatement = { id: node_id, type, label, affected_nodes: affected_nodes ? affected_nodes : undefined };
      this.originatingNodes.push(errorNode);

    }
    this.errorBroadcasterSubject.next('ERROR: ' + label)
  }

  clearError(node_id: number) {
    this.originatingNodes = this.originatingNodes.filter(el => el.id !== node_id)

  }

  hasError(node_id: number): boolean {
    let node = this.originatingNodes.find(el => el.id == node_id);
    if (node !== undefined) return true;
    return false;
  }

  isErrorAffected(node_id: number): boolean {

    const all_affected: Array<number> = this.originatingNodes.reduce((acc, el) => {
      if (el.affected_nodes !== undefined) {
        el.affected_nodes.forEach(node => acc.push(node));
      }
      return acc;
    }, []);

    let node = all_affected.find(el => el == node_id);
    if (node !== undefined) return true;
    return false;
  }

  getErrorLabel(node_id): string {
    let node = this.originatingNodes.find(el => el.id == node_id);
    if (node !== undefined) return node.label;
    return "";
  }

  getErrorType(node_id): ErrorType {
    let node = this.originatingNodes.find(el => el.id == node_id);
    if (node !== undefined) return node.type;
    return 'OTHER';
  }





}
