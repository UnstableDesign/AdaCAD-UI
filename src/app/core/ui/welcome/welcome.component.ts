import { Component, inject } from '@angular/core';
import { MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'app-welcome',
    templateUrl: './welcome.component.html',
    styleUrl: './welcome.component.scss',
    imports: [MatDialogTitle, CdkScrollable, MatDialogContent, MatButton, MatDialogActions, MatDialogClose]
})
export class WelcomeComponent {
  dialogRef = inject<MatDialogRef<WelcomeComponent>>(MatDialogRef);


  loadOlderBeta(){
//    window.location.href = "https://adacad-beta-fa4dc.web.app/";
    window.location.href = "https://version3.adacad.org";
  }


  loadDocs(){
    window.open('https://docs.adacad.org/docs/learn/tutorials/', '_blank');

  }
}
