import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MixerComponent } from './mixer.component';

describe('MixerComponent', () => {
  let component: MixerComponent;
  let fixture: ComponentFixture<MixerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MixerComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MixerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
