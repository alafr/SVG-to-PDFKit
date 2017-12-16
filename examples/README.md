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
Tests are SVG files downloaded from https://www.w3.org/Graphics/SVG/WG/wiki/Test_Suite_Overview and embeded into a javascript `tests1.js` file. Test files containing animations, filters, scripting, CSS styling or links have been removed, as these SVG features are out of this repository's scope. Other new tests are added in the `tests2.js` file.

Each SVG file is converted into PDF with SVG-to-PDFKit and <a href="https://github.com/devongovett/pdfkit">PDFKit</a>, and the resulting PDF is rendered as an image with <a href="https://github.com/mozilla/pdf.js/">PDFjs</a>. The same SVG file is drawn into a canvas by the browser (it only works in Chrome). The two images are then compared with <a href="https://github.com/Huddle/Resemble.js/">Resemble.js</a>.

The percentage of difference computed by Resemble.js is not enough to determine if a test is passed or failed, but any change in the percentage after a commit needs manual verification.

#### Summary of test results

|	Test result	|	Count	| % |
|	---	|	---	|	---	|
|	Failed tests	| 20 | 8.6% |
| Passed tests | 212 | 91.4% |
| **Total tests** | **232** |  |

#### Failed tests because of bugs or missing features in SVG-to-PDFKit

|	Failed tests	|	Comment	|
|	---	|	---	|
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

#### Passed tests that look like fails because of bugs in other packages

|	Passed tests	|	Comment	|
|	---	|	---	|
| additional-test-01.svg	| Chrome bug https://crbug.com/450368	|
| additional-test-02.svg	| Chrome bug https://crbug.com/603995	|
|	color-prop-05-t.svg	|	Specifications conflict https://crbug.com/571723	|
|	pservers-grad-02-b.svg	|	PDFjs bug https://git.io/vQqgG	|
|	pservers-grad-04-b.svg	|	PDFjs bug https://git.io/vQqgG	|
|	pservers-grad-05-b.svg	|	PDFjs bug https://git.io/vFQP6	|
|	pservers-grad-06-b.svg	|	PDFjs bug https://git.io/vQqgG	|
|	pservers-grad-08-b.svg	|	PDFjs bug	|
|	pservers-grad-10-b.svg	|	PDFjs bug	|
|	pservers-grad-11-b.svg	|	PDFjs bug https://git.io/vQqgG	|
|	pservers-grad-12-b.svg	|	PDFjs bug https://git.io/vQqgG	|
|	pservers-grad-13-b.svg	|	PDFjs bug	|
|	pservers-grad-14-b.svg	|	PDFjs bug https://git.io/vQqgG	|
|	pservers-grad-15-b.svg	|	PDFjs bug https://git.io/vQqgG	|
|	pservers-grad-16-b.svg	|	PDFjs bug	|
|	pservers-grad-17-b.svg	|	PDFjs bug	|
|	pservers-grad-18-b.svg	|	PDFjs bug https://git.io/vFQP6	|
|	pservers-grad-20-b.svg	|	PDFjs bug	|
|	pservers-grad-21-b.svg	|	Chrome bug https://crbug.com/322487 + PDFjs bug https://git.io/vFQP6	|
|	pservers-grad-22-b.svg	|	PDFjs bug https://git.io/vQqgG	|
|	pservers-pattern-01-b.svg	|	PDFjs bug https://git.io/vF95D	|
|	styling-inherit-01-b.svg	|	PDFjs bug https://git.io/vQqgG	|
