import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { SubdraftComponent } from './subdraft.component';

describe('SubdraftComponent', () => {
  let component: SubdraftComponent;
  let fixture: ComponentFixture<SubdraftComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
    imports: [SubdraftComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SubdraftComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
