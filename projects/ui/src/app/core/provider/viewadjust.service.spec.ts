import { TestBed } from '@angular/core/testing';

import { ViewadjustService } from './viewadjust.service';

describe('ViewadjustService', () => {
  let service: ViewadjustService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ViewadjustService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
