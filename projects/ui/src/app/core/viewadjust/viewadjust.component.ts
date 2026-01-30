import { CdkDrag, CdkDragMove } from '@angular/cdk/drag-drop';
import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { ViewadjustService } from '../provider/viewadjust.service';

@Component({
  selector: 'app-viewadjust',
  imports: [CdkDrag, MatButton],
  templateUrl: './viewadjust.component.html',
  styleUrl: './viewadjust.component.scss'
})
export class ViewadjustComponent {
  private vas = inject(ViewadjustService);


  pos: { x: number, y: number } = { x: 200, y: 0 };
  viewAdjustChangeSubscription: Subscription;
  constructor() {

    this.pos.x = this.vas.left;

    this.viewAdjustChangeSubscription = this.vas.viewAdjustChange.subscribe(x => {
      this.pos = { x: Math.floor(x), y: 0 }
    });

  }

  ngAfterViewInit() {

    let width = window.innerWidth;
    this.vas.updatePosition(4 * width / 5);
    this.pos.x = this.vas.left;


  }

  ngOnDestroy() {
    if (this.viewAdjustChangeSubscription) this.viewAdjustChangeSubscription.unsubscribe();
  }

  // /**
  //  * called when we need to automatically move the view in response to a window resize event
  //  */
  // updatePosition(){
  //   this.pos = {x: Math.floor(this.vas.left), y: 0}
  // }




  dragMove(e: CdkDragMove) {
    this.vas.updatePosition(e.pointerPosition.x);
  }

}
