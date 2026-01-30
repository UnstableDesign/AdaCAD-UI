import { AfterViewInit, Component, ElementRef, EventEmitter, inject, OnDestroy, OnInit, Output, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { FormBuilder, FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatError, MatInput } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { hexToRgb, Img, Material } from 'adacad-drafting-lib';
import { Draft } from 'adacad-drafting-lib/draft';
import { createMaterial, setMaterialID } from 'adacad-drafting-lib/material';
import { Subscription } from 'rxjs';
import { DraftNode, FileMetaStateChange, MaterialsStateChange, MediaInstance } from '../core/model/datatypes';
import { saveAsBmp } from '../core/model/helper';
import { FileService } from '../core/provider/file.service';
import { FirebaseService } from '../core/provider/firebase.service';
import { MaterialsService } from '../core/provider/materials.service';
import { MediaService } from '../core/provider/media.service';
import { OperationService } from '../core/provider/operation.service';
import { StateService } from '../core/provider/state.service';
import { TreeService } from '../core/provider/tree.service';
import { WorkspaceService } from '../core/provider/workspace.service';
import { DraftRenderingComponent } from '../core/ui/draft-rendering/draft-rendering.component';
import { LoadfileComponent } from '../core/ui/loadfile/loadfile.component';
import { MaterialComponent } from '../core/ui/material/material';
import { ShareComponent } from '../core/ui/share/share.component';
import { DraftinfocardComponent } from './draftinfocard/draftinfocard.component';

@Component({
  selector: 'app-library',
  templateUrl: './library.component.html',
  styleUrls: ['./library.component.scss'],
  imports: [MatButton, MatMenuModule, MatIconButton, MaterialComponent, ReactiveFormsModule, FormsModule, MatFormField, MatLabel, MatError, MatInput, MatTooltip, MatChipsModule, DraftinfocardComponent],
  standalone: true
})
export class LibraryComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('hiddenCanvas', { static: false }) hiddenCanvas: ElementRef<HTMLCanvasElement>;
  @ViewChild('csvFileInput', { static: false }) csvFileInput: ElementRef<HTMLInputElement>;
  @ViewChildren(DraftRenderingComponent) draftRenderings: QueryList<DraftRenderingComponent>;

  @Output() onWorkspaceRename = new EventEmitter<string>();
  @Output() onDraftNameChange = new EventEmitter<number>();
  @Output() onOpenInEditor = new EventEmitter<number>();
  @Output() onOpenInMixer = new EventEmitter<number>();

  private tree = inject(TreeService);
  private ms = inject(MaterialsService);
  private ws = inject(WorkspaceService);
  private fs = inject(FileService);
  private fb = inject(FirebaseService);
  private builder = inject(FormBuilder);

  private ss = inject(StateService);
  private ops = inject(OperationService);
  private mediaService = inject(MediaService);
  private dialog = inject(MatDialog);

  @ViewChild('materials', { static: false }) materials: MaterialComponent;
  @ViewChildren(DraftinfocardComponent) draftInfocards: QueryList<DraftinfocardComponent>;

  draftsData: Array<{ uid: string, id: number }> = [];
  media: Array<{
    media: MediaInstance;
    used_in: Array<{ id: number, name: string, color: string }>;
  }> = [];
  selectedDraftIds: Set<number> = new Set();
  private draftRenderingsSubscription: Subscription;


  draftInputs: Array<{ id: number; name: string; draft: Draft }> = [];
  filename: FormControl;
  fileDescription: FormControl;
  id: number;
  from_share: string;
  time: number;
  owner: string;
  hiddenDrafts: Array<DraftNode> = [];
  projectOwner: string;

  fileMetaChangeUndoSubscription: Subscription;
  savedTimeSubscription: Subscription;

  connection_state = false;
  private connectionSubscription: Subscription;



  constructor() {

    this.draftsData = [];

    this.connectionSubscription = this.fb.connectionChangeEvent$.subscribe(data => {
      this.connection_state = data;
    })
  }

  ngOnInit() {
    // Initialize form control with current filename
    const currentFileName = this.ws.getCurrentFile()?.name || '';
    this.filename = new FormControl(currentFileName, [Validators.required, Validators.minLength(1)]);

    this.fileDescription = new FormControl('');


    this.loadMeta();
    this.loadDrafts();
    this.loadMaterials();
    this.loadMedia();




    this.savedTimeSubscription = this.fb.saveTimeUpdatedEvent$.subscribe(time => {
      this.time = time;
    });
  }

  ngAfterViewInit() {
    // Trigger rendering after view is initialized
    this.renderAllDrafts();

    // Subscribe to QueryList changes to handle dynamic updates
    this.draftRenderingsSubscription = this.draftRenderings.changes.subscribe(() => {
      this.renderAllDrafts();
    });
  }

  ngOnDestroy() {

    if (this.connectionSubscription) {
      this.connectionSubscription.unsubscribe();
    }

    if (this.savedTimeSubscription) {
      this.savedTimeSubscription.unsubscribe();
    }
    if (this.fileMetaChangeUndoSubscription) {
      this.fileMetaChangeUndoSubscription.unsubscribe();
    }
    if (this.draftRenderingsSubscription) {
      this.draftRenderingsSubscription.unsubscribe();
    }
  }

  scrollToMaterials() {
    const materialsSection = document.getElementById('materials');
    if (materialsSection) {
      materialsSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  share() {
    const fileid = this.ws.getCurrentFile().id;
    const dialogRef = this.dialog.open(ShareComponent, {
      width: '600px',
      data: { fileid }
    });
  }

  openDraftInEditor(id: number) {
    this.onOpenInEditor.emit(id);
  }



  openDraftInMixer(id: number) {
    this.onOpenInMixer.emit(id);
  }



  //called from library when the workspace name is changed in the library. 
  renameWorkspace(name: string) {
    this.filename.markAsPristine();


    const beforeMeta = {
      id: this.ws.getCurrentFile().id,
      name: this.ws.getCurrentFile().name,
      desc: this.ws.getCurrentFile().desc,
      from_share: this.ws.getCurrentFile().from_share,
      time: this.ws.getCurrentFile().time,
    };

    this.ws.setCurrentFileName(name);
    const afterMeta = this.ws.getCurrentFile();

    this.ss.addStateChange(<FileMetaStateChange>{
      type: 'META_CHANGE',
      id: this.ws.getCurrentFile().id,
      before: beforeMeta,
      after: afterMeta
    });
    this.ws.setCurrentFileName(name);
    this.onWorkspaceRename.emit(name);
  }

  //called from app when the workspace name is changed in the footer. 
  updateWorkspaceName(name: string) {
    this.filename.setValue(name, { emitEvent: false });
    this.filename.markAsPristine();
  }

  //description changes can only originate from this location 
  updateWorkspaceDescription(description: string) {
    this.fileDescription.markAsPristine();

    const beforeMeta = {
      id: this.ws.getCurrentFile().id,
      name: this.ws.getCurrentFile().name,
      desc: this.ws.getCurrentFile().desc,
      from_share: this.ws.getCurrentFile().from_share,
      time: this.ws.getCurrentFile().time,
    };

    this.ws.setCurrentFileDesc(description);
    const afterMeta = this.ws.getCurrentFile();


    this.ss.addStateChange(<FileMetaStateChange>{
      originator: 'FILEMETA',
      type: 'META_CHANGE',
      id: this.ws.getCurrentFile().id,
      before: beforeMeta,
      after: afterMeta
    });
  }

  updateWorkspaceDescriptionFromUndo(description: string) {
    this.fileDescription.setValue(description, { emitEvent: false });
    this.fileDescription.markAsPristine();
  }


  private renderAllDrafts() {
    // Use setTimeout to ensure the view has fully updated
    setTimeout(() => {
      this.draftRenderings.forEach((rendering) => {
        if (rendering.id !== -1) {
          rendering.onNewDraftLoaded(rendering.id);
          rendering.forceRedraw();
        }
      });
    }, 0);
  }

  loadMeta() {
    const meta = this.ws.getCurrentFile();
    this.id = meta.id;
    this.from_share = meta.from_share;
    this.time = meta?.time || -1;
    this.projectOwner = meta?.share_owner || '';

  }

  formatTime(timestamp: number): string {
    if (!timestamp || timestamp <= 0) {
      return 'Not saved yet';
    }
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }


  refreshDrafts() {
    this.loadDrafts()
  }



  loadDrafts() {



    this.draftsData = [];

    //keep a list of hidden drafts
    const draftNodes: Array<DraftNode> = this.tree.getDraftNodes();
    draftNodes.filter(node => node.draft !== null && node.draft !== undefined)
      .filter(node => node.visible === true)
      .forEach(node => {

        this.draftsData.push({
          uid: Math.random().toString(36).substring(2, 15),
          id: node.id
        });
      });


    this.hiddenDrafts = this.tree.getDraftNodes()
      .filter(node => node.draft !== null && node.draft !== undefined)
      .filter(node => node.visible === false);






  }

  hideSelectedDrafts() {
    this.selectedDraftIds.forEach(id => {
      const node = this.tree.getNode(id) as DraftNode;
      node.visible = false;
    });
    this.loadDrafts();
  }

  showHiddenDrafts() {
    this.hiddenDrafts.forEach(node => {
      node.visible = true;
    });
    this.loadDrafts();
  }


  loadMaterials() {
    if (this.materials !== undefined && this.materials !== null) {
      this.materials.onLoad();
    }
  }

  loadMedia() {
    this.media = this.mediaService.current.slice().map(media => ({
      media: media,
      used_in: [] as Array<{ id: number, name: string, color: string }> // Create a copy of the array
    }));

    let allOps = this.tree.getOpNodes();
    allOps.forEach(op => {
      op.params.forEach(param => {
        if ((<Img>param).id !== undefined) {
          let media_item = this.media.find(el => el.media.id == +(<Img>param).id);
          if (media_item !== undefined) {
            const meta = this.ops.getOp(op.name).meta;
            const name = meta.displayname;
            const color = (meta.categories.length > 0) ? this.ops.getCatColor(meta.categories[0].name) : '#000';
            let used_in: { id: number, name: string, color: string } = { id: op.id, name, color };
            media_item.used_in.push(used_in);
          }
        }
      });
    });


  }

  deleteMediaItem(mediaItem: MediaInstance) {
    this.mediaService.removeInstance(mediaItem.id);
    this.loadMedia();
  }

  onFocus(id: number) {
    this.media = [];
    this.selectedDraftIds.clear();
    this.loadDrafts();
    this.loadMaterials();
    this.loadMedia();
    this.loadMeta();
    this.filename.setValue(this.ws.getCurrentFile().name, { emitEvent: false });
    this.fileDescription.setValue(this.ws.getCurrentFile().desc || '', { emitEvent: false });

    // Trigger rendering after view updates
    this.renderAllDrafts();
  }

  toggleDraftSelection(draftId: number) {
    if (this.selectedDraftIds.has(draftId)) {
      this.selectedDraftIds.delete(draftId);
    } else {
      this.selectedDraftIds.add(draftId);
    }
  }



  getSelectedDraftsCount(): number {

    return this.selectedDraftIds.size;
  }

  isSeedDraft(draftId: number): boolean {
    return this.tree.isSeedDraft(draftId);
  }



  /**
   * passes along message from draft info card component
   * @param draftId 
   */
  onDraftRename(draftId: number) {
    this.onDraftNameChange.emit(draftId);
  }

  async downloadAllDraftsAsBitmaps() {
    console.log("DOWNLAOD ALL CALLED");

    if (!this.hiddenCanvas) {
      console.error('Canvas element not found');
      return;
    }

    const canvas = this.hiddenCanvas.nativeElement;


    let downloadList = [];
    if (this.selectedDraftIds.size == 0) downloadList = this.draftsData.map(el => el.id);
    else downloadList = Array.from(this.selectedDraftIds);



    // Download each draft sequentially to avoid browser blocking multiple downloads
    for (const draftId of downloadList) {
      try {
        await saveAsBmp(
          canvas,
          this.tree.getDraft(draftId),
          this.ws.selected_origin_option,
          this.ms,
          this.fs
        );
        // Small delay between downloads to prevent browser blocking
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Error downloading draft ${draftId}:`, error);
      }
    }
  }

  /**
   * Exports the current materials list as a CSV file
   */
  exportMaterialsAsCSV() {
    const materials = this.ms.getShuttles();

    // CSV header
    const headers = ['id', 'name', 'color', 'diameter', 'notes'];

    // Escape CSV values (handle commas, quotes, and newlines)
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value);
      // If the value contains comma, quote, or newline, wrap it in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV content
    const csvRows = [headers.join(',')];

    materials.forEach(material => {
      const row = [
        escapeCSV(material.id),
        escapeCSV(material.name),
        escapeCSV(material.color),
        escapeCSV(material.diameter),
        escapeCSV(material.notes || '')
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `materials_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * Handles CSV file upload and updates materials
   */
  onCSVFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const csvContent = e.target.result as string;
        this.importMaterialsFromCSV(csvContent);
      } catch (error) {
        console.error('Error reading CSV file:', error);
        alert('Error reading CSV file. Please check the file format.');
      }

      // Reset the input so the same file can be selected again
      if (this.csvFileInput) {
        this.csvFileInput.nativeElement.value = '';
      }
    };

    reader.onerror = () => {
      alert('Error reading file. Please try again.');
      if (this.csvFileInput) {
        this.csvFileInput.nativeElement.value = '';
      }
    };

    reader.readAsText(file);
  }

  /**
   * Parses CSV content and updates materials
   */
  private importMaterialsFromCSV(csvContent: string) {
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);

    if (lines.length < 2) {
      alert('CSV file must contain at least a header row and one data row.');
      return;
    }

    // Parse header
    const headerLine = lines[0];
    const headers = this.parseCSVLine(headerLine);

    // Expected headers
    const expectedHeaders = ['id', 'name', 'color', 'diameter', 'notes'];
    const headerMap: { [key: string]: number } = {};

    // Validate all required headers are present
    for (const header of expectedHeaders) {
      const index = headers.findIndex(h => h.toLowerCase().trim() === header.toLowerCase());
      if (index === -1) {
        alert(`CSV file is missing required column: ${header}`);
        return;
      }
      headerMap[header] = index;
    }

    // Parse data rows
    const importedMaterials: Material[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);

      if (values.length < expectedHeaders.length) {
        console.warn(`Skipping row ${i + 1}: insufficient columns`);
        continue;
      }

      try {
        const id = parseInt(values[headerMap['id']], 10);
        const name = values[headerMap['name']] || '';
        const color = values[headerMap['color']] || '#000000';
        const diameter = parseFloat(values[headerMap['diameter']]) || 1;
        const notes = values[headerMap['notes']] || '';

        // Validate color format
        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
          console.warn(`Row ${i + 1}: Invalid color format "${color}", using default`);
          continue;
        }

        const material = createMaterial({
          id: id,
          name: name,
          color: color,
          diameter: diameter,
          notes: notes,
          insert: true,
          visible: true,
          thickness: 100,
          type: 0
        });

        material.rgb = hexToRgb(color);
        importedMaterials.push(material);
      } catch (error) {
        console.error(`Error parsing row ${i + 1}:`, error);
      }
    }

    if (importedMaterials.length === 0) {
      alert('No valid materials found in CSV file.');
      return;
    }

    // Confirm before updating
    const confirmMessage = `This will replace ${this.ms.getShuttles().length} existing materials with ${importedMaterials.length} materials from the CSV file. Continue?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    // Store before state for undo
    const beforeMaterials = this.ms.getShuttles().slice();

    // Update materials - reassign IDs to match array indices
    importedMaterials.forEach((material, index) => {
      setMaterialID(material, index);
    });

    // Replace materials

    console.log("IMPORTED MATERIALS", importedMaterials);

    // Add state change for undo/redo
    const change: MaterialsStateChange = {
      originator: 'MATERIALS',
      type: 'UPDATED',
      before: beforeMaterials,
      after: this.ms.getShuttles().slice()
    };
    this.ss.addStateChange(change);


    this.ms.overloadShuttles(importedMaterials);

    console.log("After Overload", this.ms.getShuttles());
    // Reload materials in the view
    this.loadMaterials();

    alert(`Successfully imported ${importedMaterials.length} materials.`);
  }

  /**
   * Parses a CSV line, handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = i < line.length - 1 ? line[i + 1] : '';

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add the last field
    values.push(current.trim());

    return values;
  }

  /**
   * Triggers the CSV file input click
   */
  triggerCSVImport() {
    if (this.csvFileInput) {
      this.csvFileInput.nativeElement.click();
    }
  }

  /**
   * Downloads a media item as an image file
   */
  async downloadMediaItem(mediaItem: MediaInstance) {
    try {
      const imageUrl = mediaItem.img.image.src;
      const imageName = mediaItem.img.name || 'media_item';

      // Fetch the image
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      // Determine file extension from blob type or default to png
      let extension = 'png';
      if (blob.type) {
        if (blob.type.includes('jpeg') || blob.type.includes('jpg')) {
          extension = 'jpg';
        } else if (blob.type.includes('png')) {
          extension = 'png';
        } else if (blob.type.includes('gif')) {
          extension = 'gif';
        } else if (blob.type.includes('webp')) {
          extension = 'webp';
        }
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${imageName}.${extension}`;
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL object
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading media item:', error);
      alert('Failed to download media item. Please try again.');
    }
  }


  importFrom(source: string) {
    //the loadfile component will upload and call the file service to process, then the results will be emitted to teh 
    //parent app, where a new 
    this.dialog.open(LoadfileComponent, {
      data: {
        type: source,
        title: 'Import draft(s) from ' + source + ' file(s)',
        accepts: source === 'bitmap' ? '.bmp .png .jpg .jpeg .gif .webp' : '.wif',
        multiple: true
      }
    })
  }
}




