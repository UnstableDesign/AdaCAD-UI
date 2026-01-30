import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftinfocardComponent } from './draftinfocard.component';

describe('DraftinfocardComponent', () => {
  let component: DraftinfocardComponent;
  let fixture: ComponentFixture<DraftinfocardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DraftinfocardComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(DraftinfocardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
