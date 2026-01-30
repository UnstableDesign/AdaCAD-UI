import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageeditorComponent } from './imageeditor.component';

describe('ImageeditorComponent', () => {
  let component: ImageeditorComponent;
  let fixture: ComponentFixture<ImageeditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageeditorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ImageeditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
