import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MaterialModal} from './material.modal';

describe('MaterialModal', () => {
  let component: MaterialModal;
  let fixture: ComponentFixture<MaterialModal>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
    imports: [MaterialModal]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MaterialModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

