# SVG-to-PDFKit
Insert SVG into a PDF document created with PDFKit

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
 - styling with attributes only
 - colors: fill & stroke (rgb, rgba, hex or string), fill-opacity, stroke-opacity & opacity
 - units: all standard units except em, ex
 - text: text, tspan and a few of their attributes
 - transform, viewBox, preserveAspectRatio attributes

Unsupported:
 - css: style element and inline style
 - text: textPath & most attributes of text & tspan elements
 - foreignElement, clip paths, gradients
 - other things I don't even know they exist

### They are many bugs, please send issues and/or pull requests.
