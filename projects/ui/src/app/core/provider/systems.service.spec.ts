import { TestBed } from '@angular/core/testing';

import { SystemsService } from './systems.service';

describe('SystemsService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: SystemsService = TestBed.inject(SystemsService);
    expect(service).toBeTruthy();
  });
});
