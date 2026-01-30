import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaterialComponent } from './material';
describe('MaterialModal', () => {
  let component: MaterialComponent;
  let fixture: ComponentFixture<MaterialComponent>;

  beforeEach((() => {
    TestBed.configureTestingModule({
      imports: [MaterialComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MaterialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

