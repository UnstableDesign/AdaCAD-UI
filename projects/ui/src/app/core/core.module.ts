import { NgModule } from '@angular/core';
import { FileService } from './provider/file.service';
import { MediaService } from './provider/media.service';
import { OperationService } from './provider/operation.service';
import { PatternfinderService } from './provider/patternfinder.service';
import { RenderService } from './provider/render.service';
import { UploadService } from './provider/upload.service';
import { ViewadjustService } from './provider/viewadjust.service';
import { ViewerService } from './provider/viewer.service';



@NgModule({
	exports: [],
	imports: [],
	providers: [
		UploadService,
		FileService,
		PatternfinderService,
		RenderService,
		ViewerService,
		ViewadjustService,
		MediaService,
		OperationService
	]
})
export class CoreModule { }