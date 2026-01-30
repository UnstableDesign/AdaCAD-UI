import { AdaCADWeaverPage } from './app.po';

describe('adacad-weaver App', () => {
  let page: AdaCADWeaverPage;

  beforeEach(() => {
    page = new AdaCADWeaverPage();
  });

  it('should display welcome message', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('Welcome to app!');
  });
});
