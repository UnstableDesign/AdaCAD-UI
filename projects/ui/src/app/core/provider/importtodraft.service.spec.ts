import { TestBed } from '@angular/core/testing';

import { ImporttodraftService } from './importtodraft.service';

describe('ImporttodraftService', () => {
  let service: ImporttodraftService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImporttodraftService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
