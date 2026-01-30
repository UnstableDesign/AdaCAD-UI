! the screenshot script assumes the application is running locally on http://localhost:4200/

To run the screenshot generator use the command: 
`npx tsx main.ts`

Optional args:
--skip-screenshots (skips the screenshotting process, useful if you just want to recrop images)
--skip-cropping (might be useful)
--padding (in pixels, the amount of whitespace above and below the nodes that shouldn't get cropped out)
  e.g, --padding=100
--filter (runs the script for the specific .ada files provided)
  e.g, --filter=tabby,twill

--

The script finds all of the .ada files in ./ada_documentation_files

It loads the files into the application through a headless browser

Then applies auto layout, zooms and centers, and lastly screenshots

These images tend to have a fair bit of empty space top and bottom

So we crop them and the outputs are saved to ./screenshots/processed