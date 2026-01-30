import { TestBed } from '@angular/core/testing';

import { StateService } from './state.service';

describe('StateService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: StateService = TestBed.inject(StateService);
    expect(service).toBeTruthy();
  });
});
