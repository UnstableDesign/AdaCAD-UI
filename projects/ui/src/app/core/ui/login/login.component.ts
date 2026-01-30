import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component, OnInit, inject } from '@angular/core';
import { FormGroupDirective, FormsModule, NgForm, ReactiveFormsModule, UntypedFormControl, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { Router } from '@angular/router';
import { FirebaseService } from '../../provider/firebase.service';

/** Error when invalid control is dirty, touched, or submitted. */
export class MyErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: UntypedFormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || control.touched || isSubmitted));
  }
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [MatDialogTitle, CdkScrollable, MatDialogContent, MatButton, MatDialogClose, MatFormField, MatLabel, MatInput, FormsModule, ReactiveFormsModule, MatError, MatDialogActions]
})
export class LoginComponent implements OnInit {
  private router = inject(Router);
  private fb = inject(FirebaseService);
  private dialogRef = inject<MatDialogRef<LoginComponent>>(MatDialogRef);
  private data = inject(MAT_DIALOG_DATA);

  emailFormControl = new UntypedFormControl('', [Validators.required, Validators.email]);
  passwordFormControl = new UntypedFormControl('', [Validators.required]);
  matcher = new MyErrorStateMatcher();

  useemail: boolean = false;
  error: string = "";

  ngOnInit() {
  }


  loginGoogle() {


    this.fb.login().then(logged_in => {
      this.dialogRef.close('Log In Via Google Success!');
      //consider opening the file browser here. 
    }, not_logged_in => {
      console.log(Error)
    });

  }



}
