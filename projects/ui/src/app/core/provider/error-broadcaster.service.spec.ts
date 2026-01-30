import { TestBed } from '@angular/core/testing';

import { ErrorBroadcasterService } from './error-broadcaster.service';

describe('ErrorBroadcasterService', () => {
  let service: ErrorBroadcasterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ErrorBroadcasterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
