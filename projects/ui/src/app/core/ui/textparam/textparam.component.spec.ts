import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TextparamComponent } from './textparam.component';

describe('TextparamComponent', () => {
  let component: TextparamComponent;
  let fixture: ComponentFixture<TextparamComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextparamComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TextparamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
