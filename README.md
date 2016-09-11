# SVG-to-PDFKit
Insert SVG into a PDF document created with PDFKit

Use:

    SVGtoPDF(doc, svg, x, y);

Parameters:

    doc [PDFDocument] = the PDF document created with PDFKit
    svg [SVGElement or string] = the SVG object or XML code
    x, y [number] = the position where the SVG will be added

Supported:
 - shapes: rect, circle, path, ellipse, line, polyline, polygon
 - styling with attributes only
 - colors: fill & stroke (rgb, rgba, hex or string), fill-opacity, stroke-opacity & opacity
 - transform attribute
 - text: text, tspan and a few of their attributes

Unsupported:
 - css: style element and inline style
 - textPath
 - text: most attributes of text & tspan elements
 - viewBox
 - nested svg elements and foreignElement
 - other things I don't even know they exist

They are many bugs, please send issues and/or pull requests.
