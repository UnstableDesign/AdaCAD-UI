import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewadjustComponent } from './viewadjust.component';

describe('ViewadjustComponent', () => {
  let component: ViewadjustComponent;
  let fixture: ComponentFixture<ViewadjustComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewadjustComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ViewadjustComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
