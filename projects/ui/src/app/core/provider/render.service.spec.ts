import { TestBed } from '@angular/core/testing';

import { RenderService } from './render.service';

describe('RenderService', () => {
  let service: RenderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RenderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
