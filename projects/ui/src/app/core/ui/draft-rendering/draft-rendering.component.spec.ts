import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftRenderingComponent } from './draft-rendering.component';

describe('DraftRenderingComponent', () => {
  let component: DraftRenderingComponent;
  let fixture: ComponentFixture<DraftRenderingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DraftRenderingComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DraftRenderingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
