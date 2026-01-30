import { AsyncPipe } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { OperationClassification } from 'adacad-drafting-lib';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { OperationService } from '../../core/provider/operation.service';
import { WorkspaceService } from '../../core/provider/workspace.service';

@Component({
  selector: 'app-operation-search',
  templateUrl: './operation-search.component.html',
  styleUrls: ['./operation-search.component.scss'],
  imports: [MatButton, MatTooltip, MatSlideToggleModule, MatFormField, MatLabel, MatInput, FormsModule, ReactiveFormsModule, AsyncPipe],
  standalone: true
})
export class OperationSearchComponent implements OnInit {
  @Output() addOperation = new EventEmitter<string>();

  ws = inject(WorkspaceService);
  ops = inject(OperationService);

  /** variables for operation search */
  classifications: Array<OperationClassification> = [];
  op_tree: any = [];
  filteredOptions: Observable<any>;
  searchForm: FormControl;
  search_error: any;

  constructor() {
    this.searchForm = new FormControl();
    this.classifications = this.ops.getOpClassifications();
    this.op_tree = this.makeOperationsList();
  }

  ngOnInit() {
    this.filteredOptions = this.searchForm.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value))
    );
  }

  operationLevelToggleChange(event: any) {
    this.ws.show_advanced_operations = event.checked;
    this.refreshOperations();
  }

  refreshOperations() {
    this.op_tree = this.makeOperationsList();
    this.filteredOptions = this.searchForm.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value))
    );
  }

  makeOperationsList() {
    function alphabetical(a, b) {
      if (a.display_name < b.display_name) {
        return -1;
      }
      if (a.display_name > b.display_name) {
        return 1;
      }
      return 0;
    }

    const op_list = this.classifications.map(classification => {
      return {
        class_name: classification.category_name,
        color: classification.color,
        description: classification.description,
        ops: classification.op_names
          .map(op => { return { name: op, display_name: this.ops.getDisplayName(op), advanced: this.ops.idAdvanced(op) } })
          .filter(op => {
            if (this.ws.show_advanced_operations) {
              return true;
            } else {
              return op.advanced === false;
            }
          })
      }
    });

    op_list.forEach(el => {
      el.ops.sort(alphabetical);
    })

    return op_list;
  }

  /**
   * adds the first of the filtered list of operations to the workspace
   */
  public enter() {
    const value = this.searchForm.value.toLowerCase();

    //run the filter function again without the classification titles
    let tree = this.op_tree.reduce((acc, classification) => {
      return acc.concat(classification.ops
        .filter(option => option.display_name.toLowerCase().includes(value)));
    }, []);

    if (tree.length > 0) {
      this.addOperation.emit(tree[0].name);
    }

    this.searchForm.setValue('');
  }

  private _filter(value: string): any[] {
    const filterValue = value.toLowerCase();

    let tree = this.op_tree.map(classification => {
      return {
        class_name: classification.class_name,
        description: classification.description,
        color: classification.color,
        ops: classification.ops
          .filter(option => option.display_name.toLowerCase().includes(filterValue))
      }
    });

    tree = tree.filter(classification => classification.ops.length > 0);

    if (tree.length == 0) {
      this.search_error = "no operations match this search"
    } else {
      this.search_error = '';
    }

    return tree;
  }

  onAddOperation(opName: string) {
    this.addOperation.emit(opName);
    this.searchForm.setValue('');
  }
}

