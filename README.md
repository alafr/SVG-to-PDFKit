# SVG-to-PDFKit
Insert SVG into a PDF document created with PDFKit.

Use:

    SVGtoPDF(doc, svg, x, y);

Parameters:

    doc [PDFDocument] = the PDF document created with PDFKit
    svg [SVGElement or string] = the SVG object or XML code
    x, y [number] = the position where the SVG will be added

Demo:

&nbsp; &nbsp; <a href="https://alafr.github.io/SVG-to-PDFKit/test.htm" target="_blank">https://alafr.github.io/SVG-to-PDFKit/test.htm</a>

Supported:
 - shapes: rect, circle, path, ellipse, line, polyline, polygon
 - special elements: use, nested svg
 - text elements: text, tspan and a few of their attributes
 - styling: with attributes only
 - colors: fill, stroke & color (rgb, rgba, hex, string), fill-opacity, stroke-opacity & opacity
 - units: all standard units except em, ex
 - transformations: transform, viewBox & preserveAspectRatio attributes

Unsupported:
 - css: style element and inline style
 - text: textPath & most attributes of text & tspan elements
 - foreignElement, clip paths, gradients
 - other things I don't even know they exist

Warning: some features depend on options not yet commited into PdfKit will only work in the demo.

### They are many bugs, please send issues and/or pull requests.
