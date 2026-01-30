import { TestBed } from '@angular/core/testing';

import { MaterialsService } from './materials.service';

describe('MaterialsService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: MaterialsService = TestBed.inject(MaterialsService);
    expect(service).toBeTruthy();
  });
});
