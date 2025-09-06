import { DragDropModule } from '@angular/cdk/drag-drop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTreeModule } from '@angular/material/tree';
import { BrowserModule } from '@angular/platform-browser';
import { LoginComponent } from './ui/login/login.component';
import { InitModal } from './ui/init/init.modal';
import { MaterialModal } from './ui/material/material.modal';
import { AuthService } from './provider/auth.service';
import { FileService } from './provider/file.service';
import { PatternfinderService } from './provider/patternfinder.service';
import { VaeService } from './provider/vae.service';
import { SignupComponent } from './ui/signup/signup.component';
import { UploadFormComponent } from './ui/uploads/upload-form/upload-form.component';
import { UploadService } from './provider/upload.service';
import { BlankdraftModal } from './ui/blankdraft/blankdraft.modal';
import { ExamplesComponent } from './ui/examples/examples.component';
import { LoadfileComponent } from './ui/loadfile/loadfile.component';
import { FilebrowserComponent } from './ui/filebrowser/filebrowser.component';
import { EventsDirective } from './events.directive';
import { WelcomeComponent } from './ui/welcome/welcome.component';
import { RenderService } from './provider/render.service';
import { DraftRenderingComponent } from './ui/draft-rendering/draft-rendering.component';
import { SelectionComponent } from './ui/draft-rendering/selection/selection.component';
import { ViewerService } from './provider/viewer.service';
import { ViewadjustService } from './provider/viewadjust.service';
import { ViewadjustComponent } from './viewadjust/viewadjust.component';
import { ImageeditorComponent } from './ui/imageeditor/imageeditor.component';
import { MediaService } from './provider/media.service';
import { OperationService } from './provider/operation.service';



@NgModule({
    exports: [], 
    imports: [],
    providers: [
        UploadService,
        FileService,
        VaeService,
        PatternfinderService,
        AuthService,
        RenderService,
        ViewerService,
        ViewadjustService,
        MediaService,
        OperationService
    ] })
export class CoreModule { }