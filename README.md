# SVG-to-PDFKit
Insert SVG into a PDF document created with PDFKit.

####Use:

    SVGtoPDF(doc, svg, x, y, options);

####Parameters:

    doc [PDFDocument] = the PDF document created with PDFKit
    svg [SVGElement or string] = the SVG object or XML code
    x, y [number] = the position where the SVG will be added
    options [Object] = not documented yet

####Demo:

&nbsp; &nbsp; <a href="https://alafr.github.io/SVG-to-PDFKit/demo.htm" target="_blank">https://alafr.github.io/SVG-to-PDFKit/demo.htm</a>

####Supported:
 - shapes: rect, circle, path, ellipse, line, polyline, polygon
 - special elements: use, nested svg
 - text elements: text, tspan, textPath
 - text attributes: x, y, dx, dy, rotate, text-anchor, textLength, word-spacing, letter-spacing, font-size
 - styling: with attributes only
 - colors: fill, stroke & color (rgb, rgba, hex, string), fill-opacity, stroke-opacity & opacity
 - units: all standard units
 - transformations: transform, viewBox & preserveAspectRatio attributes
 - clip paths & masks

####Unsupported:
 - css: style element and inline style
 - gradients (<a href="https://github.com/alafr/SVG-to-PDFKit/issues/16">#16</a>)
 - other things I don't even know they exist

####Warning:
 - There are bugs, please send issues and/or pull requests.

####Other useful projects:
 - <a href="https://github.com/devongovett/pdfkit">PDFKit</a>, the JavaScript PDF generation library for Node and the browser 
 - If you want to insert SVGs into a PDFKit document there is also <a href="https://github.com/devongovett/svgkit">svgkit</a> with more supported features.
 - For the opposite conversion, from PDF to SVG, you can use <a href="https://github.com/mozilla/pdf.js">Mozilla's PDF.js</a>.
