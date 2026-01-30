import { TestBed } from '@angular/core/testing';

import { OperationService } from './operation.service';

describe('OperationService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: OperationService = TestBed.inject(OperationService);
    expect(service).toBeTruthy();
  });
});
