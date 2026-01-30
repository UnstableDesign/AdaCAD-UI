import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoomComponent } from '../loom/loom.component';

describe('LoomComponent', () => {
  let component: LoomComponent;
  let fixture: ComponentFixture<LoomComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [LoomComponent]
})
    .compileComponents();

    fixture = TestBed.createComponent(LoomComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
