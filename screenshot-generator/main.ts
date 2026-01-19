import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const URL = 'http://localhost:4200/';
const documentationDirectory = './ada_documentation_files/';
const screenshotsDir = './screenshots';
// raw screenshots from puppeteer
const screenshotsRawDir = path.join(screenshotsDir, 'raw');
// cropped screenshots from sharp
const screenshotsProcessedDir = path.join(screenshotsDir, 'processed');
// note this padding is just for the top and bottom of the image
let verticalCropPadding = 20;

type FileEntry = { path: string; name: string; extension: string };

main().catch(console.error);

async function main() {
  // optional args
  const skipScreenshots = process.argv.includes('--skip-screenshots');
  const skipCropping = process.argv.includes('--skip-cropping');

  if (skipScreenshots && skipCropping) {
    console.log('...');
    return;
  }

  const filterFiles = process.argv.find(arg => arg.startsWith('--filter='));
  const filterFileNames: Array<string> = filterFiles
    ? filterFiles
        .split('=')[1]
        .split(',')
        .map(name => name.trim())
    : [];

  const paddingArg = process.argv.find(arg => arg.startsWith('--padding='));
  if (paddingArg) {
    const padding = paddingArg.split('=')[1];
    verticalCropPadding = Number(padding);
  }

  // create screenshot directories if they don't exist
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }
  if (!fs.existsSync(screenshotsRawDir)) {
    fs.mkdirSync(screenshotsRawDir);
  }
  if (!fs.existsSync(screenshotsProcessedDir)) {
    fs.mkdirSync(screenshotsProcessedDir);
  }

  if (!skipScreenshots) {
    await captureScreenshots(filterFileNames);
  }

  if (!skipCropping) {
    await cropScreenshots(filterFileNames);
  }

  console.log('script finished');
}

async function captureScreenshots(specificAdaFilesToCapture: Array<string>) {
  console.log('launching browser!');
  const browser = await puppeteer.launch({
    // uncomment the line below to see the screenshots happen live
    // headless: false,
  });

  console.log('opening new page');
  const page = await browser.newPage();

  // Set a larger viewport
  await page.setViewport({ width: 2100, height: 1000 });

  console.log(`navigating to ${URL}`);
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.waitForNetworkIdle();

  console.log('page loaded');

  await new Promise(t => setTimeout(t, 1000));

  // inject CSS to:
  // 1. remove the "added to workspace" animation that is on the component titles
  // 2. remove the side nav drag button that appears on the top left of the viewport otherwise
  // 3. remove the black overlay fade animation
  await page.evaluate(async () => {
    const style = document.createElement('style');
    style.type = 'text/css';
    const content = `
      .operation-details {
        animation: unset !important;
      }

      .sidenav_mover {
        visibility: hidden !important;
      }

      .black-overlay.stable {
        animation: unset !important;
      }
    `;
    style.appendChild(document.createTextNode(content));
    const promise = new Promise((resolve, reject) => {
      style.onload = resolve;
      style.onerror = reject;
    });
    document.head.appendChild(style);
    await promise;
  });

  // get all files in directory
  console.log('loading all .ada documentation files');
  const allAdaFiles = getAdaFiles(documentationDirectory);

  console.log(`found ${allAdaFiles.length} .ada files`);

  // apply the optional --filter arg if it was provided
  const filteredAdaFiles =
    specificAdaFilesToCapture.length > 0
      ? allAdaFiles.filter(file => specificAdaFilesToCapture.findIndex(name => file.path.startsWith(name)) > -1)
      : allAdaFiles;

  if (allAdaFiles.length > filteredAdaFiles.length) {
    console.log('filter applied, capturing file count: ' + filteredAdaFiles.length);
  }

  let i = 1;
  const parseErrors: { file: FileEntry; error: string }[] = [];

  for (let file of filteredAdaFiles) {
    process.stdout.write('processing file #' + i++ + '\r');

    let jsonAdaFile: string;
    try {
      const adaFileContents = fs.readFileSync(file.path, 'utf8');
      jsonAdaFile = JSON.parse(adaFileContents);
    } catch (error) {
      parseErrors.push({ file, error });
      continue;
    }

    await page.evaluate(async adaFile => {
      await (window as any).loadAdaFileJson(adaFile);
      // we have to wait awhile for each one, because it takes time to load
      // the save state, and we sometimes see the loading modal pop up
      await new Promise(t => setTimeout(t, 200));
      await (window as any).autoLayout();
      await new Promise(t => setTimeout(t, 200));
      await (window as any).zoomToFit();
    }, jsonAdaFile);

    const mainView = await page.waitForSelector('app-palette');
    await mainView.screenshot({
      path: (path.join(screenshotsRawDir, file.name) + '.png') as `${string}.png`,
    }); // TS doesn't like this w/o the cast
  }

  if (parseErrors.length > 0) {
    console.log(`\nfailed to parse ${parseErrors.length} file(s):`);
    parseErrors.forEach(({ file, error }) => console.log(`  ${file.path}: ${error}`));
  }

  console.log();
  console.log('completed screenshots, closing browser, and starting cropping process');

  // potential future enhancement here: verify output files in some way

  await browser.close();
}

async function cropScreenshots(specificImagesToCrop: Array<string>) {
  const imageFileNames = fs.readdirSync(screenshotsRawDir);

  const filteredImageFiles =
    specificImagesToCrop.length > 0
      ? imageFileNames.filter(file => specificImagesToCrop.findIndex(name => file.startsWith(name)) > -1)
      : imageFileNames;

  if (imageFileNames.length > filteredImageFiles.length) {
    console.log('filter applied, matching image file count: ' + filteredImageFiles.length);
  }

  let i = 1;
  for (let imageFileName of filteredImageFiles) {
    process.stdout.write('cropping file #' + i++ + '\r');
    const image = sharp(path.join(screenshotsRawDir, imageFileName));
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;

    // background of ADA is #f0f0f0 which is 240
    const threshold = 230;

    // scan the image to figure out the top and bottom of the ada components
    const hits: Array<Array<number> | null> = Array.from({
      length: Math.floor(width / 10),
    })
      .map((_, x) =>
        Array.from({ length: height }).map((_, y) => {
          const i = (y * width + x * 10) * channels;
          const rgb = [data[i], data[i + 1], data[i + 2]];
          const avg = rgb.reduce((a, c) => a + c, 0) / 3;
          return avg < threshold ? [x, y] : null;
        }),
      )
      .reduce((a, c) => [...a, ...c])
      .filter(Boolean);

    const bounds = hits.reduce(
      (acc, hit) => {
        return {
          minY: Math.min(acc.minY, hit[1]),
          maxY: Math.max(acc.maxY, hit[1]),
        };
      },
      { minY: height, maxY: 0 },
    );

    // add padding
    const top = Math.max(bounds.minY - verticalCropPadding, 0);
    const bottom = Math.min(bounds.maxY + verticalCropPadding, height);

    const cropHeight = bottom - top;

    await image
      .extract({ top, height: cropHeight, left: 0, width })
      // quality of 80 doesn't seem to visually differ much at all, but it gets us to 1/3rd the file size
      .png({ quality: 80 })
      .toFile(path.join(screenshotsProcessedDir, imageFileName));
  }

  console.log();
  console.log('completed cropping');
}

const collectFilesRecursive = (directory: string): FileEntry[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry): FileEntry[] => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectFilesRecursive(fullPath);
    }

    if (entry.isFile()) {
      const ext = path.extname(entry.name);
      return [
        {
          path: fullPath,
          name: path.basename(entry.name, ext),
          extension: ext,
        },
      ];
    }

    return [];
  });
};

const getAdaFiles = (directory: string): FileEntry[] =>
  collectFilesRecursive(directory).filter(f => f.extension === '.ada');
