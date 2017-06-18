In this folder you will find demo and test pages that use SVG-to-PDFKit:
&nbsp; &nbsp; 

- See the capabilities of SVG-to-PDFKit with some SVG samples : 
<a href="https://alafr.github.io/SVG-to-PDFKit/examples/demo.htm" target="_blank">demo.htm</a>
- Try the various options supported by SVG-to-PDFKit : 
<a href="https://alafr.github.io/SVG-to-PDFKit/examples/options.htm" target="_blank">options.htm</a>
- Run automatic tests to check for regressions (Chrome only) : 
<a href="https://alafr.github.io/SVG-to-PDFKit/examples/tests.htm" target="_blank">tests.htm</a>

You will also find an updated PDFKit version, prebuilt and ready for use in `<script>` tags.

&nbsp; &nbsp;

### Tests
Tests are SVG files downloaded from https://www.w3.org/Graphics/SVG/WG/wiki/Test_Suite_Overview and embeded into a javascript 'Tests.js' file. Test files containing animations, filters, scripting, CSS styling or links have been removed, as these SVG features are out of this repository's scope.

Each SVG file is converted into PDF with SVG-to-PDFKit and <a href="https://github.com/devongovett/pdfkit">PDFKit</a>, and the resulting PDF is rendered as an image with <a href="https://github.com/mozilla/pdf.js/">PDFjs</a>. The same SVG file is drawn into a canvas by the browser (it only works in Chrome). The two images are then compared with <a href="https://github.com/Huddle/Resemble.js/">Resemble.js</a>.

The percentage of difference computed by Resemble.js is not enough to determine if a test is passed or failed, but any change in the percentage after a commit needs manual verification.

#### Summary of test results

|	Test result	|	Count	| % |
|	---	|	---	|	---	|
|	Failed tests	| 28 | 12.2% |
| Passed tests | 201 | 87.8% |
| **Total tests** | **229** |  |

#### Failed tests because of bugs or missing features in SVG-to-PDFKit

|	Failed tests	|	Comment	|
|	---	|	---	|
|	paths-data-20-f.svg	|	Special case in arcTo path	|
|	pservers-grad-17-b.svg	|	Gradient fallback	|
|	pservers-grad-20-b.svg	|	Gradient fallback	|
|	pservers-pattern-03-f.svg	|	Pattern fallback	|
|	pservers-pattern-09-f.svg	|	Pattern fallback	|
|	struct-symbol-01-b.svg	|	Symbol	|
|	struct-use-09-b.svg	|	Symbol	|
|	text-align-05-b.svg	|	Vertical text	|
|	text-align-06-b.svg	|	Vertical text	|
|	text-align-07-t.svg	|	Unicode	|
|	text-align-08-b.svg	|	Unicode	|
|	text-bidi-01-t.svg	|	Unicode	|
|	text-deco-01-b.svg	|	Text decoration	|
|	text-fonts-01-t.svg	|	Unicode	|
|	text-fonts-203-t.svg	|	Text small caps	|
|	text-fonts-204-t.svg	|	Text small caps	|
|	text-intro-01-t.svg	|	Unicode	|
|	text-intro-02-b.svg	|	Unicode	|
|	text-intro-03-b.svg	|	Unicode + Vertical text	|
|	text-intro-04-t.svg	|	Unicode	|
|	text-intro-05-t.svg	|	Unicode	|
|	text-intro-06-t.svg	|	Unicode	|
|	text-intro-07-t.svg	|	Unicode	|
|	text-intro-09-b.svg	|	Unicode	|
|	text-intro-10-f.svg	|	Unicode	|
|	text-intro-11-t.svg	|	Unicode	|
|	text-intro-12-t.svg	|	Unicode	|
|	text-text-03-b.svg	|	Text decoration	|

#### Passed tests that look like fails because of bugs in other packages

|	Passed tests	|	Comment	|
|	---	|	---	|
|	color-prop-05-t.svg	|	Chrome bug	|
|	pservers-grad-02-b.svg	|	PDFjs bug	|
|	pservers-grad-04-b.svg	|	PDFjs bug	|
|	pservers-grad-05-b.svg	|	PDFjs bug	|
|	pservers-grad-06-b.svg	|	PDFjs bug	|
|	pservers-grad-07-b.svg	|	PDFjs bug	|
|	pservers-grad-08-b.svg	|	PDFjs bug	|
|	pservers-grad-10-b.svg	|	PDFjs bug	|
|	pservers-grad-11-b.svg	|	PDFjs bug	|
|	pservers-grad-12-b.svg	|	PDFjs bug	|
|	pservers-grad-13-b.svg	|	PDFjs bug	|
|	pservers-grad-14-b.svg	|	PDFjs bug	|
|	pservers-grad-15-b.svg	|	PDFjs bug	|
|	pservers-grad-16-b.svg	|	PDFjs bug	|
|	pservers-grad-18-b.svg	|	PDFjs bug	|
|	pservers-grad-21-b.svg	|	Chrome bug + PDFjs bug	|
|	pservers-grad-22-b.svg	|	PDFjs bug	|
|	pservers-pattern-01-b.svg	|	PDFjs bug	|
|	styling-inherit-01-b.svg	|	PDFjs bug	|
|	text-text-01-b.svg	|	Chrome bug	|
