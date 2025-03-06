import { NgModule } from '@angular/core';
import { CoreModule } from '../core/core.module';
import { MixerComponent} from './mixer.component';
import { SubdraftComponent } from './palette/subdraft/subdraft.component';
import { PaletteComponent } from './palette/palette.component';
import { SnackbarComponent } from './palette/snackbar/snackbar.component';
import { OperationComponent } from './palette/operation/operation.component';
import { ConnectionComponent } from './palette/connection/connection.component';
import { ImageComponent } from './palette/image/image.component';
import { NoteComponent } from './palette/note/note.component';
import { ParameterComponent } from './palette/operation/parameter/parameter.component';
import { InletComponent } from './palette/operation/inlet/inlet.component';
import { DraftContainerComponent } from './palette/draftcontainer/draftcontainer.component';


@NgModule({
    imports: [
        CoreModule    
    ],
    declarations: [
        MixerComponent,
        SubdraftComponent,
        PaletteComponent,
        SnackbarComponent,
        OperationComponent,
        ConnectionComponent,
        ImageComponent,
        NoteComponent,
        ParameterComponent,
        InletComponent,
        DraftContainerComponent
        ],
    exports: [
        MixerComponent
    ]
})
export class MixerModule { }
