import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss'
})
export class WelcomeComponent {
  constructor(public dialogRef: MatDialogRef<WelcomeComponent>) { 
    
  }

  loadOlderBeta(){
//    window.location.href = "https://adacad-beta-fa4dc.web.app/";
    window.location.href = "https://version3.adacad.org";
  }


  loadDocs(){
    window.open('https://docs.adacad.org/docs/learn/tutorials/', '_blank');

  }
}
