import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { InitModal } from './init.modal';

describe('InitModal', () => {
  let component: InitModal;
  let fixture: ComponentFixture<InitModal>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
    imports: [InitModal]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(InitModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
